import { useEffect, useRef, useState } from 'react';
import { MotionCaptureManager } from '../../utils/motionCapture';
import { avatarManager } from '../../three/avatarManager';

export function MocapTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const managerRef = useRef<MotionCaptureManager | null>(null);

  useEffect(() => {
    if (videoRef.current && !managerRef.current) {
        managerRef.current = new MotionCaptureManager(videoRef.current);
    }
    
    return () => {
        if (managerRef.current) {
            managerRef.current.stop();
        }
    };
  }, []);

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

            // Stop any conflicting animation
            avatarManager.stopAnimation();
            
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

        <button 
            className={`primary full-width ${isActive ? 'danger' : ''}`}
            onClick={toggleMocap}
        >
            {isActive ? '🛑 Stop Capture' : '🎥 Start Capture'}
        </button>
      </div>
      
      <div className="tab-section">
          <h3>Instructions</h3>
          <ul className="small muted" style={{ paddingLeft: '1.2rem' }}>
              <li>Stand back to show your full body/upper body.</li>
              <li>Ensure good lighting on your face and body.</li>
              <li>Wait a moment for the AI model to initialize.</li>
          </ul>
      </div>
    </div>
  );
}

