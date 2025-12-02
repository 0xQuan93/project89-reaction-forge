import { useState, useRef, useEffect } from 'react';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { avatarManager } from '../../three/avatarManager';
import { getMixamoAnimation } from '../../pose-lab/getMixamoAnimation';
import { convertAnimationToScenePaths } from '../../pose-lab/convertAnimationToScenePaths';
import { animationManager } from '../../three/animationManager';
import { useReactionStore } from '../../state/useReactionStore';

export function AnimationsTab() {
  const [animations, setAnimations] = useState<Array<{ name: string; duration: number; clip: THREE.AnimationClip }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentAnimation, setCurrentAnimation] = useState<THREE.AnimationClip | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAvatarReady = useReactionStore((state) => state.isAvatarReady);

  const loadMixamoFromBuffer = async (arrayBuffer: ArrayBuffer, fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    let mixamoRoot: THREE.Object3D;
    let loadedAnimations: THREE.AnimationClip[] = [];

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      const group = loader.parse(arrayBuffer, '');
      mixamoRoot = group;
      loadedAnimations = group.animations;
    } else {
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(arrayBuffer, '');
      mixamoRoot = gltf.scene || gltf;
      loadedAnimations = gltf.animations;
    }

    return { mixamoRoot, animations: loadedAnimations };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!/\.(fbx|gltf|glb)$/i.test(file.name)) {
      alert('Please select an FBX, GLTF, or GLB file');
      return;
    }

    if (!isAvatarReady) {
      alert('Please load a VRM avatar first');
      return;
    }

    setStatusMessage('Loading animation...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { mixamoRoot, animations: loadedAnimations } = await loadMixamoFromBuffer(arrayBuffer, file.name);

      if (!loadedAnimations || loadedAnimations.length === 0) {
        throw new Error('No animations found in file');
      }

      const vrm = avatarManager.getVRM();
      if (!vrm) {
        throw new Error('VRM not loaded');
      }

      // Step 1: Retarget the first animation from Mixamo to VRM bone names
      const vrmClip = getMixamoAnimation(loadedAnimations, mixamoRoot, vrm);
      if (!vrmClip) {
        throw new Error('Failed to retarget animation to VRM');
      }

      console.log('[AnimationsTab] Mixamo animation retargeted:', {
        name: vrmClip.name,
        duration: vrmClip.duration,
        tracks: vrmClip.tracks.length,
        sampleTrack: vrmClip.tracks[0]?.name
      });

      // Step 2: Convert bone names to scene paths (critical for animation to work)
      const scenePathClip = convertAnimationToScenePaths(vrmClip, vrm);
      scenePathClip.name = file.name.replace(/\.(fbx|gltf|glb)$/i, '');

      console.log('[AnimationsTab] Animation converted to scene paths:', {
        name: scenePathClip.name,
        duration: scenePathClip.duration,
        tracks: scenePathClip.tracks.length,
        sampleTrack: scenePathClip.tracks[0]?.name
      });

      // Add to animations list
      const newAnimation = {
        name: scenePathClip.name,
        duration: scenePathClip.duration,
        clip: scenePathClip,
      };

      setAnimations([...animations, newAnimation]);
      setStatusMessage(`✅ Loaded: ${newAnimation.name}`);

      // Auto-play the animation
      playAnimation(scenePathClip);
    } catch (error) {
      console.error('Failed to load animation:', error);
      setStatusMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    
    // Create fake input event
    const fakeInput = { target: { files: [file] } } as any;
    handleFileUpload(fakeInput);
  };

  const playAnimation = (clip: THREE.AnimationClip) => {
    const vrm = avatarManager.getVRM();
    if (!vrm) {
      setStatusMessage('❌ VRM not loaded');
      return;
    }

    setCurrentAnimation(clip);
    
    console.log('[AnimationsTab] Playing animation:', {
      name: clip.name,
      duration: clip.duration,
      tracks: clip.tracks.length,
      loop: isLooping,
      sampleTrack: clip.tracks[0]?.name
    });

    // Use avatarManager's playAnimationClip method
    // This properly sets up the animation state and render loop updates
    avatarManager.playAnimationClip(clip, isLooping);
    
    setStatusMessage(`▶️ Playing: ${clip.name}`);
  };

  const handlePlayAnimation = (animation: typeof animations[0]) => {
    playAnimation(animation.clip);
  };

  const handleStopAnimation = () => {
    avatarManager.stopAnimation();
    setCurrentAnimation(null);
    setStatusMessage('⏹️ Animation stopped');
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Import Animation</h3>
        <p className="muted small">Import FBX or GLTF animation from Mixamo</p>
        
        {!isAvatarReady && (
          <div className="status-card" style={{ marginBottom: '1rem' }}>
            <p className="muted small">⚠️ Please load a VRM avatar first (use the button in the header)</p>
          </div>
        )}
        
        <div
          className={`drop-zone ${isDragging ? 'active' : ''} ${!isAvatarReady ? 'disabled' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            if (isAvatarReady) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => isAvatarReady && fileInputRef.current?.click()}
          style={{ opacity: isAvatarReady ? 1 : 0.5, cursor: isAvatarReady ? 'pointer' : 'not-allowed' }}
        >
          <span className="drop-zone__icon">🎬</span>
          <div className="drop-zone__text">
            <strong>Drop FBX/GLTF here</strong>
            <small>Or click to browse</small>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".fbx,.gltf,.glb"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          disabled={!isAvatarReady}
        />

        {statusMessage && (
          <p className="muted small" style={{ marginTop: '0.5rem' }}>{statusMessage}</p>
        )}
      </div>

      {animations.length > 0 && (
        <>
          <div className="tab-section">
            <h3>Loaded Animations</h3>
            <div className="animation-list">
              {animations.map((anim, index) => (
                <div key={index} className="animation-item">
                  <div className="animation-item__info">
                    <strong>{anim.name}</strong>
                    <span>{anim.duration.toFixed(2)}s</span>
                  </div>
                  <button 
                    className="icon-button"
                    onClick={() => handlePlayAnimation(anim)}
                    title="Play animation"
                  >
                    {currentAnimation === anim.clip ? '⏸️' : '▶️'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="tab-section">
            <h3>Playback Controls</h3>
            
            <button
              className="secondary full-width"
              onClick={handleStopAnimation}
              style={{ marginBottom: '1rem' }}
            >
              ⏹️ Stop Animation
            </button>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={isLooping}
                onChange={(e) => {
                  setIsLooping(e.target.checked);
                  if (currentAnimation) {
                    // Restart animation with new loop setting
                    avatarManager.playAnimationClip(currentAnimation, e.target.checked);
                  }
                }}
              />
              <span>Loop animation</span>
            </label>

            <div className="slider-control">
              <label>
                <span>Playback Speed: {playbackSpeed.toFixed(1)}x</span>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={playbackSpeed}
                  onChange={(e) => {
                    const speed = parseFloat(e.target.value);
                    setPlaybackSpeed(speed);
                    avatarManager.setAnimationSpeed(speed);
                  }}
                />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

