import { sceneManager } from '../three/sceneManager';

import { usePopOutViewport } from '../hooks/usePopOutViewport';
import { useUIStore } from '../state/useUIStore';

interface ViewportOverlayProps {
  mode: 'reactions' | 'poselab';
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onStop?: () => void;
}

export function ViewportOverlay({ mode, isPlaying, onPlayPause, onStop }: ViewportOverlayProps) {
  const { activeCssOverlay } = useUIStore();
  const { isPoppedOut, togglePopOut } = usePopOutViewport(activeCssOverlay);

  const handleResetCamera = () => {
    sceneManager.resetCamera();
  };

  const handleFrontView = () => {
    sceneManager.setCameraPreset('front');
  };

  const handleQuarterView = () => {
    sceneManager.setCameraPreset('quarter');
  };

  const handleSideView = () => {
    sceneManager.setCameraPreset('side');
  };

  return (
    <>
      {/* Camera controls - top left */}
      <div className="viewport-overlay top-left">
        <div className="camera-controls">
          <button
            className="icon-button"
            onClick={handleResetCamera}
            title="Reset camera to default"
            aria-label="Reset camera to default"
          >
            🏠
          </button>
          <button
            className="icon-button"
            onClick={handleFrontView}
            title="Front view"
            aria-label="Front view"
          >
            👤
          </button>
          <button
            className="icon-button"
            onClick={handleQuarterView}
            title="3/4 view"
            aria-label="Three quarter view"
          >
            📐
          </button>
          <button
            className="icon-button"
            onClick={handleSideView}
            title="Side view"
            aria-label="Side view"
          >
            👁️
          </button>
          
          {/* Pop Out Toggle */}
          <button
            className={`icon-button ${isPoppedOut ? 'active' : ''}`}
            onClick={togglePopOut}
            title={isPoppedOut ? "Restore viewport" : "Pop out viewport"}
            aria-label={isPoppedOut ? "Restore viewport" : "Pop out viewport"}
            style={{ marginLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}
          >
            {isPoppedOut ? '🔙' : '↗️'}
          </button>
        </div>
      </div>

      {/* Playback controls - bottom center */}
      {mode === 'poselab' && onPlayPause && onStop && (
        <div className="viewport-overlay bottom-center">
          <div className="playback-controls">
            <button
              className="icon-button"
              onClick={onPlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <button
              className="icon-button"
              onClick={onStop}
              title="Stop"
              aria-label="Stop animation"
            >
              ⏹️
            </button>
          </div>
        </div>
      )}

      {/* Logo overlay - hidden but preserved for potential future use or reference */}
      {/* 
      <div className="viewport-overlay bottom-right">
        <img
          src="/logo/poselab.svg"
          alt="Logo"
          className="logo-overlay"
        />
      </div>
      */}
    </>
  );
}

