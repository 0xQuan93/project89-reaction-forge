import { useEffect, useRef } from 'react';
import { sceneManager } from '../three/sceneManager';
import { avatarManager } from '../three/avatarManager';
import { useReactionStore } from '../state/useReactionStore';
import type { ReactionPreset } from '../types/reactions';
import { useAvatarSource } from '../state/useAvatarSource';

export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const preset = useReactionStore((state) => state.activePreset);
  const avatarReady = useReactionStore((state) => state.isAvatarReady);
  const setAvatarReady = useReactionStore((state) => state.setAvatarReady);
  const animationMode = useReactionStore((state) => state.animationMode);
  const sourceUrl = useAvatarSource((state) => state.currentUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sceneManager.init(canvas);
    return () => sceneManager.dispose();
  }, []);

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    setAvatarReady(false);
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
        console.error('[CanvasStage] Failed to load VRM:', error);
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
      <canvas ref={canvasRef} className="canvas-stage" />
    </div>
  );
}

