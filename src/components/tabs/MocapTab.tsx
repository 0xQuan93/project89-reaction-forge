import { useEffect, useRef, useState } from 'react';
import { MotionCaptureManager } from '../../utils/motionCapture';
import { avatarManager } from '../../three/avatarManager';
import { useAnimationStore } from '../../state/useAnimationStore';
import { useToastStore } from '../../state/useToastStore';
import { convertAnimationToScenePaths } from '../../pose-lab/convertAnimationToScenePaths';

import { sceneManager } from '../../three/sceneManager';

export function MocapTab() {
  const { addToast } = useToastStore();
  const { addAnimation } = useAnimationStore();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const managerRef = useRef<MotionCaptureManager | null>(null);
  const timerRef = useRef<number | null>(null);
  
  const [isGreenScreen, setIsGreenScreen] = useState(false);
  const [mocapMode, setMocapMode] = useState<'full' | 'face'>('full');

  useEffect(() => {
    if (videoRef.current && !managerRef.current) {
        managerRef.current = new MotionCaptureManager(videoRef.current);
    }
    
    return () => {
        if (managerRef.current) {
            managerRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleGreenScreen = () => {
      if (isGreenScreen) {
          // Revert to default background (midnight-circuit)
          sceneManager.setBackground('midnight-circuit');
          setIsGreenScreen(false);
      } else {
          // Set to Green Screen
          sceneManager.setBackground('green-screen');
          setIsGreenScreen(true);
      }
  };

  const handleModeChange = (mode: 'full' | 'face') => {
      setMocapMode(mode);
      if (managerRef.current) {
          managerRef.current.setMode(mode);
      }
      
      if (mode === 'face') {
          // Instead of resetting to T-pose, play a default animation (loop)
          // Ideally "Sunset Call" as requested, or keep current if playing.
          if (!avatarManager.isAnimationPlaying()) {
             avatarManager.applyPose('sunset-call', true, 'loop');
             addToast("Switched to Face Only (Default: Sunset Call)", "info");
          } else {
             addToast("Switched to Face Only (Keeping Animation)", "info");
          }
      } else {
          // Switching back to Full Body
          // We should freeze the animation so the body doesn't fight the mocap
          avatarManager.freezeCurrentPose();
          addToast("Switched to Full Body mode (Animation Frozen)", "info");
      }
  };

  const toggleRecording = () => {
      if (!managerRef.current || !isActive) return;

      if (isRecording) {
          // Stop Recording
          const clip = managerRef.current.stopRecording();
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          setRecordingTime(0);

          if (clip) {
              const vrm = avatarManager.getVRM();
              if (vrm) {
                  try {
                      // Convert bone names to scene paths for playback
                      const sceneClip = convertAnimationToScenePaths(clip, vrm);
                      const name = `Mocap Take ${new Date().toLocaleTimeString()}`;
                      addAnimation(sceneClip, name);
                      addToast(`Recording saved: ${name}`, 'success');
                  } catch (e) {
                      console.error(e);
                      addToast('Failed to process recording', 'error');
                  }
              }
          } else {
              addToast('No motion data recorded', 'warning');
          }

      } else {
          // Start Recording
          managerRef.current.startRecording();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = window.setInterval(() => {
              setRecordingTime(t => t + 1);
          }, 1000);
      }
  };

  const toggleMocap = async () => {
    if (!managerRef.current) return;
    
    if (isActive) {
        managerRef.current.stop();
        setIsActive(false);
    } else {
        const vrm = avatarManager.getVRM();
        if (!vrm) {
            setError("Load an avatar first!");
            return;
        }
        
        try {
            // Check for secure context first
            if (!window.isSecureContext && window.location.hostname !== 'localhost') {
                throw new Error("Webcam access requires HTTPS (Secure Context).");
            }

            // In Face Only mode, we WANT the animation to keep playing.
            // In Full Body mode, we want to freeze so we can take over.
            if (mocapMode === 'full') {
                 // Freeze the current pose instead of resetting to T-pose
                 // This prevents the avatar from snapping to T-pose while the camera initializes
                 avatarManager.freezeCurrentPose();
            } else {
                 // Ensure we are playing something if idle
                 if (!avatarManager.isAnimationPlaying()) {
                     avatarManager.applyPose('sunset-call', true, 'loop');
                 }
            }
            
            managerRef.current.setVRM(vrm);
            await managerRef.current.start();
            setIsActive(true);
            setError(null);
        } catch (e: any) {
            console.error(e);
            let msg = "Failed to access webcam.";
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                msg = "Permission denied. Please allow camera access in your browser settings.";
            } else if (e.name === 'NotFoundError') {
                msg = "No camera found.";
            } else if (e.name === 'NotReadableError') {
                msg = "Camera is in use by another application.";
            } else if (e.message) {
                msg = e.message;
            }
            setError(msg);
        }
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>🎥 Webcam Motion Capture</h3>
        <p className="muted small">
            Control your avatar with your webcam. Requires good lighting and full body visibility for best results.
        </p>
        
        <div style={{ 
            position: 'relative', 
            width: '100%', 
            aspectRatio: '4/3', 
            background: '#000', 
            borderRadius: '8px', 
            overflow: 'hidden',
            marginBottom: '1rem'
        }}>
            <video 
                ref={videoRef} 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    transform: 'scaleX(-1)' // Mirror effect
                }} 
                playsInline 
                muted // Important to avoid feedback loop if mic is involved (though we don't use it)
            />
            {!isActive && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.5)'
                }}>
                    Camera Off
                </div>
            )}
        </div>

        {error && (
            <div className="error-message" style={{ marginBottom: '1rem', padding: '10px', background: 'rgba(255, 50, 50, 0.1)', border: '1px solid #ff5555', borderRadius: '4px' }}>
                {error}
                {error.includes("Permission") && (
                    <div style={{ marginTop: '5px', fontSize: '0.8em' }}>
                        👉 Check the lock icon 🔒 in your address bar to reset permissions.
                    </div>
                )}
            </div>
        )}

        {/* Mode Selection */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
                className={`secondary full-width ${mocapMode === 'full' ? 'active' : ''}`}
                onClick={() => handleModeChange('full')}
                title="Track both body and face"
            >
                🧍 Full Body
            </button>
            <button
                className={`secondary full-width ${mocapMode === 'face' ? 'active' : ''}`}
                onClick={() => handleModeChange('face')}
                title="Track face only (Body stays idle)"
            >
                👤 Face Only
            </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
            <button 
                className={`primary full-width ${isActive ? 'secondary' : ''}`}
                onClick={toggleMocap}
            >
                {isActive ? '🛑 Stop Camera' : '🎥 Start Camera'}
            </button>

            {isActive && (
                <>
                <button 
                    className={`primary full-width ${isRecording ? 'danger' : ''}`}
                    onClick={toggleRecording}
                >
                    {isRecording ? `⏹️ Stop (${recordingTime}s)` : '🔴 Record'}
                </button>
                <button
                    className="secondary full-width"
                    onClick={() => {
                        managerRef.current?.calibrate();
                        addToast("Calibrating T-Pose... Stand straight!", "info");
                    }}
                    title="Stand in T-Pose and click to calibrate offsets"
                >
                    📏 Calibrate
                </button>
                </>
            )}
            <button
                className={`secondary full-width ${isGreenScreen ? 'active' : ''}`}
                onClick={toggleGreenScreen}
                title="Toggle Green Screen Background"
            >
                🟩 Green Screen
            </button>
        </div>
      </div>
      
      <div className="tab-section">
          <h3>Instructions</h3>
          <ul className="small muted" style={{ paddingLeft: '1.2rem' }}>
              <li><strong>Face Only:</strong> Good for streaming/talking. Body stays still.</li>
              <li><strong>Full Body:</strong> Stand back to show your full body.</li>
              <li><strong>Calibration:</strong> Stand in a T-Pose and click "Calibrate" to align your body.</li>
              <li>Ensure good lighting on your face.</li>
          </ul>
      </div>
    </div>
  );
}

