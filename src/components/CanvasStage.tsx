import { useEffect, useRef, useState } from 'react';
import { sceneManager } from '../three/sceneManager';
import { avatarManager } from '../three/avatarManager';
import { useReactionStore } from '../state/useReactionStore';
import type { ReactionPreset } from '../types/reactions';
import { useAvatarSource } from '../state/useAvatarSource';
import { OnboardingOverlay } from './OnboardingOverlay';

// Simple Toast Component for Errors
function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast-notification error" style={{
      position: 'fixed',
      top: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(255, 50, 50, 0.1)',
      border: '1px solid #ff4444',
      color: '#ff4444',
      padding: '0.75rem 1.5rem',
      borderRadius: '25px',
      backdropFilter: 'blur(10px)',
      zIndex: 2000,
      fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      animation: 'slideDown 0.3s ease-out'
    }}>
      ⚠️ {message}
    </div>
  );
}

export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const preset = useReactionStore((state) => state.activePreset);
  const avatarReady = useReactionStore((state) => state.isAvatarReady);
  const setAvatarReady = useReactionStore((state) => state.setAvatarReady);
  const animationMode = useReactionStore((state) => state.animationMode);
  const sourceUrl = useAvatarSource((state) => state.currentUrl);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sceneManager.init(canvas);
    return () => sceneManager.dispose();
  }, []);

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    
    // Start Loading
    setAvatarReady(false);
    setIsLoading(true);
    setErrorMessage(null);
    console.log('[CanvasStage] Loading avatar from:', sourceUrl);
    
    avatarManager
      .load(sourceUrl)
      .then(() => {
        if (cancelled) return;
        console.log('[CanvasStage] Avatar loaded successfully');
        setAvatarReady(true);
        const currentPreset = useReactionStore.getState().activePreset;
        console.log('[CanvasStage] Applying initial preset:', currentPreset.id);
        applyPreset(currentPreset);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[CanvasStage] Failed to load VRM:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load VRM file');
        // Reset to allow retrying
        setAvatarReady(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
      
    return () => {
      cancelled = true;
    };
  }, [sourceUrl, setAvatarReady]);

  useEffect(() => {
    if (!avatarReady) return;
    console.log('[CanvasStage] Preset or animation mode changed, applying:', preset.id, animationMode);
    applyPreset(preset);
  }, [preset, avatarReady, animationMode]);

  const applyPreset = (currentPreset: ReactionPreset) => {
    // Use preset's animation settings or fall back to global animation mode
    const animated = currentPreset.animated ?? (animationMode !== 'static');
    const mode = currentPreset.animationMode ?? animationMode;
    console.log('[CanvasStage] Applying preset with animation:', { animated, mode });
    
    avatarManager.applyPose(currentPreset.pose, animated, mode);
    avatarManager.applyExpression(currentPreset.expression);
    sceneManager.setBackground(currentPreset.background);
  };

  return (
    <div className="canvas-container">
      <OnboardingOverlay />
      
      {isLoading && (
        <div className="loading-overlay" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', zIndex: 20, backdropFilter: 'blur(5px)',
          flexDirection: 'column', gap: '1rem'
        }}>
          <div className="spinner" style={{
            width: '40px', height: '40px', border: '3px solid rgba(0,255,214,0.3)',
            borderTopColor: '#00ffd6', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ color: '#00ffd6', fontWeight: 600 }}>Loading Avatar...</span>
        </div>
      )}

      {errorMessage && (
        <ErrorToast message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}

      <canvas ref={canvasRef} className="canvas-stage" />
    </div>
  );
}

