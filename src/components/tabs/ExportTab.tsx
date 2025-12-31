import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { sceneManager } from '../../three/sceneManager';
import { useReactionStore } from '../../state/useReactionStore';
import { avatarManager } from '../../three/avatarManager';
import { exportAsWebM, canExportVideo } from '../../export/exportImage';
import { exportAsGLB } from '../../export/exportGLB';
import { useToastStore } from '../../state/useToastStore';

interface ExportTabProps {
  mode?: 'reactions' | 'poselab';
}

export function ExportTab({ mode = 'reactions' }: ExportTabProps) {
  const { activePreset, animationMode, isAvatarReady } = useReactionStore();
  const { addToast } = useToastStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'png' | 'webm' | 'glb'>('png');
  const [resolution, setResolution] = useState<'720p' | '1080p' | 'square'>('720p');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [transparentBg, setTransparentBg] = useState(false);

  // Set aspect ratio from sceneManager on mount to ensure consistent state
  useEffect(() => {
    // This just ensures we are aware of the current aspect ratio
    // The actual export uses sceneManager.getAspectRatio() directly
    sceneManager.getAspectRatio();
  }, []);

  const getExportDimensions = (): { width: number; height: number } => {
    switch (resolution) {
      case '720p':
        return { width: 1280, height: 720 };
      case 'square':
        return { width: 1080, height: 1080 };
      case '1080p': // Re-purposed as Vertical/Mobile
        return { width: 1080, height: 1920 };
      default:
        return { width: 1920, height: 1080 };
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Command/Control + S is pressed
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // Prevent browser save dialog
        if (!isAvatarReady || isExporting) return;
        
        handleExport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAvatarReady, isExporting, exportFormat, resolution, includeLogo, transparentBg]);

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
    addToast('✅ PNG Saved Successfully!', 'success');
  };

  const handleExportWebM = async () => {
    const canvas = sceneManager.getCanvas();
    if (!canvas) {
      addToast('Canvas not available', 'error');
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
        addToast('Start an animation first (import and play an FBX/GLTF animation in the Animations tab)', 'warning');
      } else {
        addToast('Start an animation first (select Loop or Play Once)', 'warning');
      }
      return;
    }

    if (!canExportVideo()) {
      addToast('Video export not supported in this browser', 'error');
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
        addToast('✅ WebM Exported Successfully!', 'success');
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
      addToast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportGLB = async () => {
    try {
      setIsExporting(true);
      const poseName = activePreset.label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `PoseLab_${poseName}`;
      await exportAsGLB(filename);
      addToast('✅ GLB Exported Successfully!', 'success');
    } catch (error) {
      console.error('GLB Export failed:', error);
      addToast('GLB Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (exportFormat === 'png') {
      handleExportPNG();
    } else if (exportFormat === 'webm') {
      handleExportWebM();
    } else {
      handleExportGLB();
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Format</h3>
        <div className="radio-group" style={{ flexDirection: 'column', gap: '8px' }}>
          <label className="radio-option">
            <input
              type="radio"
              name="format"
              value="png"
              checked={exportFormat === 'png'}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'webm' | 'glb')}
            />
            <span>PNG (Static Image)</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="format"
              value="webm"
              checked={exportFormat === 'webm'}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'webm' | 'glb')}
              disabled={!canExportVideo()}
            />
            <span>WebM (Video Animation)</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="format"
              value="glb"
              checked={exportFormat === 'glb'}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'webm' | 'glb')}
            />
            <span>GLB (3D Model + Animation)</span>
          </label>
        </div>
      </div>

      <div className="tab-section">
        <h3>Smart Presets</h3>
        {exportFormat === 'glb' ? (
          <p className="muted small">Exports the current avatar mesh with the currently playing animation clip baked in.</p>
        ) : (
          <>
            <p className="muted small">Quickly set resolution for common platforms</p>
            <div className="actions" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                className={resolution === '720p' ? 'secondary active' : 'secondary'}
                onClick={() => setResolution('720p')}
                title="1280x720 (YouTube Thumbnail)"
                style={{ flex: '1 1 100px' }}
              >
                Thumbnail (HD)
              </button>
              <button
                className={resolution === 'square' ? 'secondary active' : 'secondary'}
                onClick={() => setResolution('square')}
                title="1080x1080 (Instagram/Twitter)"
                style={{ flex: '1 1 100px' }}
              >
                Square (1:1)
              </button>
              <button
                className={resolution === '1080p' ? 'secondary active' : 'secondary'}
                onClick={() => setResolution('1080p')}
                title="1080x1920 (TikTok/Shorts/Reels)"
                style={{ flex: '1 1 100px' }}
              >
                Vertical (9:16)
              </button>
            </div>
          </>
        )}
      </div>

      <div className="tab-section">
        <h3>Options</h3>
        {exportFormat === 'glb' ? (
           <p className="muted small">GLB export includes standard materials and skeletal animation.</p>
        ) : (
          <>
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
          </>
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
