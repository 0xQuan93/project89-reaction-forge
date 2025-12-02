import { sceneManager } from '../three/sceneManager';

interface ViewportOverlayProps {
  mode: 'reactions' | 'poselab';
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onStop?: () => void;
}

export function ViewportOverlay({ mode, isPlaying, onPlayPause, onStop }: ViewportOverlayProps) {
  const handleResetCamera = () => {
    // Reset camera to default position
    const canvas = sceneManager.getCanvas();
    if (canvas) {
      // This would need to be implemented in sceneManager
      console.log('Reset camera');
    }
  };

  return (
    <>
      {/* Camera controls - top left */}
      <div className="viewport-overlay top-left">
        <div className="camera-controls">
          <button
            className="icon-button"
            onClick={handleResetCamera}
            title="Reset camera"
          >
            🎥
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

