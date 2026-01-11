import { Holistic, type Results } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as Kalidokit from 'kalidokit';
import * as THREE from 'three';
import { motionEngine } from '../poses/motionEngine';

// ======================
// Configuration Constants
// ======================

/** Smoothing configuration for motion capture */
const SMOOTHING = {
  /** Base lerp factor for bone rotations (lower = smoother, higher = more responsive) */
  BASE_LERP: 0.16,
  /** Faster lerp for eye movements to reduce lag */
  EYE_LERP: 0.4,
  /** Slower lerp for head to prevent jitter */
  HEAD_LERP: 0.12,
  /** Moderate lerp for hand tracking to balance responsiveness and stability */
  HAND_LERP: 0.22,
};

/** Gaze sensitivity multiplier for eye tracking */
const GAZE_SENSITIVITY = 1.5;

/** Deadzone for eye tracking to reduce micro-jitter */
const GAZE_DEADZONE = 0.04;

/** Head dampening factor (0.4 = 40% dampening, retain 60% of movement) */
const HEAD_DAMPENING = 0.4;

/** Hand joint constraints for stability (radians) */
const HAND_CONSTRAINTS = {
  WRIST: {
    x: [-1.6, 1.6],
    y: [-1.6, 1.6],
    z: [-1.6, 1.6],
  },
  FINGER: {
    x: [-0.5, 0.5],
    y: [-0.5, 0.5],
    z: [-1.9, 0.3],
  },
  THUMB: {
    x: [-0.8, 0.8],
    y: [-0.8, 0.8],
    z: [-1.6, 0.5],
  },
};

/** Camera capture configuration */
const CAMERA_CONFIG = {
  WIDTH: 640,
  HEIGHT: 480,
  /** Use front-facing camera on mobile devices */
  FACING_MODE: 'user' as const,
};

/** MediaPipe Holistic configuration */
const HOLISTIC_CONFIG = {
  modelComplexity: 1 as const,
  smoothLandmarks: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
  refineFaceLandmarks: true,
};

interface RecordedFrame {
    time: number;
    bones: Record<string, { rotation: THREE.Quaternion, position?: THREE.Vector3 }>;
}

type HandLandmarks2D = Results['leftHandLandmarks'] | null;

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

  // Hand Tracking State
  private lastLeftHandLandmarks2D: HandLandmarks2D = null;
  private lastRightHandLandmarks2D: HandLandmarks2D = null;
  
  // Recording State
  private isRecording = false;
  private recordedFrames: RecordedFrame[] = [];
  private recordingStartTime = 0;

  // Calibration State
  private calibrationOffsets: Record<string, THREE.Quaternion> = {};
  private eyeCalibrationOffset = { x: 0, y: 0 };

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    
    this.holistic = new Holistic({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
      }
    });

    this.holistic.setOptions(HOLISTIC_CONFIG);

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

  getHandLandmarks2D() {
    return {
      left: this.lastLeftHandLandmarks2D,
      right: this.lastRightHandLandmarks2D,
    };
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
            width: CAMERA_CONFIG.WIDTH,
            height: CAMERA_CONFIG.HEIGHT,
            facingMode: CAMERA_CONFIG.FACING_MODE, // Ensures front camera on mobile
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
      
      const lerpFactor = SMOOTHING.BASE_LERP;
      
      // 1. Smooth Facial Expressions
      this.targetFaceValues.forEach((targetVal, name) => {
          const currentVal = this.currentFaceValues.get(name) || 0;
          
          // Dynamic smoothing: Eyes need to be snappier, Mouth/Face smoother
          let localLerp = lerpFactor;
          if (name.toLowerCase().includes('eye') || name.toLowerCase().includes('blink') || name.toLowerCase().includes('look')) {
              localLerp = SMOOTHING.EYE_LERP;
          }
          
          const newVal = THREE.MathUtils.lerp(currentVal, targetVal, localLerp);
          this.currentFaceValues.set(name, newVal);
          
          if (Math.abs(newVal - currentVal) > 0.001) {
              this.vrm!.expressionManager!.setValue(name, newVal);
          }
      });
      this.vrm.expressionManager.update();
      
      // 2. Smooth Bone Rotations
      this.targetBoneRotations.forEach((targetQ, boneName) => {
          // In Face mode, allow Head, Neck, Upper Body, and Hands for natural movement
          if (this.mode === 'face') {
              const allowedBones = ['head', 'neck', 'chest', 'upperchest', 'spine', 'hand', 'thumb', 'index', 'middle', 'ring', 'little'];
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
                  effectiveLerp = SMOOTHING.HEAD_LERP;
              } else if (boneName.toLowerCase().includes('hand') || boneName.toLowerCase().includes('thumb') || boneName.toLowerCase().includes('index') || boneName.toLowerCase().includes('middle') || boneName.toLowerCase().includes('ring') || boneName.toLowerCase().includes('little')) {
                  effectiveLerp = SMOOTHING.HAND_LERP;
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
    if (!results.poseLandmarks && !results.faceLandmarks && !results.leftHandLandmarks && !results.rightHandLandmarks) return;
    
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
                if (faceRig.eye && faceRig.head) {
                    const stabilized = Kalidokit.Face.stabilizeBlink(faceRig.eye, faceRig.head.y, {
                        enableWink: false,
                        maxRot: 0.5,
                    });
                    faceRig.eye = stabilized;
                }
                this.applyFaceRig(faceRig);
            }
        } catch (error) {
            console.warn("[MotionCapture] Face solver error:", error);
        }
    }

    // Solve Hands using Kalidokit
    if (results.rightHandLandmarks && results.rightHandLandmarks.length > 0) {
        try {
            this.lastRightHandLandmarks2D = results.rightHandLandmarks;
            const rightHandRig = Kalidokit.Hand.solve(results.rightHandLandmarks, 'Right');
            if (rightHandRig) {
                this.applyHandRig(rightHandRig, 'Right');
            }
        } catch (error) {
            console.warn("[MotionCapture] Right hand solver error:", error);
        }
    }

    if (results.leftHandLandmarks && results.leftHandLandmarks.length > 0) {
        try {
            this.lastLeftHandLandmarks2D = results.leftHandLandmarks;
            const leftHandRig = Kalidokit.Hand.solve(results.leftHandLandmarks, 'Left');
            if (leftHandRig) {
                this.applyHandRig(leftHandRig, 'Left');
            }
        } catch (error) {
            console.warn("[MotionCapture] Left hand solver error:", error);
        }
    }
  };

  calibrate() {
    this.calibrateBody();
    this.calibrateFace();
  }

  calibrateBody() {
    if (!this.vrm?.humanoid) return;
    console.log('[MotionCaptureManager] Calibrating Body Offsets...');
    this.calibrationOffsets = {};
    this.shouldCalibrateBody = true;
  }

  calibrateFace() {
    if (!this.vrm?.humanoid) return;
    console.log('[MotionCaptureManager] Calibrating Face/Eye Gaze Offsets...');
    this.eyeCalibrationOffset = { x: 0, y: 0 };
    this.shouldCalibrateFace = true;
  }
  
  private shouldCalibrateBody = false;
  private shouldCalibrateFace = false;

  private applyPoseRig(rig: any) {
    if (!this.vrm?.humanoid) return;

    // Helper to get bone name
    const getVRMBoneName = (key: string): string => {
        if (key === 'Hips') return 'hips';
        return key.charAt(0).toLowerCase() + key.slice(1);
    };

    // Calibration Step: Capture offsets if requested
    if (this.shouldCalibrateBody) {
        // Body Bone Offsets
        const rigKeys = Object.keys(rig);
        rigKeys.forEach(key => {
            const boneData = rig[key];
            if (boneData?.rotation) {
                const q = new THREE.Quaternion(boneData.rotation.x, boneData.rotation.y, boneData.rotation.z, boneData.rotation.w);
                this.calibrationOffsets[key] = q.clone();
            }
        });
        
        console.log('[MotionCaptureManager] Body calibration complete. Offsets:', Object.keys(this.calibrationOffsets).length);
        this.shouldCalibrateBody = false;
    }

    const setTargetRotation = (key: string, rotation: { x: number, y: number, z: number, w?: number }) => {
        const boneName = getVRMBoneName(key);
        // @ts-ignore
        if (rotation.w !== undefined) {
            // Create target quaternion from rig
            const targetQ = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
            
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
      // Calibration Step for Face/Eyes
      if (this.shouldCalibrateFace) {
          if (rig.pupil) {
              this.eyeCalibrationOffset = {
                  x: rig.pupil.x,
                  y: rig.pupil.y
              };
              console.log('[MotionCaptureManager] Eye calibration captured:', this.eyeCalibrationOffset);
              this.shouldCalibrateFace = false;
          }
      }

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
                const identityQ = new THREE.Quaternion();
                headQ.slerp(identityQ, HEAD_DAMPENING);

                // Apply to target map for smoothing
                this.targetBoneRotations.set('head', headQ);

                // --- Derived Upper Body Movement (Face Mode Only) ---
                // If we are in Face mode, we want the body to subtly follow the head
                // Increased coupling factors to make the body feel more connected to the head movement.
                if (this.mode === 'face') {
                    // Neck follows head at 50%
                    const neckQ = new THREE.Quaternion().slerp(headQ, 0.5);
                    this.targetBoneRotations.set('neck', neckQ);

                    // Chest follows head at 30% (was 20%)
                    const chestQ = new THREE.Quaternion().slerp(headQ, 0.3);
                    this.targetBoneRotations.set('chest', chestQ);
                    this.targetBoneRotations.set('upperChest', chestQ);
                    
                    // Spine follows head at 15% (was 10%)
                    const spineQ = new THREE.Quaternion().slerp(headQ, 0.15);
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
          // Apply Calibration Offset
          // We subtract the calibrated offset from the raw input to zero it out
          const rawX = rig.pupil.x - this.eyeCalibrationOffset.x;
          const rawY = rig.pupil.y - this.eyeCalibrationOffset.y;

          const x = THREE.MathUtils.clamp(rawX * GAZE_SENSITIVITY, -1, 1);
          
          // IMPORTANT: Mirror Correction for Eyes
          // ... (comments retained/abbreviated)
          // FIX: Invert Y axis to match user expectation (Look Up = Look Up)
          const y = THREE.MathUtils.clamp(-rawY * GAZE_SENSITIVITY, -1, 1);

          const stabilizedX = Math.abs(x) < GAZE_DEADZONE ? 0 : x;
          const stabilizedY = Math.abs(y) < GAZE_DEADZONE ? 0 : y;
          
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
          
          setARKitGaze(stabilizedX, stabilizedY);
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

  private applyHandRig(rig: Record<string, { x: number, y: number, z: number }>, side: 'Left' | 'Right') {
      if (!this.vrm?.humanoid) return;

      const isLeft = side === 'Left';
      const boneMap: Record<string, VRMHumanBoneName> = {
          [`${side}Wrist`]: isLeft ? 'leftHand' : 'rightHand',
          [`${side}ThumbProximal`]: isLeft ? 'leftThumbMetacarpal' : 'rightThumbMetacarpal',
          [`${side}ThumbIntermediate`]: isLeft ? 'leftThumbProximal' : 'rightThumbProximal',
          [`${side}ThumbDistal`]: isLeft ? 'leftThumbDistal' : 'rightThumbDistal',
          [`${side}IndexProximal`]: isLeft ? 'leftIndexProximal' : 'rightIndexProximal',
          [`${side}IndexIntermediate`]: isLeft ? 'leftIndexIntermediate' : 'rightIndexIntermediate',
          [`${side}IndexDistal`]: isLeft ? 'leftIndexDistal' : 'rightIndexDistal',
          [`${side}MiddleProximal`]: isLeft ? 'leftMiddleProximal' : 'rightMiddleProximal',
          [`${side}MiddleIntermediate`]: isLeft ? 'leftMiddleIntermediate' : 'rightMiddleIntermediate',
          [`${side}MiddleDistal`]: isLeft ? 'leftMiddleDistal' : 'rightMiddleDistal',
          [`${side}RingProximal`]: isLeft ? 'leftRingProximal' : 'rightRingProximal',
          [`${side}RingIntermediate`]: isLeft ? 'leftRingIntermediate' : 'rightRingIntermediate',
          [`${side}RingDistal`]: isLeft ? 'leftRingDistal' : 'rightRingDistal',
          [`${side}LittleProximal`]: isLeft ? 'leftLittleProximal' : 'rightLittleProximal',
          [`${side}LittleIntermediate`]: isLeft ? 'leftLittleIntermediate' : 'rightLittleIntermediate',
          [`${side}LittleDistal`]: isLeft ? 'leftLittleDistal' : 'rightLittleDistal',
      };

      const clampRotation = (boneName: string, rotation: { x: number, y: number, z: number }) => {
          const isThumb = boneName.toLowerCase().includes('thumb');
          const isWrist = boneName.toLowerCase().includes('hand');
          const range = isWrist ? HAND_CONSTRAINTS.WRIST : isThumb ? HAND_CONSTRAINTS.THUMB : HAND_CONSTRAINTS.FINGER;

          return {
              x: THREE.MathUtils.clamp(rotation.x, range.x[0], range.x[1]),
              y: THREE.MathUtils.clamp(rotation.y, range.y[0], range.y[1]),
              z: THREE.MathUtils.clamp(rotation.z, range.z[0], range.z[1]),
          };
      };

      Object.entries(rig).forEach(([key, rotation]) => {
          const boneName = boneMap[key];
          if (!boneName || !rotation) return;

          const constrained = clampRotation(boneName, rotation);
          const targetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(constrained.x, constrained.y, constrained.z, 'XYZ'));
          this.targetBoneRotations.set(boneName, targetQ);
      });
  }
}
