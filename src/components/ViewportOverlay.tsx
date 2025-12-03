import { sceneManager } from '../three/sceneManager';

interface ViewportOverlayProps {
  mode: 'reactions' | 'poselab';
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onStop?: () => void;
}

export function ViewportOverlay({ mode, isPlaying, onPlayPause, onStop }: ViewportOverlayProps) {
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
          >
            🏠
          </button>
          <button
            className="icon-button"
            onClick={handleFrontView}
            title="Front view"
          >
            👤
          </button>
          <button
            className="icon-button"
            onClick={handleQuarterView}
            title="3/4 view"
          >
            📐
          </button>
          <button
            className="icon-button"
            onClick={handleSideView}
            title="Side view"
          >
            👁️
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
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <button
              className="icon-button"
              onClick={onStop}
              title="Stop"
            >
              ⏹️
            </button>
          </div>
        </div>
      )}

      {/* Logo overlay - bottom right */}
      <div className="viewport-overlay bottom-right">
        <img
          src="/logo/89-logo.svg"
          alt="Logo"
          className="logo-overlay"
        />
      </div>
    </>
  );
}

