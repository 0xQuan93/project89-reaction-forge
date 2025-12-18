import { Holistic, type Results } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as Kalidokit from 'kalidokit';
import * as THREE from 'three';
import { motionEngine } from '../poses/motionEngine';

interface RecordedFrame {
    time: number;
    bones: Record<string, { rotation: THREE.Quaternion, position?: THREE.Vector3 }>;
}

export class MotionCaptureManager {
  private holistic: Holistic;
  private camera?: Camera;
  private vrm?: VRM;
  private videoElement: HTMLVideoElement;
  private isTracking = false;
  
  // Track available blendshapes on the current avatar for fuzzy matching
  private availableBlendshapes: Set<string> = new Set();
  
  // Recording State
  private isRecording = false;
  private recordedFrames: RecordedFrame[] = [];
  private recordingStartTime = 0;

  // Calibration State
  private calibrationOffsets: Record<string, THREE.Quaternion> = {};

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    
    this.holistic = new Holistic({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
      }
    });

    this.holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
      refineFaceLandmarks: true
    });

    this.holistic.onResults(this.handleResults);
  }

  setVRM(vrm: VRM) {
    this.vrm = vrm;
    this.updateAvailableBlendshapes();
  }

  private updateAvailableBlendshapes() {
    this.availableBlendshapes.clear();
    if (!this.vrm?.expressionManager) return;
    
    // Extract available expression names from VRM
    // This supports both VRM 0.0 and 1.0 structures
    const manager = this.vrm.expressionManager as any;
    
    if (manager.expressionMap) {
       Object.keys(manager.expressionMap).forEach(name => this.availableBlendshapes.add(name));
    } else if (manager.expressions) {
       manager.expressions.forEach((expr: any) => {
          if (expr.expressionName) this.availableBlendshapes.add(expr.expressionName);
       });
    } else if (manager._expressionMap) {
       Object.keys(manager._expressionMap).forEach(name => this.availableBlendshapes.add(name));
    }
    
    // console.log('[MotionCaptureManager] Updated available blendshapes:', Array.from(this.availableBlendshapes));
  }

  async start() {
    if (this.isTracking) return;
    
    try {
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.holistic.send({ image: this.videoElement });
            },
            width: 640,
            height: 480
        });

        await this.camera.start();
        this.isTracking = true;
    } catch (e) {
        console.error('Failed to start camera:', e);
        throw e;
    }
  }

  stop() {
    if (this.camera) {
        const stream = this.videoElement.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        this.camera = undefined;
    }
    this.isTracking = false;
  }

  startRecording() {
    this.isRecording = true;
    this.recordedFrames = [];
    this.recordingStartTime = performance.now();
    console.log('[MotionCaptureManager] Started recording');
  }

  stopRecording(): THREE.AnimationClip | null {
    this.isRecording = false;
    console.log('[MotionCaptureManager] Stopped recording. Frames:', this.recordedFrames.length);
    if (this.recordedFrames.length === 0) return null;
    return this.createAnimationClip();
  }

  private createAnimationClip(): THREE.AnimationClip {
      const tracks: THREE.KeyframeTrack[] = [];
      const duration = this.recordedFrames[this.recordedFrames.length - 1].time;
      
      // Group data by bone
      const boneTracks: Record<string, { times: number[], values: number[], type: 'quaternion' | 'vector' }> = {};

      this.recordedFrames.forEach(frame => {
          Object.entries(frame.bones).forEach(([boneName, data]) => {
             // Rotation
             if (!boneTracks[`${boneName}.quaternion`]) {
                 boneTracks[`${boneName}.quaternion`] = { times: [], values: [], type: 'quaternion' };
             }
             boneTracks[`${boneName}.quaternion`].times.push(frame.time);
             boneTracks[`${boneName}.quaternion`].values.push(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);

             // Position (Hips only usually)
             if (data.position) {
                 if (!boneTracks[`${boneName}.position`]) {
                     boneTracks[`${boneName}.position`] = { times: [], values: [], type: 'vector' };
                 }
                 boneTracks[`${boneName}.position`].times.push(frame.time);
                 boneTracks[`${boneName}.position`].values.push(data.position.x, data.position.y, data.position.z);
             }
          });
      });

      // Create tracks
      Object.entries(boneTracks).forEach(([name, data]) => {
          if (data.type === 'quaternion') {
              tracks.push(new THREE.QuaternionKeyframeTrack(name, data.times, data.values));
          } else {
              tracks.push(new THREE.VectorKeyframeTrack(name, data.times, data.values));
          }
      });

      return new THREE.AnimationClip(`Mocap_Take_${Date.now()}`, duration, tracks);
  }

  private handleResults = (results: Results) => {
    if (!this.vrm) return;

    // 1. Capture Frame (if recording)
    // We do this regardless of tracking status to ensure we capture the avatar's state (even if static/T-pose)
    // and to prevent "No motion data" errors if tracking is intermittent.
    if (this.isRecording) {
        this.captureFrame();
    }
    
    // 2. Check for Landmarks
    if (!results.poseLandmarks && !results.faceLandmarks) return;
    
    // 3. Solve Pose using Kalidokit
    // NOTE: Kalidokit expects poseWorldLandmarks but MediaPipe Holistic output calls it ea (in minified form) 
    // or sometimes it's missing. We can try using poseLandmarks for both if world is missing, 
    // but world landmarks are better for 3D rotation.
    // The @mediapipe/holistic types might differ slightly from actual runtime object or Kalidokit expectation.
    // We cast to any to bypass strict type checking on the results object for now.
    const poseWorldLandmarks = (results as any).poseWorldLandmarks || (results as any).ea;
    
    // Safety check for landmarks array to prevent "Cannot read properties of undefined (reading '23')"
    if (results.poseLandmarks && results.poseLandmarks.length >= 33) {
        try {
            const poseRig = Kalidokit.Pose.solve(results.poseLandmarks, poseWorldLandmarks, {
                runtime: 'mediapipe',
                video: this.videoElement
            });
            if (poseRig) {
                this.applyPoseRig(poseRig);
            }
        } catch (error) {
            console.warn("[MotionCapture] Pose solver error:", error);
        }
    }

    // Solve Face using Kalidokit
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        try {
            const faceRig = Kalidokit.Face.solve(results.faceLandmarks, {
                runtime: 'mediapipe',
                video: this.videoElement,
                smoothBlink: true, // Enable blink smoothing
                blinkSettings: [0.25, 0.75], // Adjust thresholds for responsiveness
            });
            if (faceRig) {
                this.applyFaceRig(faceRig);
            }
        } catch (error) {
            console.warn("[MotionCapture] Face solver error:", error);
        }
    }
  };

  calibrate() {
    if (!this.vrm?.humanoid) return;
    console.log('[MotionCaptureManager] Calibrating T-Pose...');
    
    // Clear previous offsets
    this.calibrationOffsets = {};
    
    // Set flag to capture offsets on next frame
    this.shouldCalibrateNextFrame = true;
  }
  
  private shouldCalibrateNextFrame = false;

  private applyPoseRig(rig: any) {
    if (!this.vrm?.humanoid) return;

    // Helper to get bone name
    const getVRMBoneName = (key: string): string => {
        if (key === 'Hips') return 'hips';
        return key.charAt(0).toLowerCase() + key.slice(1);
    };

    // Calibration Step: Capture offsets if requested
    if (this.shouldCalibrateNextFrame) {
        const rigKeys = Object.keys(rig);
        rigKeys.forEach(key => {
            const boneData = rig[key];
            if (boneData?.rotation) {
                const q = new THREE.Quaternion(boneData.rotation.x, boneData.rotation.y, boneData.rotation.z, boneData.rotation.w);
                this.calibrationOffsets[key] = q.clone();
            }
        });
        console.log('[MotionCaptureManager] Calibration complete. Offsets:', Object.keys(this.calibrationOffsets).length);
        this.shouldCalibrateNextFrame = false;
    }

    const rotateBone = (key: string, rotation: { x: number, y: number, z: number, w?: number }) => {
        const boneName = getVRMBoneName(key);
        // @ts-ignore
        const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
        if (node) {
            if (rotation.w !== undefined) {
                // Create target quaternion from rig
                let targetQ = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
                
                // Apply Calibration Offset: Target = Measured * Inverse(Calibration)
                if (this.calibrationOffsets[key]) {
                    const invCalibration = this.calibrationOffsets[key].clone().invert();
                    targetQ.multiply(invCalibration);
                }

                // Reference Motion Engine Limits
                // Convert to Euler for clamping
                const euler = new THREE.Euler().setFromQuaternion(targetQ, 'XYZ');
                const deg = {
                    x: THREE.MathUtils.radToDeg(euler.x),
                    y: THREE.MathUtils.radToDeg(euler.y),
                    z: THREE.MathUtils.radToDeg(euler.z)
                };
                
                // Apply constraints
                const constrained = motionEngine.constrainRotation(boneName, deg);
                
                // Convert back
                targetQ.setFromEuler(new THREE.Euler(
                    THREE.MathUtils.degToRad(constrained.x),
                    THREE.MathUtils.degToRad(constrained.y),
                    THREE.MathUtils.degToRad(constrained.z),
                    'XYZ'
                ));
                
                // Slerp for smooth transition
                node.quaternion.slerp(targetQ, 0.3);
            }
        }
    };

    const rigKeys = Object.keys(rig);
    
    rigKeys.forEach(key => {
        const boneData = rig[key];
        if (key === 'Hips') {
            rotateBone('Hips', boneData.rotation!);
            
            // Apply Hips Position (Scaled down a bit to fit VRM world scale)
            const node = this.vrm!.humanoid!.getNormalizedBoneNode('hips');
            if (boneData.position && node) {
                 // ... position logic ...
            }
        } else {
            if (boneData.rotation) {
                rotateBone(key, boneData.rotation);
            }
        }
    });
    
    this.vrm.humanoid.update();
  }

  private captureFrame() {
      if (!this.vrm?.humanoid) return;

      const time = (performance.now() - this.recordingStartTime) / 1000;
      const bones: Record<string, { rotation: THREE.Quaternion, position?: THREE.Vector3 }> = {};
      
      const boneNames = Object.values(VRMHumanBoneName);
      
      boneNames.forEach((boneName) => {
          const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
          if (node) {
              bones[boneName] = {
                  rotation: node.quaternion.clone()
              };
              if (boneName === 'hips') {
                  bones[boneName].position = node.position.clone();
              }
          }
      });

      this.recordedFrames.push({ time, bones });
  }

  private applyFaceRig(rig: any) {
      if (!this.vrm?.expressionManager) return;

      const em = this.vrm.expressionManager;
      
      // Helper function to find best matching expression and set it
      // Prioritizes available blendshapes on the specific avatar
      const setExpression = (candidates: string[], value: number) => {
          const match = candidates.find(name => this.availableBlendshapes.has(name));
          if (match) {
              em.setValue(match, value);
          }
      };

      // 1. Head Rotation
      if (rig.head) {
          const headBone = this.vrm.humanoid?.getNormalizedBoneNode('head');
          if (headBone) {
              const q = rig.head;
              // Mix head rotation from pose and face for stability
              const targetQ = new THREE.Quaternion(q.x, q.y, q.z, q.w);
              headBone.quaternion.slerp(targetQ, 0.5); 
          }
      }

      // 2. Eyes (Blink)
      if (rig.eye) {
          const blinkL = 1 - rig.eye.l;
          const blinkR = 1 - rig.eye.r;
          
          setExpression(['BlinkLeft', 'blink_l', 'eyeBlinkLeft', 'LeftEyeBlink'], blinkL);
          setExpression(['BlinkRight', 'blink_r', 'eyeBlinkRight', 'RightEyeBlink'], blinkR);
          
          // Fallback/Sync for generic Blink
          const blinkMax = Math.max(blinkL, blinkR);
          setExpression(['Blink', 'blink', 'eyeBlink'], blinkMax);
      }

      // 3. Pupils (LookAt)
      if (rig.pupil) {
          const x = rig.pupil.x;
          const y = rig.pupil.y;
          
          if (x > 0) {
              setExpression(['LookLeft', 'lookLeft', 'eyeLookInLeft'], 0);
              setExpression(['LookRight', 'lookRight', 'eyeLookInRight'], x);
          } else {
              setExpression(['LookRight', 'lookRight', 'eyeLookInRight'], 0);
              setExpression(['LookLeft', 'lookLeft', 'eyeLookInLeft'], -x);
          }
          
          if (y > 0) {
              setExpression(['LookUp', 'lookUp', 'eyeLookUp'], 0);
              setExpression(['LookDown', 'lookDown', 'eyeLookDown'], y);
          } else {
              setExpression(['LookDown', 'lookDown', 'eyeLookDown'], 0);
              setExpression(['LookUp', 'lookUp', 'eyeLookUp'], -y);
          }
      }

      // 4. Mouth
      if (rig.mouth) {
          const shape = rig.mouth.shape; // { A, E, I, O, U }
          
          // Standard Vowels
          setExpression(['Aa', 'a', 'mouthOpen'], shape.A);
          setExpression(['Ee', 'e'], shape.E);
          setExpression(['Ih', 'i'], shape.I);
          setExpression(['Oh', 'o', 'mouthPucker'], shape.O);
          setExpression(['Ou', 'u', 'mouthFunnel'], shape.U);
          
          // Extra ARKit support if available (jawOpen is calculated by Kalidokit)
          if (rig.mouth.open !== undefined) {
              setExpression(['jawOpen', 'mouthOpen', 'A'], rig.mouth.open);
          }
      }
      
      // 5. Brows
      if (rig.brow) {
          const browValue = rig.brow;
          // Priority: ARKit browInnerUp > Surprised
          // Note: "Surprised" often includes mouth, so we prioritize brow-specific shapes
          setExpression(['browInnerUp', 'BrowsUp', 'browOuterUpLeft', 'browOuterUpRight', 'Surprised', 'surprise'], browValue);
      }

      em.update();
  }
}
