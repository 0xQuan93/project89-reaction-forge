import { Holistic, type Results } from '@mediapipe/holistic';
import * as Kalidokit from 'kalidokit';

/* eslint-disable no-restricted-globals */
const ctx: Worker = self as any;

let holistic: Holistic | null = null;

const HOLISTIC_CONFIG = {
  modelComplexity: 1 as const,
  smoothLandmarks: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
  refineFaceLandmarks: true,
};

// Helper to calculate smile (Kalidokit doesn't do this natively in the same way)
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

ctx.onmessage = async (e) => {
  const { type, image, width, height, timestamp } = e.data;

  if (type === 'init') {
    holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    });
    holistic.setOptions(HOLISTIC_CONFIG);
    holistic.onResults((results: Results) => {
      // Process results with Kalidokit immediately in worker
      const rigs: any = {};

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
        // Add custom smile calculation
        if (rigs.face) {
            rigs.face.smile = calculateSmile(results.faceLandmarks);
            // Stabilize
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

      // 4. Raw Landmarks (for debugging or direct usage if needed)
      // We pass 2D hand landmarks for UI visualization if needed
      rigs.landmarks = {
          leftHand: results.leftHandLandmarks,
          rightHand: results.rightHandLandmarks
      };

      ctx.postMessage({ type: 'result', rigs, timestamp });
    });
    console.log('[MocapWorker] Initialized');
  } 
  else if (type === 'frame' && holistic) {
    if (image) {
        await holistic.send({ image });
        // Close bitmap to free memory
        // @ts-ignore
        if (image.close) image.close();
    }
  }
};
