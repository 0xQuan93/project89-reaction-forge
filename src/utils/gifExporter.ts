/**
 * Animation Export Utility
 * WebM export with optional conversion to GIF
 */

export interface ExportOptions {
  duration: number; // Total duration in seconds
  fps?: number; // Frames per second (default: 30)
  onProgress?: (progress: number) => void; // Progress callback (0-1)
  width?: number; // Target width (optional, uses canvas width if not provided)
  height?: number; // Target height (optional, uses canvas height if not provided)
}

/**
 * Export canvas animation as WebM
 * Note: For Twitter/X, use online converter (ezgif.com) to convert WebM → GIF
 */
export async function exportCanvasAsGif(
  canvas: HTMLCanvasElement,
  filename: string,
  options: ExportOptions
): Promise<void> {
  // Export as WebM (GIF libraries have compatibility issues)
  const webmFilename = filename.replace(/\.gif$/i, '.webm');
  console.log('[Exporter] Exporting as WebM (convert to GIF using ezgif.com for Twitter)');
  return exportAsWebM(canvas, options.duration, webmFilename, options.onProgress);
}

/**
 * Export animation as WebM video with logo overlay
 */
export async function exportAsWebM(
  canvas: HTMLCanvasElement,
  duration: number,
  filename: string,
  onProgress?: (progress: number) => void,
  options?: { width?: number; height?: number }
): Promise<void> {
  const targetWidth = options?.width || canvas.width;
  const targetHeight = options?.height || canvas.height;
  
  console.log('[VideoExporter] Starting WebM recording with logo...', {
    targetWidth,
    targetHeight,
    canvasSize: { width: canvas.width, height: canvas.height },
    canvasClientSize: { width: canvas.clientWidth, height: canvas.clientHeight }
  });
  
  // Verify canvas dimensions match target (they should after renderer.setSize)
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    console.warn('[VideoExporter] Canvas dimensions do not match target!', {
      canvas: `${canvas.width}x${canvas.height}`,
      target: `${targetWidth}x${targetHeight}`
    });
  }

  if (!canExportVideo()) {
    throw new Error('Browser does not support video recording');
  }

  // Create composite canvas with logo at target resolution
  // This is an off-screen canvas used for captureStream
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = targetWidth;
  compositeCanvas.height = targetHeight;
  const ctx = compositeCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot get 2D context');
  }

  // Load logo
  const logo = await loadLogoImage();
  
  // Calculate logo dimensions (8% of composite canvas width)
  const logoWidth = compositeCanvas.width * 0.08;
  const logoHeight = logo ? (logo.height / logo.width) * logoWidth : 0;
  const padding = 20;
  const logoX = compositeCanvas.width - logoWidth - padding;
  const logoY = compositeCanvas.height - logoHeight - padding;

  // Start compositing at 30 fps
  const fps = 30;
  const frameInterval = 1000 / fps;
  let lastFrameTime = 0;

  const drawFrame = () => {
    // Clear the composite canvas
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    
    // Draw the WebGL canvas content to the composite canvas
    // The renderer should have rendered at targetWidth x targetHeight
    // and the canvas element's width/height should match (set by renderer.setSize)
    // Draw the entire canvas, scaling to fill the composite canvas
    // This ensures the background and all content fills the entire frame
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    
    // Draw logo with opacity
    if (logo) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      ctx.globalAlpha = 1.0;
    }
  };

  // Draw initial frame
  drawFrame();

  // Create stream from composite canvas
  const stream = compositeCanvas.captureStream(fps);
  
  // Try different codecs in order of preference
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  let mimeType = mimeTypes[0];
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type;
      break;
    }
  }

  console.log('[VideoExporter] Using codec:', mimeType);

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2500000, // 2.5 Mbps
  });

  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // Continuously composite frames
  const compositeInterval = setInterval(() => {
    const now = Date.now();
    if (now - lastFrameTime >= frameInterval) {
      drawFrame();
      lastFrameTime = now;
    }
  }, frameInterval);

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      clearInterval(compositeInterval);
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      console.log('[VideoExporter] WebM export complete:', {
        size: `${(blob.size / 1024).toFixed(2)} KB`,
      });
      onProgress?.(1.0);
      resolve();
    };

    mediaRecorder.onerror = (error) => {
      clearInterval(compositeInterval);
      console.error('[VideoExporter] Recording error:', error);
      reject(error);
    };

    // Start recording
    mediaRecorder.start();
    console.log('[VideoExporter] Recording started');

    // Update progress during recording
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 0.99);
      onProgress?.(progress);
    }, 100);

    // Stop after duration
    setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(compositeInterval);
      mediaRecorder.stop();
      console.log('[VideoExporter] Recording stopped');
    }, duration * 1000);
  });
}

/**
 * Load logo image for video compositing
 */
let cachedLogoImage: HTMLImageElement | null = null;

async function loadLogoImage(): Promise<HTMLImageElement | null> {
  if (cachedLogoImage) return cachedLogoImage;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedLogoImage = img;
      console.log('[VideoExporter] Logo loaded for compositing');
      resolve(img);
    };
    img.onerror = () => {
      console.warn('[VideoExporter] Failed to load logo');
      resolve(null);
    };
    img.src = '/logo/89-logo.svg';
  });
}

/**
 * Check if browser supports video recording
 */
export function canExportVideo(): boolean {
  return typeof MediaRecorder !== 'undefined' && 
         typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

