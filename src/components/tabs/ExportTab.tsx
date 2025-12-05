import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { sceneManager } from '../../three/sceneManager';
import { useReactionStore } from '../../state/useReactionStore';
import { avatarManager } from '../../three/avatarManager';
import { exportAsWebM, canExportVideo } from '../../utils/gifExporter';

type AspectRatio = '16:9' | '1:1' | '9:16';

interface ExportTabProps {
  mode?: 'reactions' | 'poselab';
}

export function ExportTab({ mode = 'reactions' }: ExportTabProps) {
  const { activePreset, animationMode, isAvatarReady } = useReactionStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'png' | 'webm'>('png');
  const [resolution, setResolution] = useState<'720p' | '1080p' | 'square'>('1080p');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [transparentBg, setTransparentBg] = useState(false);
  
  // Set aspect ratio from sceneManager on mount to ensure consistent state
  useEffect(() => {
    // This just ensures we are aware of the current aspect ratio
    // The actual export uses sceneManager.getAspectRatio() directly
    sceneManager.getAspectRatio();
  }, []);

  const getExportDimensions = (): { width: number; height: number } => {
    // Always get the current aspect ratio from sceneManager (not from state)
    // This ensures we use the latest value set in Scene tab
    const currentAspectRatio = sceneManager.getAspectRatio();
    
    // Get base resolution
    let baseWidth: number;
    let baseHeight: number;
    
    switch (resolution) {
      case '720p':
        baseWidth = 1280;
        baseHeight = 720;
        break;
      case '1080p':
        baseWidth = 1920;
        baseHeight = 1080;
        break;
      case 'square':
        baseWidth = 1080;
        baseHeight = 1080;
        break;
      default:
        baseWidth = 1920;
        baseHeight = 1080;
    }

    // If resolution is 'square', always use square dimensions regardless of aspect ratio
    if (resolution === 'square') {
      return { width: 1080, height: 1080 };
    }

    // Calculate dimensions based on aspect ratio from Scene tab
    const targetAspect = getAspectRatioValue(currentAspectRatio);
    
    if (targetAspect > 1) {
      // Landscape (16:9) - use width as base
      return { width: baseWidth, height: Math.round(baseWidth / targetAspect) };
    } else if (targetAspect < 1) {
      // Portrait (9:16) - use height as base
      return { width: Math.round(baseHeight * targetAspect), height: baseHeight };
    } else {
      // Square (1:1)
      const size = Math.min(baseWidth, baseHeight);
      return { width: size, height: size };
    }
  };

  const getAspectRatioValue = (ratio: AspectRatio): number => {
    switch (ratio) {
      case '16:9': return 16 / 9;
      case '1:1': return 1;
      case '9:16': return 9 / 16;
      default: return 16 / 9;
    }
  };

  const handleExportPNG = async () => {
    // Get current aspect ratio to ensure we're using the latest
    const currentAspectRatio = sceneManager.getAspectRatio();
    const dimensions = getExportDimensions();
    
    console.log('[ExportTab] Exporting PNG:', {
      dimensions,
      aspectRatio: currentAspectRatio,
      includeLogo,
      transparentBg
    });
    
    // Ensure camera aspect matches export aspect ratio
    const camera = sceneManager.getCamera();
    if (camera) {
      const exportAspect = dimensions.width / dimensions.height;
      camera.aspect = exportAspect;
      camera.updateProjectionMatrix();
    }
    
    // Use the new captureSnapshot with resolution, logo, and transparency options
    const dataUrl = await sceneManager.captureSnapshot({
      width: dimensions.width,
      height: dimensions.height,
      includeLogo: includeLogo,
      transparentBackground: transparentBg,
    });
    
    if (!dataUrl) return;
    
    // Generate filename with aspect ratio (unless it's the default 16:9 or square resolution)
    // Format: PoseLab_{preset-id}_{resolution}_{aspect-ratio}.png
    const poseName = activePreset.label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const aspectSuffix = resolution === 'square' ? '' : currentAspectRatio !== '16:9' ? `_${currentAspectRatio.replace(':', 'x')}` : '';
    const transparentSuffix = transparentBg ? '_transparent' : '';
    const filename = `PoseLab_${poseName}_${resolution}${aspectSuffix}${transparentSuffix}.png`;
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const handleExportWebM = async () => {
    const canvas = sceneManager.getCanvas();
    if (!canvas) {
      alert('Canvas not available');
      return;
    }

    // Check if animation is playing
    // In Pose Lab mode, check avatarManager directly
    // In Reactions mode, check animationMode from store
    const isAnimationPlaying = mode === 'poselab' 
      ? avatarManager.isAnimationPlaying()
      : animationMode !== 'static';

    if (!isAnimationPlaying) {
      if (mode === 'poselab') {
        alert('Start an animation first (import and play an FBX/GLTF animation in the Animations tab)');
      } else {
        alert('Start an animation first (select Loop or Play Once)');
      }
      return;
    }

    if (!canExportVideo()) {
      alert('Video export not supported in this browser');
      return;
    }

    // Get current aspect ratio to ensure we're using the latest from Scene tab
    const currentAspectRatio = sceneManager.getAspectRatio();
    const dimensions = getExportDimensions();
    
    console.log('[ExportTab] Exporting WebM:', {
      dimensions,
      aspectRatio: currentAspectRatio,
      resolution
    });

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Save current renderer state
      const renderer = sceneManager.getRenderer();
      if (!renderer) {
        throw new Error('Renderer not available');
      }

      const originalSize = new THREE.Vector2();
      renderer.getSize(originalSize);
      const camera = sceneManager.getCamera();
      const originalAspect = camera ? camera.aspect : undefined;

      // Temporarily resize renderer for high-res export
      // NOTE: We only resize the renderer, NOT the canvas element
      // The renderer will render to its internal buffer at target size
      // and we'll capture from that buffer via the composite canvas
      if (dimensions.width && dimensions.height) {
        // Resize renderer internal buffer (this is what actually renders)
        // The third parameter 'false' means don't update CSS, but it WILL update
        // the canvas element's width/height attributes to match the renderer size
        renderer.setSize(dimensions.width, dimensions.height, false);
        
        // Update camera aspect ratio to match target resolution
        if (camera) {
          camera.aspect = dimensions.width / dimensions.height;
          camera.updateProjectionMatrix();
        }
        
        console.log('[ExportTab] Renderer resized to:', dimensions.width, 'x', dimensions.height);
        console.log('[ExportTab] Canvas dimensions (auto-updated by renderer):', canvas.width, 'x', canvas.height);
        console.log('[ExportTab] Camera aspect:', camera?.aspect);
        
        // Force renderer to render at new size
        const scene = sceneManager.getScene();
        if (scene && camera) {
          renderer.render(scene, camera);
        }
        
        // Wait a few frames to ensure renderer has fully rendered at new size
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      try {
        // Generate filename with aspect ratio (unless it's the default 16:9 or square resolution)
        // Format: {preset-id|pose-lab}-{resolution}-{aspect-ratio}.webm
        const aspectSuffix = resolution === 'square' ? '' : currentAspectRatio !== '16:9' ? `-${currentAspectRatio.replace(':', 'x')}` : '';
        const baseName = mode === 'poselab'
          ? `pose-lab-${resolution}`
          : `${activePreset.id}-${resolution}`;
        const filename = `${baseName}${aspectSuffix}.webm`;

        // Export with target resolution
        await exportAsWebM(
          canvas, 
          3, 
          filename, 
          (progress) => {
            setExportProgress(Math.round(progress * 100));
          },
          { width: dimensions.width, height: dimensions.height }
        );
        alert('Export complete! For Twitter: convert at ezgif.com/webm-to-gif');
      } finally {
        // Always restore original renderer size and camera aspect
        // The renderer.setSize() will automatically restore canvas element dimensions
        renderer.setSize(originalSize.x, originalSize.y, false);
        if (camera && originalAspect !== undefined) {
          camera.aspect = originalAspect;
          camera.updateProjectionMatrix();
        }
        console.log('[ExportTab] Renderer restored to:', originalSize.x, 'x', originalSize.y);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleExport = () => {
    if (exportFormat === 'png') {
      handleExportPNG();
    } else {
      handleExportWebM();
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Format</h3>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="format"
              value="png"
              checked={exportFormat === 'png'}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'webm')}
            />
            <span>PNG (Static)</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="format"
              value="webm"
              checked={exportFormat === 'webm'}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'webm')}
              disabled={!canExportVideo()}
            />
            <span>WebM (Animation)</span>
          </label>
        </div>
      </div>

      <div className="tab-section">
        <h3>Resolution</h3>
        <p className="muted small">Select export resolution (uses current canvas render)</p>
        <div className="button-group">
          <button
            className={resolution === '720p' ? 'secondary active' : 'secondary'}
            onClick={() => setResolution('720p')}
            title="1280×720 pixels"
          >
            HD
          </button>
          <button
            className={resolution === '1080p' ? 'secondary active' : 'secondary'}
            onClick={() => setResolution('1080p')}
            title="1920×1080 pixels"
          >
            Full HD
          </button>
          <button
            className={resolution === 'square' ? 'secondary active' : 'secondary'}
            onClick={() => setResolution('square')}
            title="1080×1080 pixels"
          >
            Square
          </button>
        </div>
      </div>

      <div className="tab-section">
        <h3>Options</h3>
        <label className="checkbox-option">
          <input 
            type="checkbox" 
            checked={includeLogo}
            onChange={(e) => setIncludeLogo(e.target.checked)}
          />
          <span>Include logo overlay</span>
        </label>
        {exportFormat === 'png' && (
          <label className="checkbox-option">
            <input 
              type="checkbox"
              checked={transparentBg}
              onChange={(e) => setTransparentBg(e.target.checked)}
            />
            <span>Transparent background</span>
          </label>
        )}
      </div>

      <div className="tab-section">
        <button
          className="primary full-width large"
          onClick={handleExport}
          disabled={!isAvatarReady || isExporting}
        >
          {isExporting && exportProgress > 0
            ? `Exporting... ${exportProgress}%`
            : `Export ${exportFormat.toUpperCase()}`}
        </button>
        
        {isExporting && (
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${exportProgress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
