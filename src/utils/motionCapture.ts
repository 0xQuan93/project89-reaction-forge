import { Holistic, type Results } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as Kalidokit from 'kalidokit';
import * as THREE from 'three';
import { motionEngine } from '../poses/motionEngine';
import { sceneManager } from '../three/sceneManager';
import { OneEuroFilter, OneEuroFilterQuat, OneEuroFilterVec3 } from './OneEuroFilter';

import { live2dManager } from '../live2d/live2dManager';

// ======================
// Configuration Constants
// ======================

/** Smoothing configuration for motion capture */
const SMOOTHING = {
  // OneEuroFilter parameters
  MIN_CUTOFF: 1.0,  // Hz. Lower = more smoothing when slow.
  BETA: 0.5,        // Speed coefficient. Higher = less lag when moving fast.
  D_CUTOFF: 1.0,    // Derivative cutoff.
  
  // Specific overrides
  EYE_MIN_CUTOFF: 2.0, // Eyes move faster
  HEAD_MIN_CUTOFF: 0.5, // Head is heavier
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
  private updateSources: Set<'camera' | 'vmc'> = new Set();
  
  // Track available blendshapes on the current avatar for fuzzy matching
  private availableBlendshapes: Set<string> = new Set();
  
  // Tracking Mode
  private mode: 'full' | 'face' = 'full';

  // Smoothing State
  private targetFaceValues: Map<string, number> = new Map();
  private currentFaceValues: Map<string, number> = new Map();
  private targetBoneRotations: Map<string, THREE.Quaternion> = new Map();
  
  // OneEuroFilter Instances
  private boneFilters: Map<string, OneEuroFilterQuat> = new Map();
  private faceFilters: Map<string, OneEuroFilter> = new Map();
  private rootPositionFilter: OneEuroFilterVec3 = new OneEuroFilterVec3(SMOOTHING.MIN_CUTOFF, SMOOTHING.BETA);
  
  private targetRootPosition: THREE.Vector3 | null = null;
  private currentRootPosition: THREE.Vector3 = new THREE.Vector3();
  private tickDispose?: () => void; // Replaces updateLoopId
  private baseHipsPosition: THREE.Vector3 = new THREE.Vector3(0, 1.0, 0);

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
  private hipsRefPosition: THREE.Vector3 | null = null;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    
    this.holistic = new Holistic({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
      }
    });

    this.holistic.setOptions(HOLISTIC_CONFIG);

    this.holistic.onResults(this.handleResults);
  }

  setVRM(vrm: VRM) {
    this.vrm = vrm;
    const hipsNode = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
    if (hipsNode) {
      this.baseHipsPosition.copy(hipsNode.position);
    }
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
    
    // Reset filters
    this.boneFilters.clear();
    this.faceFilters.clear();
    this.rootPositionFilter = new OneEuroFilterVec3(SMOOTHING.MIN_CUTOFF, SMOOTHING.BETA);
    
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
        // We do NOT stop animation here anymore.
        // MocapTab handles the logic: 
        // - Face Mode: Animation continues (for legs/idle), Mocap overwrites upper body.
        // - Full Body: MocapTab freezes/stops animation so Mocap has full control.
        
        // Disable LookAt temporarily if it exists (it fights head rotation)
        if (this.vrm?.lookAt) {
            this.vrm.lookAt.target = undefined; 
            // We can't easily "disable" it without removing the plugin or setting weight to 0
            // Setting applier to null might work or setting autoUpdate to false if exposed
            // For now, let's assume the user isn't using LookAt heavily or we'll overwrite it
        }

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
        this.startUpdateLoop('camera');
    } catch (e) {
        console.error('Failed to start camera:', e);
        throw e;
    }
  }

  stop() {
    if (this.camera) {
        if (typeof (this.camera as any).stop === 'function') {
            (this.camera as any).stop();
        }

        const stream = this.videoElement.srcObject as MediaStream | null;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        this.videoElement.srcObject = null;
        this.videoElement.pause();
        this.camera = undefined;
    }
    
    // Resume idle animation or reset pose if needed?
    // For now, we leave the avatar in the last mocap pose (freeze)
    // or we could call avatarManager.resetPose();
    
    this.isTracking = false;
    this.stopUpdateLoop('camera');
  }
  
  startExternalInput() {
      this.startUpdateLoop('vmc');
  }

  stopExternalInput() {
      this.stopUpdateLoop('vmc');
  }

  applyExternalBoneRotation(boneName: VRMHumanBoneName, rotation: THREE.Quaternion) {
      this.targetBoneRotations.set(boneName, rotation);
  }

  applyExternalRootPosition(position: THREE.Vector3) {
      this.targetRootPosition = position.clone().add(this.baseHipsPosition);
  }

  applyExternalExpression(name: string, value: number) {
      if (this.availableBlendshapes.has(name)) {
          this.targetFaceValues.set(name, value);
      }
  }

  private startUpdateLoop(source: 'camera' | 'vmc') {
      this.updateSources.add(source);
      if (this.tickDispose) {
          return;
      }
      // Use SceneManager's tick loop to ensure synchronization with rendering
      // Priority 100 ensures we run BEFORE AvatarManager (which is default 0)
      // This guarantees: 1. Set Bones -> 2. Physics Update (AvatarManager) -> 3. Render
      this.tickDispose = sceneManager.registerTick((delta) => {
          this.updateFrame(delta);
      }, 100);
  }
  
  private stopUpdateLoop(source: 'camera' | 'vmc') {
      this.updateSources.delete(source);
      if (this.tickDispose && this.updateSources.size === 0) {
          this.tickDispose();
          this.tickDispose = undefined;
      }
  }

  // --- Main Update Loop for Smoothing ---
  private updateFrame(_delta: number) {
      if (!this.vrm || !this.vrm.humanoid || !this.vrm.expressionManager) return;
      
      const timestamp = performance.now() / 1000;

      // 1. Smooth Facial Expressions
      this.targetFaceValues.forEach((targetVal, name) => {
          let filter = this.faceFilters.get(name);
          if (!filter) {
              const minCutoff = (name.toLowerCase().includes('eye') || name.toLowerCase().includes('blink')) 
                ? SMOOTHING.EYE_MIN_CUTOFF 
                : SMOOTHING.MIN_CUTOFF;
              filter = new OneEuroFilter(minCutoff, SMOOTHING.BETA);
              this.faceFilters.set(name, filter);
          }
          
          const newVal = filter.filter(targetVal, timestamp);
          this.currentFaceValues.set(name, newVal);
          
          this.vrm!.expressionManager!.setValue(name, newVal);
      });
      this.vrm.expressionManager.update();
      
      // 2. Smooth Bone Rotations
      this.targetBoneRotations.forEach((targetQ, boneName) => {
          // In Face mode, allow Head, Neck, Upper Body, and Hands for natural movement
          if (this.mode === 'face') {
              const allowedBones = [
                  'head', 'neck',
                  'chest', 'upperchest', 'spine', // Hips removed to prevent full body rotation
                  'shoulder', 'arm', // Covers upperArm, lowerArm
                  'hand', 'thumb', 'index', 'middle', 'ring', 'little'
              ];
              if (!allowedBones.some(b => boneName.toLowerCase().includes(b))) return;
          }

          // @ts-ignore
          const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
          if (node) {
              // Get or Init Filter
              let filter = this.boneFilters.get(boneName);
              if (!filter) {
                  const minCutoff = boneName.toLowerCase().includes('head') 
                    ? SMOOTHING.HEAD_MIN_CUTOFF 
                    : SMOOTHING.MIN_CUTOFF;
                  filter = new OneEuroFilterQuat(minCutoff, SMOOTHING.BETA);
                  this.boneFilters.set(boneName, filter);
              }

              // Filter Quaternion components
              // OneEuroFilterQuat handles normalization internally
              const smoothed = filter.filter(targetQ.x, targetQ.y, targetQ.z, targetQ.w, timestamp);
              
              node.quaternion.set(smoothed.x, smoothed.y, smoothed.z, smoothed.w);
          }
      });

      // 3. Smooth Root Position (Full Body Only)
      if (this.mode === 'full' && this.targetRootPosition) {
          const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
          if (hips) {
             const smoothedPos = this.rootPositionFilter.filter(
                 this.targetRootPosition.x,
                 this.targetRootPosition.y,
                 this.targetRootPosition.z,
                 timestamp
             );
             
             this.currentRootPosition.set(smoothedPos.x, smoothedPos.y, smoothedPos.z);
             hips.position.copy(this.currentRootPosition);
          }
      }
      
      // CRITICAL: Force update the humanoid to apply these changes
      this.vrm.humanoid.update();
      
      // NOTE: We do NOT call vrm.update(delta) here because AvatarManager does it.
      // By using sceneManager.registerTick, we ensure this runs in the same frame cycle.
      
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
    // Always solve pose to get upper body data, even in Face mode
    const poseWorldLandmarks = (results as any).poseWorldLandmarks || (results as any).ea;
    
    // Check if both pose landmarks and world landmarks are available and valid
    if (results.poseLandmarks && results.poseLandmarks.length >= 33 && 
        poseWorldLandmarks && poseWorldLandmarks.length >= 33) {
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
    this.hipsRefPosition = null; // Reset hips ref
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
        
        // Capture Hips Reference Position if available in this frame
        if (rig.Hips?.position) {
            this.hipsRefPosition = new THREE.Vector3(rig.Hips.position.x, rig.Hips.position.y, rig.Hips.position.z);
            console.log('[MotionCaptureManager] Hips reference position captured:', this.hipsRefPosition);
        }

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
            if (boneData.position) {
                const pos = boneData.position;
                
                // Calculate delta from calibration
                let x = pos.x;
                let y = pos.y;
                let z = pos.z;
                
                if (this.hipsRefPosition) {
                    x -= this.hipsRefPosition.x;
                    y -= this.hipsRefPosition.y;
                    z -= this.hipsRefPosition.z;
                }
                
                // Scale movement
                // We want significant movement but kept within reasonable bounds
                const MOVE_SCALE = 1.5; 
                
                // Base height (standard VRM hip height is ~0.8-1.0m)
                // We use the VRM's actual rest position if possible, or default to 1.0
                const restY = 1.0; 

                this.targetRootPosition = new THREE.Vector3(
                    x * MOVE_SCALE,           // Horizontal
                    (y * MOVE_SCALE) + restY, // Vertical + Base Height
                    z * MOVE_SCALE            // Depth
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
      // Data container for Live2D
      const live2dData = {
          head: { x: 0, y: 0, z: 0 },
          eye: { l: 1, r: 1 },
          pupil: { x: 0, y: 0 },
          mouth: { open: 0 }
      };

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

                // --- Live2D Head ---
                // Convert dampened quaternion to Euler for Live2D
                // Order YXZ (Yaw, Pitch, Roll) is usually stable for head
                const euler = new THREE.Euler().setFromQuaternion(headQ, 'YXZ');
                live2dData.head = {
                    x: THREE.MathUtils.radToDeg(euler.x),
                    y: THREE.MathUtils.radToDeg(euler.y),
                    z: THREE.MathUtils.radToDeg(euler.z)
                };
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

          // Live2D
          live2dData.eye = { l: rig.eye.l, r: rig.eye.r };
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

          // Live2D Pupil (Use processed X/Y)
          live2dData.pupil = { x, y };

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
              // Live2D
              live2dData.mouth.open = rig.mouth.open;
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

      // Apply to Live2D
      live2dManager.updateFaceModel(live2dData);
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
