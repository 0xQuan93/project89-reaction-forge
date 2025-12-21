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
  
  // Tracking Mode
  private mode: 'full' | 'face' = 'full';

  // Smoothing State
  private targetFaceValues: Map<string, number> = new Map();
  private currentFaceValues: Map<string, number> = new Map();
  private targetBoneRotations: Map<string, THREE.Quaternion> = new Map();
  // Store smoothed rotation state internally to prevent loop jolts
  private currentBoneRotations: Map<string, THREE.Quaternion> = new Map(); 
  private targetRootPosition: THREE.Vector3 | null = null;
  private currentRootPosition: THREE.Vector3 = new THREE.Vector3();
  private updateLoopId: number | null = null;
  
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

  setMode(mode: 'full' | 'face') {
      this.mode = mode;
      console.log('[MotionCaptureManager] Set mode:', mode);
  }

  private updateAvailableBlendshapes() {
    this.availableBlendshapes.clear();
    this.targetFaceValues.clear();
    this.currentFaceValues.clear();
    this.targetBoneRotations.clear();
    
    if (!this.vrm?.expressionManager) return;
    
    // Extract available expression names from VRM
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
    
    console.log('[MotionCaptureManager] Available blendshapes:', Array.from(this.availableBlendshapes));
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
        this.startUpdateLoop();
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
    this.stopUpdateLoop();
  }
  
  private startUpdateLoop() {
      if (this.updateLoopId) return;
      const update = () => {
          this.updateFrame();
          this.updateLoopId = requestAnimationFrame(update);
      };
      this.updateLoopId = requestAnimationFrame(update);
  }
  
  private stopUpdateLoop() {
      if (this.updateLoopId) {
          cancelAnimationFrame(this.updateLoopId);
          this.updateLoopId = null;
      }
  }

  // --- Main Update Loop for Smoothing ---
  private updateFrame() {
      if (!this.vrm || !this.vrm.humanoid || !this.vrm.expressionManager) return;
      
      // Increased smoothing by ~35% (0.25 -> 0.16) to prevent violent jolts
      const lerpFactor = 0.16; 
      
      // 1. Smooth Facial Expressions
      this.targetFaceValues.forEach((targetVal, name) => {
          const currentVal = this.currentFaceValues.get(name) || 0;
          const newVal = THREE.MathUtils.lerp(currentVal, targetVal, lerpFactor);
          this.currentFaceValues.set(name, newVal);
          
          if (Math.abs(newVal - currentVal) > 0.001) {
              this.vrm!.expressionManager!.setValue(name, newVal);
          }
      });
      this.vrm.expressionManager.update();
      
      // 2. Smooth Bone Rotations
      this.targetBoneRotations.forEach((targetQ, boneName) => {
          // In Face mode, allow Head, Neck, and Upper Body bones for natural movement
          if (this.mode === 'face') {
              const allowedBones = ['head', 'neck', 'chest', 'upperchest', 'spine'];
              if (!allowedBones.some(b => boneName.toLowerCase().includes(b))) return;
          }

          // @ts-ignore
          const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
          if (node) {
              // STATE ISOLATION FIX:
              // Instead of slerping from the node's current rotation (which is reset by animation loops),
              // we slerp from our internal 'currentBoneRotations' state.
              // This ensures the motion capture path remains smooth regardless of what the animation mixer does.
              
              // 1. Get or Init current smoothed rotation
              let currentQ = this.currentBoneRotations.get(boneName);
              if (!currentQ) {
                  // Initialize from current node state if first time
                  currentQ = node.quaternion.clone();
                  this.currentBoneRotations.set(boneName, currentQ);
              }
              
              // 2. Slerp internal state towards target
              // For Head bone specifically, use a higher smoothing factor (lower lerp)
              let effectiveLerp = lerpFactor;
              if (boneName.toLowerCase().includes('head')) {
                  effectiveLerp = 0.1; // Extra smooth for head (vs 0.16)
              }
              
              currentQ.slerp(targetQ, effectiveLerp);
              
              // 3. Apply to Scene Node (Overwriting animation mixer for this frame)
              node.quaternion.copy(currentQ);
          }
      });

      // 3. Smooth Root Position (Full Body Only)
      if (this.mode === 'full' && this.targetRootPosition) {
          const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
          if (hips) {
              this.currentRootPosition.lerp(this.targetRootPosition, lerpFactor);
              // Apply to hips - Note: VRM0.0/1.0 differences might apply, but usually modifying the node directly works
              hips.position.copy(this.currentRootPosition);
          }
      }
      
      // Only update if we are not recording (recording handles its own update/capture)
      // Actually we should always update visual model
      
      // CRITICAL: Force update the humanoid to apply these changes
      // This ensures that our manual Slerp modifications are respected by the VRM solver
      this.vrm.humanoid.update();
      
      // IMPORTANT: In Face Only mode, if we are playing an animation, we need to ensure the animation mixer's 
      // updates (which happen in AvatarManager's tick) are not overwritten by our lack of body updates here.
      // Since we only touched head/neck bones in Face Mode, the body bones remain under control of the AnimationMixer.
      // However, vrm.humanoid.update() might re-solve constraints.
      //
      // If full body mode, we rely on the fact that we froze the animation mixer via AvatarManager.
      // 
      // NOTE: If the user stops the camera but we are in Face Mode, the animation should continue.
      // The update loop here stops when camera stops.
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

  private calculateSmile(landmarks: any[]): number {
      if (!landmarks || landmarks.length < 300) return 0;
      
      // Landmarks:
      // 10: Top of head (approx hairline/forehead top)
      // 152: Chin
      // 61: Mouth corner left
      // 291: Mouth corner right
      // 0: Upper lip bottom (center)
      // 17: Lower lip top (center)
      
      const y10 = landmarks[10].y;
      const y152 = landmarks[152].y;
      const faceHeight = Math.abs(y152 - y10);
      
      if (faceHeight === 0) return 0;
      
      const leftCornerY = landmarks[61].y;
      const rightCornerY = landmarks[291].y;
      const avgCornerY = (leftCornerY + rightCornerY) / 2;
      
      const upperLipY = landmarks[0].y; // or 13
      const lowerLipY = landmarks[17].y; // or 14
      const centerMouthY = (upperLipY + lowerLipY) / 2;
      
      // Delta: Positive if corners are higher (smaller y) than center
      // Y increases downwards
      const delta = centerMouthY - avgCornerY;
      
      // Normalize by face height
      const ratio = delta / faceHeight;
      
      // Thresholds: Tuned experimentally
      // A neutral mouth has corners roughly aligned or slightly lower than center
      // A smile raises corners significantly
      const minRatio = 0.02; 
      const maxRatio = 0.08;
      
      return THREE.MathUtils.clamp((ratio - minRatio) / (maxRatio - minRatio), 0, 1);
  }

  private handleResults = (results: Results) => {
    if (!this.vrm) return;

    // 1. Capture Frame (if recording)
    if (this.isRecording) {
        this.captureFrame();
    }
    
    // 2. Check for Landmarks
    if (!results.poseLandmarks && !results.faceLandmarks) return;
    
    // 3. Solve Pose using Kalidokit
    // Only solve/apply pose if in full body mode
    if (this.mode === 'full') {
    const poseWorldLandmarks = (results as any).poseWorldLandmarks || (results as any).ea;
    
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
            
            // Inject custom smile calculation
            const smile = this.calculateSmile(results.faceLandmarks);
            // @ts-ignore - Injecting custom property
            faceRig.smile = smile;
            
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

    const setTargetRotation = (key: string, rotation: { x: number, y: number, z: number, w?: number }) => {
        const boneName = getVRMBoneName(key);
        // @ts-ignore
        if (rotation.w !== undefined) {
            // Create target quaternion from rig
            let targetQ = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
            
            // Apply Calibration Offset
            if (this.calibrationOffsets[key]) {
                const invCalibration = this.calibrationOffsets[key].clone().invert();
                targetQ.multiply(invCalibration);
            }

            // Reference Motion Engine Limits
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
            
            // Store target for smoothing loop
            this.targetBoneRotations.set(boneName, targetQ);
        }
    };

    const rigKeys = Object.keys(rig);
    
    rigKeys.forEach(key => {
        const boneData = rig[key];
        if (key === 'Hips') {
            setTargetRotation('Hips', boneData.rotation!);
            
            // Apply Hips Position
            // Kalidokit returns position normalized -1 to 1 usually, or scaled.
            // We need to scale it to be visible but not extreme.
            // Position z is crucial for depth.
            if (boneData.position) {
                const pos = boneData.position;
                // Create target vector. Scale factors are experimental.
                // VRM is approx 1.7m tall.
                this.targetRootPosition = new THREE.Vector3(
                    pos.x * 0.5, // Horizontal movement
                    pos.y * 0.5 + 1.0, // Vertical movement + offset to keep feet on ground approx
                    pos.z * 0.5  // Depth movement
                );
            }
        } else {
            if (boneData.rotation) {
                setTargetRotation(key, boneData.rotation);
            }
        }
    });
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
      // Helper function to set target weights
      // It iterates through all candidates and sets whichever one exists
      // This allows for simultaneous support of multiple standards (VRM 0.0, VRM 1.0, ARKit)
      const setExpressionTarget = (candidates: string[], value: number) => {
          candidates.forEach(name => {
              if (this.availableBlendshapes.has(name)) {
                  this.targetFaceValues.set(name, value);
              }
          });
      };

      // 1. Head Rotation
      if (rig.head) {
          // Kalidokit separates head rotation from the rest of the body rig
          // We need to apply it manually if we want head tracking
          // The head bone is usually "neck" or "head" depending on rig, but Kalidokit gives us head rotation
             const headBone = this.vrm?.humanoid?.getNormalizedBoneNode('head');
             if (headBone) {
                const q = rig.head; // {x, y, z, w}
                // Create quaternion
                const headQ = new THREE.Quaternion(q.x, q.y, q.z, q.w);
                
                // Dampen the head rotation amplitude significantly to mimic natural human range vs camera constraints.
                // Humans rarely rotate head > 45 deg while looking at a screen.
                // A factor of 0.5 or 0.6 is usually good.
                // User requested "reduce further" from 0.3 dampening (which was 0.7 retained).
                // Let's try retaining only 50% of the raw rotation (0.5 dampening).
                const identityQ = new THREE.Quaternion();
                headQ.slerp(identityQ, 0.5); // Dampens by 50%

                // Apply to target map for smoothing
                this.targetBoneRotations.set('head', headQ);

                // --- Derived Upper Body Movement (Face Mode Only) ---
                // If we are in Face mode, we want the body to subtly follow the head
                if (this.mode === 'face') {
                    // Dampen the rotation for the neck (e.g. 50% of head rotation)
                    // Note: headQ is already dampened above, so these are relative to that
                    const neckQ = new THREE.Quaternion().slerp(headQ, 0.5);
                    this.targetBoneRotations.set('neck', neckQ);

                    // Dampen further for chest/spine (e.g. 20% of head rotation)
                    const chestQ = new THREE.Quaternion().slerp(headQ, 0.2);
                    this.targetBoneRotations.set('chest', chestQ);
                    this.targetBoneRotations.set('upperChest', chestQ);
                    
                    const spineQ = new THREE.Quaternion().slerp(headQ, 0.1);
                    this.targetBoneRotations.set('spine', spineQ);
                }
             }
      }

      // 2. Eyes (Blink)
      if (rig.eye) {
          const blinkL = 1 - rig.eye.l;
          const blinkR = 1 - rig.eye.r;
          
          setExpressionTarget(['BlinkLeft', 'blink_l', 'eyeBlinkLeft', 'LeftEyeBlink'], blinkL);
          setExpressionTarget(['BlinkRight', 'blink_r', 'eyeBlinkRight', 'RightEyeBlink'], blinkR);
          
          const blinkMax = Math.max(blinkL, blinkR);
          setExpressionTarget(['Blink', 'blink', 'eyeBlink'], blinkMax);
      }

      // 3. Pupils (LookAt)
      if (rig.pupil) {
          const x = rig.pupil.x;
          // IMPORTANT: Mirror Correction for Eyes
          // When looking at the screen (camera), if you look DOWN, the camera sees your pupils lower.
          // MediaPipe gives +y for down (screen coordinates).
          // Standard ARKit/VRM expects +y for LOOK DOWN.
          // However, depending on the mirror effect of the video feed, the X axis might need inversion.
          // Also, sometimes the "LookUp/LookDown" mapping feels inverted to the user.
          // If the user says "when I look down, the avatar looks down" (which is correct), 
          // but if they meant "the avatar looks UP", then we invert.
          // User said: "the eyes are still not reflecting the users eyes, as so when the user looks down so does the avatar"
          // This implies the user expected INVERTED behavior? Or maybe they meant "the avatar looks UP when I look DOWN"?
          // Wait, "when the user looks down so does the avatar" is the CORRECT behavior for a mirror.
          // If they are complaining about it, maybe they want the avatar to maintain eye contact or something else?
          // OR, maybe they meant "when the user looks down, the avatar looks UP" (which is wrong) and they want it fixed?
          // "eyes are still not reflecting the users eyes" -> imply current behavior is WRONG.
          // "when user looks down so does avatar" -> This is the behavior they are seeing.
          // If they cite this as the problem, then they want the avatar to look UP when they look DOWN? That makes no sense for mocap.
          
          // Let's re-read: "eyes are still not reflecting the users eyes"
          // Usually means: I look left, avatar looks right (mirroring issue).
          // Or: I look down, avatar looks down (correct).
          
          // HYPOTHESIS: The user perceives the avatar's eye movement as "wrong" because the webcam is mounted ON TOP of the screen.
          // When you look at the center of the screen (at the avatar), your eyes are physically looking DOWN relative to the webcam.
          // So the avatar sees you looking down and looks down.
          // But you are looking AT the avatar. So the avatar should be looking AT you (Straight).
          // This is the classic "Webcam Eye Contact" problem.
          
          // SOLUTION: Apply an offset to the Y-axis to compensate for the webcam angle.
          // We assume the user is looking at the screen center when their eyes are slightly down relative to camera.
          // We shift the "neutral" point up.
          
          const webcamOffset = 0.2; // Shift neutral gaze up by 20%
          const y = rig.pupil.y - webcamOffset; 
          
          // Helper for ARKit asymmetric mapping
          const setARKitGaze = (xVal: number, yVal: number) => {
             // Look Right (+x) = Right Eye Out + Left Eye In
             // Look Left (-x) = Right Eye In + Left Eye Out
             
             if (xVal > 0) { // Look Right
                 setExpressionTarget(['eyeLookOutRight', 'LookRight'], xVal);
                 setExpressionTarget(['eyeLookInLeft', 'LookLeft'], xVal);
                 setExpressionTarget(['eyeLookInRight', 'LookLeft'], 0);
                 setExpressionTarget(['eyeLookOutLeft', 'LookRight'], 0);
             } else { // Look Left
                 setExpressionTarget(['eyeLookInRight', 'LookLeft'], -xVal);
                 setExpressionTarget(['eyeLookOutLeft', 'LookRight'], -xVal);
                 setExpressionTarget(['eyeLookOutRight', 'LookRight'], 0);
                 setExpressionTarget(['eyeLookInLeft', 'LookLeft'], 0);
             }
             
             // Correct logic: y > 0 is Looking Down
             
             if (yVal > 0) { // Look Down
                 setExpressionTarget(['eyeLookDownRight', 'LookDown'], yVal);
                 setExpressionTarget(['eyeLookDownLeft', 'LookDown'], yVal);
                 setExpressionTarget(['eyeLookUpRight', 'LookUp'], 0);
                 setExpressionTarget(['eyeLookUpLeft', 'LookUp'], 0);
             } else { // Look Up
                 // Invert sign for weight
                 setExpressionTarget(['eyeLookUpRight', 'LookUp'], -yVal);
                 setExpressionTarget(['eyeLookUpLeft', 'LookUp'], -yVal);
                 setExpressionTarget(['eyeLookDownRight', 'LookDown'], 0);
                 setExpressionTarget(['eyeLookDownLeft', 'LookDown'], 0);
             }
          };
          
          setARKitGaze(x, y);
      }

      // 4. Mouth
      if (rig.mouth) {
          const shape = rig.mouth.shape; // { A, E, I, O, U }
          
          setExpressionTarget(['Aa', 'a', 'mouthOpen'], shape.A);
          setExpressionTarget(['Ee', 'e'], shape.E);
          setExpressionTarget(['Ih', 'i'], shape.I);
          setExpressionTarget(['Oh', 'o', 'mouthPucker'], shape.O);
          setExpressionTarget(['Ou', 'u', 'mouthFunnel'], shape.U);
          
          if (rig.mouth.open !== undefined) {
              setExpressionTarget(['jawOpen', 'mouthOpen', 'A'], rig.mouth.open);
          }
      }
      
      // 5. Smiling (Custom)
      if (rig.smile !== undefined) {
          const smile = rig.smile;
          // Map to standard VRM and ARKit smile shapes
          setExpressionTarget(['Joy', 'joy', 'Happy', 'happy', 'Fun', 'fun'], smile);
          setExpressionTarget(['mouthSmileLeft', 'mouthSmileRight'], smile);
          setExpressionTarget(['mouthSmile'], smile);
      }
      
      // 6. Brows
      if (rig.brow) {
          const browValue = rig.brow;
          setExpressionTarget(['browInnerUp', 'BrowsUp', 'browOuterUpLeft', 'browOuterUpRight', 'Surprised', 'surprise'], browValue);
      }
  }
}
