import { useState } from 'react';
import { sceneManager } from '../../three/sceneManager';
import { useReactionStore } from '../../state/useReactionStore';
import { exportAsWebM, canExportVideo } from '../../utils/gifExporter';

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

  const getExportDimensions = (): { width: number; height: number } => {
    switch (resolution) {
      case '720p':
        return { width: 1280, height: 720 };
      case '1080p':
        return { width: 1920, height: 1080 };
      case 'square':
        return { width: 1080, height: 1080 };
      default:
        return { width: 1920, height: 1080 };
    }
  };

  const handleExportPNG = async () => {
    const dimensions = getExportDimensions();
    console.log('[ExportTab] Exporting PNG with dimensions:', dimensions, 'includeLogo:', includeLogo);
    
    // Use the new captureSnapshot with resolution and logo options
    const dataUrl = await sceneManager.captureSnapshot({
      width: dimensions.width,
      height: dimensions.height,
      includeLogo: includeLogo,
    });
    
    if (!dataUrl) return;
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${activePreset.id}-${resolution}.png`;
    link.click();
  };

  const handleExportWebM = async () => {
    const canvas = sceneManager.getCanvas();
    if (!canvas) {
      alert('Canvas not available');
      return;
    }

    if (animationMode === 'static') {
      alert('Start an animation first (select Loop or Play Once)');
      return;
    }

    if (!canExportVideo()) {
      alert('Video export not supported in this browser');
      return;
    }

    const dimensions = getExportDimensions();
    console.log('[ExportTab] Exporting WebM with dimensions:', dimensions);

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Note: exportAsWebM currently uses canvas size
      // TODO: Implement resolution-specific rendering
      await exportAsWebM(canvas, 3, `${activePreset.id}-${resolution}.webm`, (progress) => {
        setExportProgress(Math.round(progress * 100));
      });
      alert('Export complete! For Twitter: convert at ezgif.com/webm-to-gif');
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

