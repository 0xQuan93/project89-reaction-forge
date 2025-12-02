import { useState, useRef } from 'react';
import { useReactionStore } from '../../state/useReactionStore';
import { avatarManager } from '../../three/avatarManager';
import type { AnimationMode } from '../../types/reactions';

export function PoseExpressionTab() {
  const { isAvatarReady, animationMode, setAnimationMode } = useReactionStore();
  const [customPose, setCustomPose] = useState<any>(null);
  const [customPoseName, setCustomPoseName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const poseInputRef = useRef<HTMLInputElement>(null);

  const handlePoseUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Please select a JSON file');
      return;
    }
    
    try {
      const text = await file.text();
      const poseData = JSON.parse(text);
      
      if (!poseData.vrmPose && !poseData.tracks) {
        alert('Invalid file (missing vrmPose or tracks)');
        return;
      }
      
      setCustomPose(poseData);
      setCustomPoseName(file.name.replace('.json', ''));
      
      // Auto-apply the custom pose
      await avatarManager.applyRawPose(poseData, animationMode);
    } catch (error) {
      console.error('Failed to load pose:', error);
      alert('Failed to parse JSON file');
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Please drop a JSON file');
      return;
    }
    
    // Create a fake input event to reuse the upload handler
    const fakeInput = { target: { files: [file] } } as any;
    await handlePoseUpload(fakeInput);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleClearPose = () => {
    setCustomPose(null);
    setCustomPoseName(null);
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Custom Pose</h3>
        <p className="muted small">Upload a pose JSON file exported from Pose Lab</p>
        
        <div
          className={`drop-zone ${isDragging ? 'active' : ''} ${customPose ? 'loaded' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => poseInputRef.current?.click()}
        >
          {customPose ? (
            <>
              <span className="drop-zone__icon">✅</span>
              <div className="drop-zone__text">
                <strong>{customPoseName}</strong>
                <small>Click to replace or drag another</small>
              </div>
            </>
          ) : (
            <>
              <span className="drop-zone__icon">📄</span>
              <div className="drop-zone__text">
                <strong>Drop JSON here</strong>
                <small>Or click to browse</small>
              </div>
            </>
          )}
        </div>
        
        <input
          ref={poseInputRef}
          type="file"
          accept=".json"
          onChange={handlePoseUpload}
          style={{ display: 'none' }}
        />

        {customPose && (
          <button
            className="secondary full-width"
            onClick={handleClearPose}
          >
            Clear Custom Pose
          </button>
        )}
      </div>

      <div className="tab-section">
        <h3>Animation Mode</h3>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="animationMode"
              value="static"
              checked={animationMode === 'static'}
              onChange={(e) => setAnimationMode(e.target.value as AnimationMode)}
            />
            <span>Static Pose</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="animationMode"
              value="once"
              checked={animationMode === 'once'}
              onChange={(e) => setAnimationMode(e.target.value as AnimationMode)}
            />
            <span>Play Once</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="animationMode"
              value="loop"
              checked={animationMode === 'loop'}
              onChange={(e) => setAnimationMode(e.target.value as AnimationMode)}
            />
            <span>Loop Animation</span>
          </label>
        </div>
      </div>

      {animationMode !== 'static' && (
        <button
          className="secondary full-width"
          onClick={() => avatarManager.stopAnimation()}
          disabled={!isAvatarReady}
        >
          Stop Animation
        </button>
      )}
    </div>
  );
}

