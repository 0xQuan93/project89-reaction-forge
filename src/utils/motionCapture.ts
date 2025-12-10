import { Holistic, type Results } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { VRM } from '@pixiv/three-vrm';
import * as Kalidokit from 'kalidokit';
import * as THREE from 'three';

export class MotionCaptureManager {
  private holistic: Holistic;
  private camera?: Camera;
  private vrm?: VRM;
  private videoElement: HTMLVideoElement;
  private isTracking = false;
  
  // Callback for UI visualization
  public onLandmarks?: (landmarks: any) => void;

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

  private handleResults = (results: Results) => {
    if (!this.vrm || (!results.poseLandmarks && !results.faceLandmarks)) return;
    
    if (this.onLandmarks) {
        this.onLandmarks(results.poseLandmarks);
    }

    // Solve Pose using Kalidokit
    // NOTE: Kalidokit expects poseWorldLandmarks but MediaPipe Holistic output calls it ea (in minified form) 
    // or sometimes it's missing. We can try using poseLandmarks for both if world is missing, 
    // but world landmarks are better for 3D rotation.
    // The @mediapipe/holistic types might differ slightly from actual runtime object or Kalidokit expectation.
    // We cast to any to bypass strict type checking on the results object for now.
    const poseWorldLandmarks = (results as any).poseWorldLandmarks || (results as any).ea;
    
    const poseRig = results.poseLandmarks ? Kalidokit.Pose.solve(results.poseLandmarks, poseWorldLandmarks, {
      runtime: 'mediapipe',
      video: this.videoElement
    }) : null;

    // Solve Face using Kalidokit
    const faceRig = results.faceLandmarks ? Kalidokit.Face.solve(results.faceLandmarks, {
      runtime: 'mediapipe',
      video: this.videoElement
    }) : null;

    if (poseRig) {
      this.applyPoseRig(poseRig);
    }
    if (faceRig) {
      this.applyFaceRig(faceRig);
    }
  };

  private applyPoseRig(rig: any) {
    if (!this.vrm?.humanoid) return;

    const rotateBone = (boneName: string, rotation: { x: number, y: number, z: number, w?: number }) => {
        const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName as any);
        if (node) {
            if (rotation.w !== undefined) {
                // Slerp for smooth transition
                node.quaternion.slerp(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w), 0.3);
            }
        }
    };

    const rigKeys = Object.keys(rig);
    
    rigKeys.forEach(key => {
        const boneData = rig[key];
        if (key === 'Hips') {
            const node = this.vrm!.humanoid!.getNormalizedBoneNode('hips');
            if (node && boneData.rotation) {
                 const q = boneData.rotation;
                 node.quaternion.slerp(new THREE.Quaternion(q.x, q.y, q.z, q.w), 0.3);
            }
            // Apply Hips Position (Scaled down a bit to fit VRM world scale)
            if (boneData.position && node) {
                 // Convert position to Vector3 and dampen
                 // Note: Kalidokit outputs normalized or pixel coords? usually requires scaling
                 // Kalidokit pose solver usually outputs world position deltas.
                 // Let's rely on rotation mainly for now to avoid "flying" glitches
                 // node.position.lerp(new THREE.Vector3(boneData.position.x, boneData.position.y, boneData.position.z), 0.1);
            }
        } else {
            if (boneData.rotation) {
                // Kalidokit -> VRM Bone Name Mapping
                const vrmBoneName = key.charAt(0).toLowerCase() + key.slice(1);
                rotateBone(vrmBoneName, boneData.rotation);
            }
        }
    });
    
    this.vrm.humanoid.update();
  }

  private applyFaceRig(rig: any) {
      if (!this.vrm?.expressionManager) return;

      // 1. Head Rotation
      if (rig.head) {
          const headBone = this.vrm.humanoid?.getNormalizedBoneNode('head');
          if (headBone) {
              const q = rig.head;
              // Mix head rotation from pose and face for stability?
              // Face mesh is usually more accurate for head orientation
              headBone.quaternion.slerp(new THREE.Quaternion(q.x, q.y, q.z, q.w), 0.5);
          }
      }

      // 2. Expressions / Blendshapes
      // Kalidokit Face outputs: eye: {l, r}, mouth: {shape: {A, E, I, O, U}, open}
      
      const em = this.vrm.expressionManager;

      // Blinking
      if (rig.eye) {
          const blinkL = 1 - rig.eye.l;
          const blinkR = 1 - rig.eye.r;
          em.setValue('BlinkLeft', blinkL);
          em.setValue('BlinkRight', blinkR);
          // Fallback for simple Blink
          if (blinkL > 0.5 && blinkR > 0.5) {
              em.setValue('Blink', (blinkL + blinkR) / 2);
          } else {
              em.setValue('Blink', 0);
          }
      }

      // Mouth
      if (rig.mouth) {
          const shape = rig.mouth.shape; // { A: 0-1, E: 0-1 ... }
          em.setValue('Aa', shape.A);
          em.setValue('Ee', shape.E);
          em.setValue('Ih', shape.I);
          em.setValue('Oh', shape.O);
          em.setValue('Ou', shape.U);
      }
      
      // Simple Emotion Mapping
      // Brow raise -> Surprise? 
      if (rig.brow) {
          // If brows are high, maybe surprise
          // Not strictly standard in Kalidokit Face rig output structure directly like this?
          // Kalidokit Face solver output structure:
          // { eye: {l, r}, mouth: {shape, open}, head: {x,y,z,w}, brow: 0-1, pupil: {x,y} }
      }

      em.update();
  }
}
