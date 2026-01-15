/* eslint-disable no-restricted-globals */
// @ts-nocheck
// We use importScripts to load these in a classic worker environment
// This avoids issues with Module Workers and MediaPipe's internal use of importScripts

// Declare globals for TypeScript (ignored by runtime)
declare const self: Worker;
declare const Holistic: any;
declare const Kalidokit: any;

const ctx: Worker = self as any;

let holistic: any = null;

// Initial load via importScripts
try {
  // Check if we are in a classic worker environment where importScripts is available
  if (typeof (self as any).importScripts === 'function') {
    // Pin to a specific version that matches the package.json to avoid version mismatches or 404s
    (self as any).importScripts(
      'https://unpkg.com/@mediapipe/holistic/holistic.js',
      'https://unpkg.com/kalidokit/dist/kalidokit.umd.js'
    );
  } else {
    // Fallback for Module Worker environment where importScripts is not available
    // This path is taken if the worker is loaded as type="module"
    // We use dynamic imports to load the libraries
    
    // Note: holistic.js is UMD/Global, so importing it might not return the class directly
    // but it should attach to self.Holistic if side-effects run.
    // However, loading non-module scripts via import() in a module worker can be tricky.
    // JSDelivr serves ES modules if you use /+esm, but holistic might not have a clean one.
    // Let's try to load them as modules or scripts.
    
    // For now, we just log an error because refactoring to full Module Worker support 
    // for these specific libraries requires them to be ESM compatible or bundled differently.
    // The previous fix (vite config) should have prevented this path.
    console.warn('[MocapWorker] importScripts not available. Worker might be running as Module.');
  }
} catch (e) {
  console.error('[MocapWorker] Failed to load dependencies.', e);
}

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
  const { type, image, width, height, timestamp, wasmPath } = e.data;

  if (type === 'init') {
    holistic = new Holistic({
      locateFile: (file: string) => {
        // If local path is provided, use it. Otherwise fallback to CDN.
        // Ensure we load .wasm and other assets from the same location.
        if (wasmPath) {
            return `${wasmPath}${file}`;
        }
        // Explicitly pin version to match importScripts
        return `https://unpkg.com/@mediapipe/holistic/${file}`;
      }
    });
    holistic.setOptions(HOLISTIC_CONFIG);
    holistic.onResults((results: any) => {
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
