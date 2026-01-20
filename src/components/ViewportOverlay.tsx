import { useState, useEffect, useRef } from 'react';
import { sceneManager } from '../three/sceneManager';

import { usePopOutViewport } from '../hooks/usePopOutViewport';
import { useUIStore } from '../state/useUIStore';
import { MultiplayerPanel } from './MultiplayerPanel';
import { notifySceneChange } from '../multiplayer/avatarBridge';
import { useReactionStore } from '../state/useReactionStore';
import { useIntroStore } from '../state/useIntroStore';
import { useToastStore } from '../state/useToastStore';
import { useSceneSettingsStore } from '../state/useSceneSettingsStore';
import { reactionPresets } from '../data/reactions';
import { DEFAULT_LIGHT_SETTINGS, lightingManager, type LightSettings } from '../three/lightingManager';
import { 
  House, 
  User, 
  Cube, 
  Eye, 
  EyeSlash, 
  ArrowSquareOut, 
  ArrowSquareIn, 
  CaretLeft,
  CaretRight,
  Play, 
  Pause, 
  Stop, 
  VideoCamera,
  StopCircle,
  Clock,
  Dna,
  DiceFive
} from '@phosphor-icons/react';
import { useAvatarSource } from '../state/useAvatarSource';
import { useAvatarListStore } from '../state/useAvatarListStore';
import { live2dManager } from '../live2d/live2dManager';
import { getPoseLabTimestamp } from '../utils/exportNaming';

type AspectRatio = '16:9' | '1:1' | '9:16';

interface ViewportOverlayProps {
  mode: 'reactions' | 'poselab';
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onStop?: () => void;
}

export function ViewportOverlay({ mode, isPlaying, onPlayPause, onStop }: ViewportOverlayProps) {
  const { activeCssOverlay, setFocusModeActive } = useUIStore();
  const { randomize, isAvatarReady, setPresetById } = useReactionStore();
  const { autoCaptures, addAutoCapture, clearAutoCaptures } = useIntroStore();
  const { addToast } = useToastStore();
  const { lightingPreset, setLightingPreset } = useSceneSettingsStore();
  const { isPoppedOut, togglePopOut } = usePopOutViewport(activeCssOverlay);
  const { avatarType, setRemoteUrl } = useAvatarSource();
  const { fetchAvatars, getRandomAvatar, isLoading: isAvatarListLoading } = useAvatarListStore();
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [showClock, setShowClock] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [isFocusSprintActive, setIsFocusSprintActive] = useState(false);
  const [showFocusGallery, setShowFocusGallery] = useState(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(30);
  const [focusCaptureIndex, setFocusCaptureIndex] = useState(0);
  // const [focusShotsCaptured, setFocusShotsCaptured] = useState(0); // Removing unused state to fix lint error
  const poseTimerRef = useRef<number | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const endTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const captureCountRef = useRef(0);
  const lightingPresetRef = useRef(lightingPreset);
  const sprintPresets = reactionPresets.filter((preset) => preset.id !== 'point');
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Ensure avatar list is loaded
    fetchAvatars();
  }, [fetchAvatars]);

  useEffect(() => {
    if (!showFocusGallery) return;
    setFocusCaptureIndex((prev) => {
      if (autoCaptures.length === 0) return 0;
      return Math.min(prev, autoCaptures.length - 1);
    });
  }, [autoCaptures.length, showFocusGallery]);

  useEffect(() => {
    if (!showFocusGallery) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevCapture();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNextCapture();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFocusGallery, autoCaptures.length]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      // Stop Recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop audio tracks we requested
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getAudioTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
      }
      
      setIsRecording(false);
    } else {
      // Start Recording
      const canvas = avatarType === 'live2d' ? live2dManager.getCanvas() : sceneManager.getCanvas();
      if (!canvas) {
        addToast('No canvas available to record', 'error');
        return;
      }

      try {
        const stream = canvas.captureStream(30); // 30 FPS
        
        // Request Microphone access
        let audioStream: MediaStream | null = null;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          recordingStreamRef.current = audioStream;
          console.log('[ViewportOverlay] Microphone access granted for recording');
        } catch (err) {
          console.warn('[ViewportOverlay] Microphone access denied or failed, recording video only.', err);
          addToast('Microphone access denied. Recording video only.', 'warning');
        }

        // Combine video and audio tracks if available
        const tracks = [...stream.getVideoTracks()];
        if (audioStream) {
          tracks.push(...audioStream.getAudioTracks());
        }
        const combinedStream = new MediaStream(tracks);
        
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm';

        const recorder = new MediaRecorder(combinedStream, { mimeType });
        
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `PoseLab_Recording_${getPoseLabTimestamp()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          addToast('🎬 Video saved!', 'success');
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        addToast('🔴 Recording started...', 'success');
      } catch (e) {
        console.error('Recording failed:', e);
        addToast('Failed to start recording', 'error');
        setIsRecording(false);
        // Clean up stream if failed
        if (recordingStreamRef.current) {
           recordingStreamRef.current.getAudioTracks().forEach(track => track.stop());
           recordingStreamRef.current = null;
        }
      }
    }
  };

  // Sync with sceneManager on mount
  useEffect(() => {
    setAspectRatio(sceneManager.getAspectRatio());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    sceneManager.setAspectRatio(ratio);
    notifySceneChange({ aspectRatio: ratio });
  };

  const handleResetCamera = () => {
    sceneManager.resetCamera();
  };

  const handleRandomAvatar = () => {
    if (isAvatarListLoading) {
      addToast('Loading avatar matrix...', 'info');
      return;
    }
    const randomAvatar = getRandomAvatar();
    if (randomAvatar) {
      setRemoteUrl(randomAvatar.model_file_url, randomAvatar.name);
      addToast(`${randomAvatar.name} materialized.`, 'success');
    } else {
      addToast('Failed to find an avatar signal.', 'error');
    }
  };

  const handleHeadshotView = () => {
    sceneManager.setCameraPreset('headshot');
  };

  const handleQuarterView = () => {
    sceneManager.setCameraPreset('quarter');
  };

  const handleSideView = () => {
    sceneManager.setCameraPreset('side');
  };

  const stopFocusSprint = (showGallery: boolean) => {
    if (poseTimerRef.current) {
      window.clearInterval(poseTimerRef.current);
      poseTimerRef.current = null;
    }
    if (captureTimerRef.current) {
      window.clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    if (endTimerRef.current) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (lightingPresetRef.current) {
      setLightingPreset(lightingPresetRef.current);
    }
    setIsFocusSprintActive(false);
    setFocusModeActive(false);
    if (showGallery) {
      setFocusCaptureIndex(Math.max(0, autoCaptures.length - 1));
      setShowFocusGallery(true);
    }
  };

  useEffect(() => {
    return () => stopFocusSprint(false);
  }, []);

  const startFocusSprint = () => {
    if (isFocusSprintActive) return;
    if (!isAvatarReady) {
      addToast('Load an avatar before starting a sprint.', 'warning');
      return;
    }

    const focusDurationMs = 30000;
    const shotCount = 6;
    const poseIntervalMs = 3500;
    const captureIntervalMs = Math.max(3000, Math.floor(focusDurationMs / shotCount));
    const cameraPresets: Array<'headshot' | 'quarter' | 'side' | 'fullbody'> = [
      'headshot',
      'quarter',
      'side',
      'fullbody',
    ];
    clearAutoCaptures();
    captureCountRef.current = 0;
    // setFocusShotsCaptured(0);
    setFocusSecondsLeft(Math.ceil(focusDurationMs / 1000));
    setShowFocusGallery(false);
    setIsFocusSprintActive(true);
    setFocusModeActive(true);
    lightingPresetRef.current = lightingPreset;
    const studioSprintLighting: LightSettings = {
      ...DEFAULT_LIGHT_SETTINGS,
      keyLight: { ...DEFAULT_LIGHT_SETTINGS.keyLight, intensity: 3 },
    };
    lightingManager.applySettings(studioSprintLighting);
    useSceneSettingsStore.setState({
      lightingPreset: 'studio',
      lighting: studioSprintLighting,
    });
    addToast('PoseLab Sprint started — focus mode enabled.', 'info');

    const applyRandomPoseAndCamera = () => {
      const nextPreset = sprintPresets[Math.floor(Math.random() * sprintPresets.length)];
      if (nextPreset) {
        setPresetById(nextPreset.id);
      } else {
        randomize();
      }
      const nextCamera = cameraPresets[Math.floor(Math.random() * cameraPresets.length)];
      sceneManager.setCameraPreset(nextCamera);
    };

    applyRandomPoseAndCamera();
    poseTimerRef.current = window.setInterval(applyRandomPoseAndCamera, poseIntervalMs);

    const captureShot = async () => {
      if (captureCountRef.current >= shotCount) return;
      const dataUrl = await sceneManager.captureSnapshot({
        includeLogo: true,
        transparentBackground: false,
      });
      if (dataUrl) {
        addAutoCapture(dataUrl);
        captureCountRef.current += 1;
      }
    };

    captureShot();
    captureTimerRef.current = window.setInterval(captureShot, captureIntervalMs);

    countdownTimerRef.current = window.setInterval(() => {
      setFocusSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    endTimerRef.current = window.setTimeout(() => {
      setFocusSecondsLeft(0);
      stopFocusSprint(true);
      addToast('PoseLab Sprint complete — review your captures.', 'success');
    }, focusDurationMs);
  };

  const handleDownloadAll = () => {
    autoCaptures.forEach((dataUrl, index) => {
      handleDownloadCapture(dataUrl, index);
    });
  };

  const handleDownloadCapture = (dataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.download = `PoseLab_${getPoseLabTimestamp()}_sprint_${index + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handlePrevCapture = () => {
    if (autoCaptures.length === 0) return;
    setFocusCaptureIndex((prev) => (prev - 1 + autoCaptures.length) % autoCaptures.length);
  };

  const handleNextCapture = () => {
    if (autoCaptures.length === 0) return;
    setFocusCaptureIndex((prev) => (prev + 1) % autoCaptures.length);
  };

  return (
    <>
      {/* Camera controls - top left */}
      <div className="viewport-overlay top-left">
        <div className="camera-controls" style={{ alignItems: 'center' }}>
          <button
            className="icon-button"
            onClick={handleRandomAvatar}
            title={isAvatarListLoading ? "Loading avatars..." : "Load Random Avatar"}
            aria-label="Load Random Avatar"
            disabled={isAvatarListLoading}
          >
            <DiceFive size={18} weight="duotone" className={isAvatarListLoading ? "spin" : ""} />
          </button>
          
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }}></div>

          <button
            className="icon-button"
            onClick={handleHeadshotView}
            title="Headshot view [1]"
            aria-label="Headshot view"
          >
            <User size={18} weight="duotone" />
          </button>
          <button
            className="icon-button"
            onClick={handleQuarterView}
            title="3/4 view [3]"
            aria-label="Three quarter view"
          >
            <Cube size={18} weight="duotone" />
          </button>
          <button
            className="icon-button"
            onClick={handleSideView}
            title="Side view [5]"
            aria-label="Side view"
          >
            <Eye size={18} weight="duotone" />
          </button>
          <button
            className="icon-button"
            onClick={handleResetCamera}
            title="Home view [7]"
            aria-label="Home view"
          >
            <House size={18} weight="duotone" />
          </button>
          
          {/* Pop Out Toggle */}
          <button
            className={`icon-button ${isPoppedOut ? 'active' : ''}`}
            onClick={togglePopOut}
            title={isPoppedOut ? "Restore viewport" : "Pop out viewport"}
            aria-label={isPoppedOut ? "Restore viewport" : "Pop out viewport"}
            style={{ marginLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}
          >
            {isPoppedOut ? <ArrowSquareIn size={18} weight="duotone" /> : <ArrowSquareOut size={18} weight="duotone" />}
          </button>
          
          {/* Aspect Ratio Toggle */}
          <div style={{ 
            marginLeft: '0.5rem', 
            borderLeft: '1px solid rgba(255,255,255,0.1)', 
            paddingLeft: '0.5rem',
            display: 'flex',
            gap: '2px'
          }}>
            <button
              className={`icon-button ${aspectRatio === '16:9' ? 'active' : ''}`}
              onClick={() => handleAspectRatioChange('16:9')}
              title="16:9 Landscape"
              aria-label="16:9 aspect ratio"
              style={{ fontSize: '0.65rem', padding: '0.25rem 0.4rem' }}
            >
              16:9
            </button>
            <button
              className={`icon-button ${aspectRatio === '1:1' ? 'active' : ''}`}
              onClick={() => handleAspectRatioChange('1:1')}
              title="1:1 Square"
              aria-label="1:1 aspect ratio"
              style={{ fontSize: '0.65rem', padding: '0.25rem 0.4rem' }}
            >
              1:1
            </button>
            <button
              className={`icon-button ${aspectRatio === '9:16' ? 'active' : ''}`}
              onClick={() => handleAspectRatioChange('9:16')}
              title="9:16 Portrait"
              aria-label="9:16 aspect ratio"
              style={{ fontSize: '0.65rem', padding: '0.25rem 0.4rem' }}
            >
              9:16
            </button>
          </div>
        </div>
      </div>

      {mode === 'poselab' && (
        <div className="viewport-overlay bottom-center" style={{ pointerEvents: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onPlayPause && onStop && (
            <div className="playback-controls">
              <button
                className="icon-button"
                onClick={onPlayPause}
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              >
                {isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
              </button>
              <button
                className="icon-button"
                onClick={onStop}
                title="Stop"
                aria-label="Stop animation"
              >
                <Stop size={18} weight="fill" />
              </button>
            </div>
          )}

          <button
            className={`sprint-button-glow ${isFocusSprintActive ? 'active' : ''}`}
            onClick={isFocusSprintActive ? () => stopFocusSprint(true) : startFocusSprint}
            title={isFocusSprintActive ? `End PoseLab Sprint (${focusSecondsLeft}s left)` : 'Start PoseLab Sprint'}
            aria-label={isFocusSprintActive ? 'End PoseLab Sprint' : 'Start PoseLab Sprint'}
          >
            <Dna size={24} weight="duotone" />
          </button>
        </div>
      )}

      {/* Multiplayer widget - top right */}
      <div className="viewport-overlay top-right">
        <MultiplayerPanel compact />
      </div>

      {/* Clock widget - bottom left */}
      <div className="viewport-overlay bottom-left">
        <div className="clock-widget">
          {showClock ? (
            <span className="clock-time" aria-live="polite">
              {now.toLocaleTimeString()}
            </span>
          ) : (
            <div className="clock-placeholder" title="Clock hidden">
              <Clock size={20} weight="duotone" style={{ opacity: 0.5 }} />
            </div>
          )}
          <button
            className={`icon-button clock-toggle ${showClock ? 'active' : ''}`}
            onClick={() => setShowClock((prev) => !prev)}
            title={showClock ? 'Hide clock' : 'Show clock'}
            aria-label={showClock ? 'Hide clock' : 'Show clock'}
          >
            {showClock ? <EyeSlash size={18} weight="duotone" /> : <Eye size={18} weight="duotone" />}
          </button>
        </div>
      </div>

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

      {/* Recording Button - Bottom Right */}
      <div className="viewport-overlay bottom-right" style={{ pointerEvents: 'auto' }}>
        <button
          className={`recording-button ${isRecording ? 'recording' : ''}`}
          onClick={handleToggleRecording}
          title={isRecording ? "Stop Recording" : "Record Video"}
          aria-label={isRecording ? "Stop Recording" : "Record Video"}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            background: isRecording ? 'rgba(255, 68, 68, 0.8)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            boxShadow: isRecording 
              ? '0 0 15px #ff4444, 0 0 5px #ff4444' 
              : '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: isRecording ? 'scale(1.1)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (!isRecording) {
              e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)';
              e.currentTarget.style.background = 'rgba(255, 68, 68, 0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRecording) {
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
            }
          }}
        >
          {isRecording ? <StopCircle size={32} weight="fill" /> : <VideoCamera size={28} weight="fill" />}
        </button>
      </div>

      {showFocusGallery && (
        <div className="modal-overlay" onClick={() => setShowFocusGallery(false)}>
          <div className="modal-content focus-sprint-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFocusGallery(false)}>×</button>
            <h2>PoseLab Sprint Gallery</h2>
            <p className="muted">
              {autoCaptures.length === 0
                ? 'No captures yet — try another sprint to generate shots.'
                : `Captured ${autoCaptures.length} shots.`}
            </p>
            {autoCaptures.length > 0 && (
              <>
                <div className="focus-sprint-actions">
                  <button className="primary" onClick={handleDownloadAll}>
                    Download all
                  </button>
                  <button className="secondary" onClick={() => setShowFocusGallery(false)}>
                    Close
                  </button>
                </div>
                <div className="focus-sprint-carousel">
                  <button
                    className="focus-sprint-nav"
                    onClick={handlePrevCapture}
                    aria-label="Previous capture"
                    disabled={autoCaptures.length <= 1}
                  >
                    <CaretLeft size={20} weight="bold" />
                  </button>
                  <div className="focus-sprint-preview">
                    <img
                      src={autoCaptures[focusCaptureIndex]}
                      alt={`Sprint capture ${focusCaptureIndex + 1}`}
                    />
                    <div className="focus-sprint-preview-actions">
                      <span className="focus-sprint-count">
                        {focusCaptureIndex + 1} / {autoCaptures.length}
                      </span>
                      <button
                        className="secondary"
                        onClick={() => handleDownloadCapture(autoCaptures[focusCaptureIndex], focusCaptureIndex)}
                      >
                        Save capture
                      </button>
                    </div>
                  </div>
                  <button
                    className="focus-sprint-nav"
                    onClick={handleNextCapture}
                    aria-label="Next capture"
                    disabled={autoCaptures.length <= 1}
                  >
                    <CaretRight size={20} weight="bold" />
                  </button>
                </div>
                <div className="focus-sprint-gallery">
                  {autoCaptures.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className={`focus-sprint-thumb ${index === focusCaptureIndex ? 'active' : ''}`}
                    >
                      <button
                        className="focus-sprint-thumb-button"
                        onClick={() => setFocusCaptureIndex(index)}
                        aria-label={`View sprint capture ${index + 1}`}
                      >
                        <img src={url} alt={`Sprint capture ${index + 1}`} />
                      </button>
                      <button
                        className="focus-sprint-thumb-save"
                        onClick={() => handleDownloadCapture(url, index)}
                      >
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
