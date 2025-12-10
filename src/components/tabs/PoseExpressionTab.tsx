import { useState, useRef, useEffect } from 'react';
import { useReactionStore } from '../../state/useReactionStore';
import { avatarManager } from '../../three/avatarManager';
import { interactionManager } from '../../three/interactionManager';
import type { AnimationMode } from '../../types/reactions';
import { useToastStore } from '../../state/useToastStore';

export function PoseExpressionTab() {
  const { isAvatarReady, animationMode, setAnimationMode } = useReactionStore();
  const { addToast } = useToastStore();
  const [customPose, setCustomPose] = useState<any>(null);
  const [customPoseName, setCustomPoseName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const poseInputRef = useRef<HTMLInputElement>(null);

  // Expression State
  const [availableExpressions, setAvailableExpressions] = useState<string[]>([]);
  const [expressionWeights, setExpressionWeights] = useState<Record<string, number>>({});
  const [showExpressions, setShowExpressions] = useState(false);

  // Gizmo State
  const [isGizmoEnabled, setIsGizmoEnabled] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<'rotate' | 'translate'>('rotate');
  const [gizmoSpace, setGizmoSpace] = useState<'local' | 'world'>('local');

  useEffect(() => {
    return () => {
      // Cleanup gizmos on unmount
      interactionManager.toggle(false);
      avatarManager.setManualPosing(false);
    };
  }, []);

  const handleGizmoToggle = (enabled: boolean) => {
    setIsGizmoEnabled(enabled);
    interactionManager.toggle(enabled);
    avatarManager.setManualPosing(enabled);
    if (enabled) {
      // Force static mode to prevent fighting with animation mixer
      setAnimationMode('static');
      // Freeze the current pose instead of resetting it
      avatarManager.freezeCurrentPose();
    } else {
        // When disabling gizmos, re-enable standard updates
        // Optionally restart standard idle animation if desired, 
        // but for now we leave it static to preserve the manual edits visually
    }
  };

  const handleGizmoModeChange = (mode: 'rotate' | 'translate') => {
    setGizmoMode(mode);
    interactionManager.setGizmoMode(mode);
  };

  const handleGizmoSpaceChange = (space: 'local' | 'world') => {
    setGizmoSpace(space);
    interactionManager.setGizmoSpace(space);
  };

  useEffect(() => {
    if (isAvatarReady) {
      // Small delay to ensure VRM is fully initialized
      setTimeout(() => {
        const exprs = avatarManager.getAvailableExpressions();
        setAvailableExpressions(exprs);
        // Initialize weights to 0
        const weights: Record<string, number> = {};
        exprs.forEach(name => weights[name] = 0);
        setExpressionWeights(weights);
      }, 500);
    }
  }, [isAvatarReady]);

  const handleExpressionChange = (name: string, value: number) => {
    // 1. Update React state immediately for UI responsiveness
    setExpressionWeights(prev => ({ ...prev, [name]: value }));
    
    // 2. Throttle the expensive Three.js update using requestAnimationFrame
    if (!activeUpdateRef.current) {
      activeUpdateRef.current = requestAnimationFrame(() => {
        avatarManager.setExpressionWeight(name, value);
        activeUpdateRef.current = null;
      });
    }
  };

  const activeUpdateRef = useRef<number | null>(null);

  // Cleanup pending updates on unmount
  useEffect(() => {
    return () => {
      if (activeUpdateRef.current) {
        cancelAnimationFrame(activeUpdateRef.current);
      }
    };
  }, []);

  const handleResetExpressions = () => {
    const newWeights: Record<string, number> = {};
    availableExpressions.forEach(name => {
      newWeights[name] = 0;
      avatarManager.setExpressionWeight(name, 0);
    });
    setExpressionWeights(newWeights);
  };

  const handlePoseUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
      addToast('Please select a JSON file', 'error');
      return;
    }
    
    try {
      const text = await file.text();
      const poseData = JSON.parse(text);
      
      if (!poseData.vrmPose && !poseData.tracks) {
        addToast('Invalid file (missing vrmPose or tracks)', 'error');
        return;
      }
      
      setCustomPose(poseData);
      
      // Clean up the name: remove extension and potential "PoseLab_" prefix
      let cleanName = file.name.replace('.json', '');
      if (cleanName.startsWith('PoseLab_')) {
        cleanName = cleanName.substring(8); // Remove 'PoseLab_'
      }
      setCustomPoseName(cleanName);
      
      // Auto-apply the custom pose
      await avatarManager.applyRawPose(poseData, animationMode);
      addToast('Pose applied successfully', 'success');
    } catch (error) {
      console.error('Failed to load pose:', error);
      addToast('Failed to parse JSON file', 'error');
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
      addToast('Please drop a JSON file', 'warning');
      return;
    }
    
    // Create a fake input event to reuse the upload handler
    const fakeInput = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
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
    avatarManager.resetPose();
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
        <h3>Manual Posing</h3>
        <p className="muted small">Click points on the avatar to rotate joints</p>
        
        <label className="checkbox-option" style={{ marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={isGizmoEnabled}
            onChange={(e) => handleGizmoToggle(e.target.checked)}
            disabled={!isAvatarReady}
          />
          <span>Enable Joint Controls</span>
        </label>

        {isGizmoEnabled && (
          <div className="gizmo-controls" style={{ 
            padding: '1rem', 
            background: 'rgba(0, 255, 214, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(0, 255, 214, 0.2)' 
          }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.5rem' }}>Gizmo Mode</label>
              <div className="button-group small">
                <button 
                  className={gizmoMode === 'rotate' ? 'secondary active' : 'secondary'}
                  onClick={() => handleGizmoModeChange('rotate')}
                  style={{ fontSize: '0.8rem' }}
                >Rotate</button>
                <button 
                  className={gizmoMode === 'translate' ? 'secondary active' : 'secondary'}
                  onClick={() => handleGizmoModeChange('translate')}
                  style={{ fontSize: '0.8rem' }}
                >Translate</button>
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.5rem' }}>Axis Space</label>
              <div className="button-group small">
                <button 
                  className={gizmoSpace === 'local' ? 'secondary active' : 'secondary'}
                  onClick={() => handleGizmoSpaceChange('local')}
                  style={{ fontSize: '0.8rem' }}
                >Local</button>
                <button 
                  className={gizmoSpace === 'world' ? 'secondary active' : 'secondary'}
                  onClick={() => handleGizmoSpaceChange('world')}
                  style={{ fontSize: '0.8rem' }}
                >World</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tab-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Expressions</h3>
          <button 
            className="secondary small" 
            onClick={() => setShowExpressions(!showExpressions)}
            disabled={!isAvatarReady || availableExpressions.length === 0}
          >
            {showExpressions ? 'Hide' : 'Show'} ({availableExpressions.length})
          </button>
        </div>

        {showExpressions && (
          <div className="expressions-panel" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
             <button 
              className="secondary full-width" 
              onClick={handleResetExpressions}
              style={{ marginBottom: '1rem' }}
            >
              Reset All Expressions
            </button>

            {availableExpressions.length > 0 ? (
              <div className="expression-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                {availableExpressions.map((name) => (
                  <div key={name} className="expression-control" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ flex: '1', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>
                      {name}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={expressionWeights[name] || 0}
                      onChange={(e) => handleExpressionChange(name, parseFloat(e.target.value))}
                      style={{ flex: '2' }}
                    />
                    <span style={{ fontSize: '0.75rem', width: '30px', textAlign: 'right' }}>
                      {(expressionWeights[name] || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">No expressions found on this avatar.</p>
            )}
          </div>
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

