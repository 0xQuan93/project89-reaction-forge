import { Camera } from '@mediapipe/camera_utils';
import { Holistic, type Results } from '@mediapipe/holistic';
import * as Kalidokit from 'kalidokit';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { motionEngine } from '../poses/motionEngine';
import { sceneManager } from '../three/sceneManager';
import { OneEuroFilter, OneEuroFilterQuat, OneEuroFilterVec3 } from './OneEuroFilter';
import { live2dManager } from '../live2d/live2dManager';

// ======================
// Configuration Constants
// ======================

// MediaPipe Configuration
const HOLISTIC_CONFIG = {
  modelComplexity: 1 as const,
  smoothLandmarks: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
  refineFaceLandmarks: true,
};

// Helper to calculate smile (Moved from worker)
function calculateSmile(landmarks: any[]): number {
    if (!landmarks || landmarks.length < 300) return 0;
    const y10 = landmarks[10].y;
    const y152 = landmarks[152].y;
    const faceHeight = Math.abs(y152 - y10);
    if (faceHeight === 0) return 0;
    const leftCornerY = landmarks[61].y;
    const rightCornerY = landmarks[291].y;
    const avgCornerY = (leftCornerY + rightCornerY) / 2;
    const upperLipY = landmarks[0].y; 
    const lowerLipY = landmarks[17].y; 
    const centerMouthY = (upperLipY + lowerLipY) / 2;
    const delta = centerMouthY - avgCornerY;
    const ratio = delta / faceHeight;
    const minRatio = 0.02; 
    const maxRatio = 0.08;
    // Clamp 0-1
    return Math.max(0, Math.min(1, (ratio - minRatio) / (maxRatio - minRatio)));
}

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

interface RecordedFrame {
    time: number;
    bones: Record<string, { rotation: THREE.Quaternion, position?: THREE.Vector3 }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandLandmarks2D = any; 

export class MotionCaptureManager {
  private holistic: Holistic | null = null; // Main thread holistic instance
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
  
  private shouldCalibrateBody = false;
  private shouldCalibrateFace = false;
  private shouldCalibrateVMC = true;
  private calibrationOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    this.initHolistic();
  }

  private initHolistic() {
      // Main Thread Initialization
      this.holistic = new Holistic({
          locateFile: (file) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
          }
      });

      this.holistic.setOptions(HOLISTIC_CONFIG);
      this.holistic.onResults(this.handleHolisticResults.bind(this));
      console.log('[MotionCaptureManager] Holistic initialized on main thread');
  }

  private handleHolisticResults(results: Results) {
      const rigs: any = {};
      const width = this.videoElement.videoWidth;
      const height = this.videoElement.videoHeight;

      // 1. Pose
      const poseWorldLandmarks = (results as any).poseWorldLandmarks || (results as any).ea;
      if (results.poseLandmarks && poseWorldLandmarks) {
        rigs.pose = Kalidokit.Pose.solve(results.poseLandmarks, poseWorldLandmarks, {
          runtime: 'mediapipe',
          imageSize: { width, height }
        });
      }

      // 2. Face
      if (results.faceLandmarks) {
        rigs.face = Kalidokit.Face.solve(results.faceLandmarks, {
          runtime: 'mediapipe',
          imageSize: { width, height },
          smoothBlink: true,
          blinkSettings: [0.25, 0.75],
        });
        
        if (rigs.face) {
            rigs.face.smile = calculateSmile(results.faceLandmarks);
            if (rigs.face.eye && rigs.face.head) {
                rigs.face.eye = Kalidokit.Face.stabilizeBlink(rigs.face.eye, rigs.face.head.y, {
                    enableWink: false,
                    maxRot: 0.5,
                });
            }
        }
      }

      // 3. Hands
      if (results.rightHandLandmarks) {
        rigs.rightHand = Kalidokit.Hand.solve(results.rightHandLandmarks, 'Right');
      }
      if (results.leftHandLandmarks) {
        rigs.leftHand = Kalidokit.Hand.solve(results.leftHandLandmarks, 'Left');
      }

      if (results.leftHandLandmarks || results.rightHandLandmarks) {
          this.lastLeftHandLandmarks2D = results.leftHandLandmarks;
          this.lastRightHandLandmarks2D = results.rightHandLandmarks;
      }
      
      // Apply Rigs
      if (rigs.pose) this.applyPoseRig(rigs.pose);
      if (rigs.face) this.applyFaceRig(rigs.face);
      if (rigs.rightHand) this.applyHandRig(rigs.rightHand, 'Right');
      if (rigs.leftHand) this.applyHandRig(rigs.leftHand, 'Left');
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
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        if (this.vrm?.lookAt) {
            this.vrm.lookAt.target = undefined; 
        }

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                if (this.holistic) {
                    await this.holistic.send({ image: this.videoElement });
                }
            },
            width: CAMERA_CONFIG.WIDTH,
            height: CAMERA_CONFIG.HEIGHT,
            facingMode: CAMERA_CONFIG.FACING_MODE, 
        });

        await this.camera.start();
        this.isTracking = true;
        this.startUpdateLoop('camera');
        this.recordingStartTime = performance.now();
    } catch (e) {
        console.error('Failed to start camera:', e);
        throw e;
    }
  }

  stop() {
    if (this.camera) {
        try {
            if (typeof (this.camera as any).stop === 'function') {
                (this.camera as any).stop();
            }
        } catch (e) {
            console.warn('[MotionCaptureManager] Failed to stop MediaPipe camera:', e);
        }

        // Force stop all tracks to ensure camera light goes off
        const stream = this.videoElement.srcObject as MediaStream | null;
        if (stream && stream.getTracks) {
            stream.getTracks().forEach(track => {
                track.stop();
                console.log('[MotionCaptureManager] Stopped camera track:', track.label);
            });
        }
        
        this.videoElement.srcObject = null;
        this.videoElement.pause();
        this.camera = undefined;
    }
    
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
      if (this.shouldCalibrateVMC) {
          this.calibrationOffset.copy(position).negate(); 
          console.log('[MotionCaptureManager] VMC Calibrated. Offset:', this.calibrationOffset);
          this.shouldCalibrateVMC = false;
      }
      
      const calibratedPos = position.clone().add(this.calibrationOffset);
      this.targetRootPosition = calibratedPos.add(this.baseHipsPosition);
  }

  recalibrateVMC() {
      this.shouldCalibrateVMC = true;
  }

  applyExternalExpression(name: string, value: number) {
      // 1. Try exact match
      if (this.availableBlendshapes.size === 0 || this.availableBlendshapes.has(name)) {
          this.targetFaceValues.set(name, value);
          if (this.availableBlendshapes.has(name)) return;
      }
      
      // 2. Try common VMC/ARKit aliases
      const aliases: Record<string, string[]> = {
          'fun': ['Fun', 'joy', 'Joy', 'Happy', 'happy'],
          'joy': ['Joy', 'joy', 'Happy', 'happy', 'Fun', 'fun'],
          'angry': ['Angry', 'angry', 'Anger', 'anger'],
          'sorrow': ['Sorrow', 'sorrow', 'Sad', 'sad'],
          'surprised': ['Surprised', 'surprised', 'Surprise', 'surprise'],
          'blink': ['Blink', 'blink'],
          'blink_l': ['BlinkLeft', 'blink_l', 'eyeBlinkLeft', 'LeftEyeBlink', 'blinkLeft'],
          'blink_r': ['BlinkRight', 'blink_r', 'eyeBlinkRight', 'RightEyeBlink', 'blinkRight'],
          'a': ['Aa', 'aa', 'mouthOpen'],
          'i': ['Ih', 'ih'],
          'u': ['Ou', 'ou'],
          'e': ['Ee', 'ee'],
          'o': ['Oh', 'oh', 'mouthPucker'],
          'lookleft': ['LookLeft', 'lookLeft', 'eyeLookInRight', 'eyeLookOutLeft'],
          'lookright': ['LookRight', 'lookRight', 'eyeLookInLeft', 'eyeLookOutRight'],
          'lookup': ['LookUp', 'lookUp', 'eyeLookUpLeft', 'eyeLookUpRight'],
          'lookdown': ['LookDown', 'lookDown', 'eyeLookDownLeft', 'eyeLookDownRight'],
          'neutral': ['Neutral', 'neutral'],
          'relaxed': ['Relaxed', 'relaxed', 'Fun'],
      };
      
      const lowerName = name.toLowerCase();
      const candidates = aliases[lowerName];
      
      if (candidates) {
          for (const candidate of candidates) {
              if (this.availableBlendshapes.size === 0 || this.availableBlendshapes.has(candidate)) {
                  this.targetFaceValues.set(candidate, value);
                  return;
              }
          }
      }
  }

  private startUpdateLoop(source: 'camera' | 'vmc') {
      this.updateSources.add(source);
      if (this.tickDispose) {
          return;
      }
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

  private updateFrame(_delta: number) {
      if (!this.vrm || !this.vrm.humanoid || !this.vrm.expressionManager) return;
      
      const timestamp = performance.now() / 1000;

      // Capture frame for recording if active (captures smoothed state)
      if (this.isRecording) {
          this.captureFrame();
      }
      
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
          if (this.mode === 'face' && !this.updateSources.has('vmc')) {
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
              let filter = this.boneFilters.get(boneName);
              if (!filter) {
                  const isVMC = this.updateSources.has('vmc');
                  const minCutoff = isVMC ? 1.0 : (boneName.toLowerCase().includes('head') ? SMOOTHING.HEAD_MIN_CUTOFF : SMOOTHING.MIN_CUTOFF);
                  const beta = isVMC ? 0.3 : SMOOTHING.BETA; 
                  
                  filter = new OneEuroFilterQuat(minCutoff, beta);
                  this.boneFilters.set(boneName, filter);
              }

              const smoothed = filter.filter(targetQ.x, targetQ.y, targetQ.z, targetQ.w, timestamp);
              
              node.quaternion.set(smoothed.x, smoothed.y, smoothed.z, smoothed.w);
          }
      });

      // 3. Smooth Root Position
      if ((this.mode === 'full' && this.targetRootPosition) || (this.updateSources.has('vmc') && this.targetRootPosition)) {
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
      
      const boneTracks: Record<string, { times: number[], values: number[], type: 'quaternion' | 'vector' }> = {};

      this.recordedFrames.forEach(frame => {
          Object.entries(frame.bones).forEach(([boneName, data]) => {
             if (!boneTracks[`${boneName}.quaternion`]) {
                 boneTracks[`${boneName}.quaternion`] = { times: [], values: [], type: 'quaternion' };
             }
             boneTracks[`${boneName}.quaternion`].times.push(frame.time);
             boneTracks[`${boneName}.quaternion`].values.push(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);

             if (data.position) {
                 if (!boneTracks[`${boneName}.position`]) {
                     boneTracks[`${boneName}.position`] = { times: [], values: [], type: 'vector' };
                 }
                 boneTracks[`${boneName}.position`].times.push(frame.time);
                 boneTracks[`${boneName}.position`].values.push(data.position.x, data.position.y, data.position.z);
             }
          });
      });

      Object.entries(boneTracks).forEach(([name, data]) => {
          if (data.type === 'quaternion') {
              tracks.push(new THREE.QuaternionKeyframeTrack(name, data.times, data.values));
          } else {
              tracks.push(new THREE.VectorKeyframeTrack(name, data.times, data.values));
          }
      });

      return new THREE.AnimationClip(`Mocap_Take_${Date.now()}`, duration, tracks);
  }

  calibrate() {
    this.calibrateBody();
    this.calibrateFace();
  }

  calibrateBody() {
    if (!this.vrm?.humanoid) return;
    console.log('[MotionCaptureManager] Calibrating Body Offsets...');
    this.calibrationOffsets = {};
    this.hipsRefPosition = null; 
    this.shouldCalibrateBody = true;
  }

  calibrateFace() {
    if (!this.vrm?.humanoid) return;
    console.log('[MotionCaptureManager] Calibrating Face/Eye Gaze Offsets...');
    this.eyeCalibrationOffset = { x: 0, y: 0 };
    this.shouldCalibrateFace = true;
  }

  /**
   * Captures a still frame from the webcam and uses AI to "Interpret" the pose.
   * This acts as an "Under the Hood" corrector/enhancer for the vision data.
   */
  async aiInterpret(prompt?: string) {
      if (!this.isTracking || !this.videoElement) {
          console.warn('[MotionCaptureManager] Cannot AI interpret: Tracking not active');
          return;
      }

      try {
          const frame = this.captureWebcamFrame();
          if (!frame) return;

          const { geminiService } = await import('../services/gemini');
          const result = await geminiService.interpretWebcam(frame, prompt);
          
          if (result && result.vrmPose) {
              console.log('[MotionCaptureManager] AI Interpretation applied');
              // Apply smoothly over 0.5s to avoid a "pop"
              const { avatarManager } = await import('../three/avatarManager');
              await avatarManager.applyRawPose({
                  vrmPose: result.vrmPose,
                  expressions: result.expressions
              }, 'static', true);
          }
      } catch (error) {
          console.error('[MotionCaptureManager] AI Interpretation failed:', error);
      }
  }

  private captureWebcamFrame(): string | null {
      if (!this.videoElement || this.videoElement.videoWidth === 0) return null;

      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(this.videoElement, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
  }

  private applyPoseRig(rig: any) {
    if (!this.vrm?.humanoid) return;
    const getVRMBoneName = (key: string): string => {
        if (key === 'Hips') return 'hips';
        return key.charAt(0).toLowerCase() + key.slice(1);
    };
    if (this.shouldCalibrateBody) {
        const rigKeys = Object.keys(rig);
        rigKeys.forEach(key => {
            const boneData = rig[key];
            if (boneData?.rotation) {
                const q = new THREE.Quaternion(boneData.rotation.x, boneData.rotation.y, boneData.rotation.z, boneData.rotation.w);
                this.calibrationOffsets[key] = q.clone();
            }
        });
        if (rig.Hips?.position) {
            this.hipsRefPosition = new THREE.Vector3(rig.Hips.position.x, rig.Hips.position.y, rig.Hips.position.z);
        }
        this.shouldCalibrateBody = false;
    }
    const setTargetRotation = (key: string, rotation: { x: number, y: number, z: number, w?: number }) => {
        const boneName = getVRMBoneName(key);
        // @ts-ignore
        if (rotation.w !== undefined) {
            const targetQ = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
            if (this.calibrationOffsets[key]) {
                const invCalibration = this.calibrationOffsets[key].clone().invert();
                targetQ.multiply(invCalibration);
            }
            const euler = new THREE.Euler().setFromQuaternion(targetQ, 'XYZ');
            const deg = {
                x: THREE.MathUtils.radToDeg(euler.x),
                y: THREE.MathUtils.radToDeg(euler.y),
                z: THREE.MathUtils.radToDeg(euler.z)
            };
            const constrained = motionEngine.constrainRotation(boneName, deg);
            targetQ.setFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(constrained.x),
                THREE.MathUtils.degToRad(constrained.y),
                THREE.MathUtils.degToRad(constrained.z),
                'XYZ'
            ));
            this.targetBoneRotations.set(boneName, targetQ);
        }
    };
    const rigKeys = Object.keys(rig);
    rigKeys.forEach(key => {
        const boneData = rig[key];
        if (key === 'Hips') {
            setTargetRotation('Hips', boneData.rotation!);
            if (boneData.position) {
                const pos = boneData.position;
                let x = pos.x; let y = pos.y; let z = pos.z;
                if (this.hipsRefPosition) {
                    x -= this.hipsRefPosition.x;
                    y -= this.hipsRefPosition.y;
                    z -= this.hipsRefPosition.z;
                }
                const MOVE_SCALE = 1.5; 
                const restY = 1.0; 
                this.targetRootPosition = new THREE.Vector3(x * MOVE_SCALE, (y * MOVE_SCALE) + restY, z * MOVE_SCALE);
            }
        } else {
            if (boneData.rotation) setTargetRotation(key, boneData.rotation);
        }
    });
  }

  private applyFaceRig(rig: any) {
      const live2dData = { head: { x: 0, y: 0, z: 0 }, eye: { l: 1, r: 1 }, pupil: { x: 0, y: 0 }, mouth: { open: 0 } };
      if (this.shouldCalibrateFace) {
          if (rig.pupil) {
              this.eyeCalibrationOffset = { x: rig.pupil.x, y: rig.pupil.y };
              this.shouldCalibrateFace = false;
          }
      }
      const setExpressionTarget = (candidates: string[], value: number) => {
          candidates.forEach(name => { if (this.availableBlendshapes.has(name)) this.targetFaceValues.set(name, value); });
      };
      if (rig.head) {
             const headBone = this.vrm?.humanoid?.getNormalizedBoneNode('head');
             if (headBone) {
                const q = rig.head;
                const headQ = new THREE.Quaternion(q.x, q.y, q.z, q.w);
                const identityQ = new THREE.Quaternion();
                headQ.slerp(identityQ, HEAD_DAMPENING);
                this.targetBoneRotations.set('head', headQ);
                const euler = new THREE.Euler().setFromQuaternion(headQ, 'YXZ');
                live2dData.head = { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) };
             }
      }
      if (rig.eye) {
          const blinkL = 1 - rig.eye.l; const blinkR = 1 - rig.eye.r;
          setExpressionTarget(['BlinkLeft', 'blink_l', 'eyeBlinkLeft', 'LeftEyeBlink'], blinkL);
          setExpressionTarget(['BlinkRight', 'blink_r', 'eyeBlinkRight', 'RightEyeBlink'], blinkR);
          const blinkMax = Math.max(blinkL, blinkR);
          setExpressionTarget(['Blink', 'blink', 'eyeBlink'], blinkMax);
          live2dData.eye = { l: rig.eye.l, r: rig.eye.r };
      }
      if (rig.pupil) {
          const x = THREE.MathUtils.clamp((rig.pupil.x - this.eyeCalibrationOffset.x) * GAZE_SENSITIVITY, -1, 1);
          const y = THREE.MathUtils.clamp(-(rig.pupil.y - this.eyeCalibrationOffset.y) * GAZE_SENSITIVITY, -1, 1);
          live2dData.pupil = { x, y };
          const stabilizedX = Math.abs(x) < GAZE_DEADZONE ? 0 : x;
          const stabilizedY = Math.abs(y) < GAZE_DEADZONE ? 0 : y;
          const setARKitGaze = (xVal: number, yVal: number) => {
             if (xVal > 0) { 
                 setExpressionTarget(['eyeLookOutRight', 'LookRight'], xVal); setExpressionTarget(['eyeLookInLeft', 'LookLeft'], xVal);
                 setExpressionTarget(['eyeLookInRight', 'LookLeft'], 0); setExpressionTarget(['eyeLookOutLeft', 'LookRight'], 0);
             } else { 
                 setExpressionTarget(['eyeLookInRight', 'LookLeft'], -xVal); setExpressionTarget(['eyeLookOutLeft', 'LookRight'], -xVal);
                 setExpressionTarget(['eyeLookOutRight', 'LookRight'], 0); setExpressionTarget(['eyeLookInLeft', 'LookLeft'], 0);
             }
             if (yVal > 0) { 
                 setExpressionTarget(['eyeLookDownRight', 'LookDown'], yVal); setExpressionTarget(['eyeLookDownLeft', 'LookDown'], yVal);
                 setExpressionTarget(['eyeLookUpRight', 'LookUp'], 0); setExpressionTarget(['eyeLookUpLeft', 'LookUp'], 0);
             } else { 
                 setExpressionTarget(['eyeLookUpRight', 'LookUp'], -yVal); setExpressionTarget(['eyeLookUpLeft', 'LookUp'], -yVal);
                 setExpressionTarget(['eyeLookDownRight', 'LookDown'], 0); setExpressionTarget(['eyeLookDownLeft', 'LookDown'], 0);
             }
          };
          setARKitGaze(stabilizedX, stabilizedY);
      }
      if (rig.mouth) {
          const shape = rig.mouth.shape;
          setExpressionTarget(['Aa', 'a', 'mouthOpen'], shape.A); setExpressionTarget(['Ee', 'e'], shape.E); setExpressionTarget(['Ih', 'i'], shape.I);
          setExpressionTarget(['Oh', 'o', 'mouthPucker'], shape.O); setExpressionTarget(['Ou', 'u', 'mouthFunnel'], shape.U);
          if (rig.mouth.open !== undefined) { setExpressionTarget(['jawOpen', 'mouthOpen', 'A'], rig.mouth.open); live2dData.mouth.open = rig.mouth.open; }
      }
      if (rig.smile !== undefined) {
          const smile = rig.smile;
          setExpressionTarget(['Joy', 'joy', 'Happy', 'happy', 'Fun', 'fun'], smile);
          setExpressionTarget(['mouthSmileLeft', 'mouthSmileRight'], smile); setExpressionTarget(['mouthSmile'], smile);
      }
      if (rig.brow) {
          setExpressionTarget(['browInnerUp', 'BrowsUp', 'browOuterUpLeft', 'browOuterUpRight', 'Surprised', 'surprise'], rig.brow);
      }
      live2dManager.updateFaceModel(live2dData);
  }

  private applyHandRig(rig: Record<string, { x: number, y: number, z: number }>, side: 'Left' | 'Right') {
      if (!this.vrm?.humanoid) return;
      const isLeft = side === 'Left';
      const boneMap: Record<string, VRMHumanBoneName> = {
          [`${side}Wrist`]: isLeft ? 'leftHand' : 'rightHand',
          [`${side}ThumbProximal`]: isLeft ? 'leftThumbMetacarpal' : 'rightThumbMetacarpal', [`${side}ThumbIntermediate`]: isLeft ? 'leftThumbProximal' : 'rightThumbProximal', [`${side}ThumbDistal`]: isLeft ? 'leftThumbDistal' : 'rightThumbDistal',
          [`${side}IndexProximal`]: isLeft ? 'leftIndexProximal' : 'rightIndexProximal', [`${side}IndexIntermediate`]: isLeft ? 'leftIndexIntermediate' : 'rightIndexIntermediate', [`${side}IndexDistal`]: isLeft ? 'leftIndexDistal' : 'rightIndexDistal',
          [`${side}MiddleProximal`]: isLeft ? 'leftMiddleProximal' : 'rightMiddleProximal', [`${side}MiddleIntermediate`]: isLeft ? 'leftMiddleIntermediate' : 'rightMiddleIntermediate', [`${side}MiddleDistal`]: isLeft ? 'leftMiddleDistal' : 'rightMiddleDistal',
          [`${side}RingProximal`]: isLeft ? 'leftRingProximal' : 'rightRingProximal', [`${side}RingIntermediate`]: isLeft ? 'leftRingIntermediate' : 'rightRingIntermediate', [`${side}RingDistal`]: isLeft ? 'leftRingDistal' : 'rightRingDistal',
          [`${side}LittleProximal`]: isLeft ? 'leftLittleProximal' : 'rightLittleProximal', [`${side}LittleIntermediate`]: isLeft ? 'leftLittleIntermediate' : 'rightLittleIntermediate', [`${side}LittleDistal`]: isLeft ? 'leftLittleDistal' : 'rightLittleDistal',
      };
      const clampRotation = (boneName: string, rotation: { x: number, y: number, z: number }) => {
          const isThumb = boneName.toLowerCase().includes('thumb'); const isWrist = boneName.toLowerCase().includes('hand');
          const range = isWrist ? HAND_CONSTRAINTS.WRIST : isThumb ? HAND_CONSTRAINTS.THUMB : HAND_CONSTRAINTS.FINGER;
          return { x: THREE.MathUtils.clamp(rotation.x, range.x[0], range.x[1]), y: THREE.MathUtils.clamp(rotation.y, range.y[0], range.y[1]), z: THREE.MathUtils.clamp(rotation.z, range.z[0], range.z[1]) };
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
