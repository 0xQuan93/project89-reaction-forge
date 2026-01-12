import { useState, useEffect, useRef } from 'react';
import { useReactionStore } from '../state/useReactionStore';
import { useSceneSettingsStore } from '../state/useSceneSettingsStore';
import { sceneManager } from '../three/sceneManager';
import { avatarManager } from '../three/avatarManager';
import { reactionPresets } from '../data/reactions';
import { exportAsWebM, canExportVideo } from '../export/exportVideo';
import { useAvatarSource } from '../state/useAvatarSource';
import type { AnimationMode } from '../types/reactions';
import { 
  MaskHappy, 
  Package, 
  Trash, 
  File as FileIcon, 
  CheckCircle,
  PersonSimpleRun,
  Smiley,
  Armchair,
  CaretDown
} from '@phosphor-icons/react';

// Preset Categories
const PRESET_CATEGORIES = {
  action: {
    title: 'Action & Motion',
    icon: <PersonSimpleRun size={18} weight="duotone" />,
    ids: ['dawn-runner', 'nebula-drift', 'rope-climb', 'climb-top', 'treading-water']
  },
  emotes: {
    title: 'Emotes & Social',
    icon: <Smiley size={18} weight="duotone" />,
    ids: ['simple-wave', 'point', 'thumbs-up', 'cheering', 'agent-clapping', 'agent-dance', 'silly-agent', 'agent-taunt']
  },
  idle: {
    title: 'Idle & Mood',
    icon: <Armchair size={18} weight="duotone" />,
    ids: ['sunset-call', 'cipher-whisper', 'signal-reverie', 'offensive-idle', 'waking', 'defeat', 'focus']
  }
};

// Collapsible Section Component
function PresetSection({ 
  title, 
  icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  defaultOpen?: boolean; 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '0.6rem 0.8rem',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--accent)', display: 'flex' }}>{icon}</span>
          <span>{title}</span>
        </span>
        <CaretDown 
          size={14} 
          weight="bold"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>
      {isOpen && (
        <div style={{ 
          padding: '0.5rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '0 0 8px 8px',
          marginTop: '-4px',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.4rem'
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ReactionPanel() {
  const { nameInput, setNameInput, applyName, randomize, activePreset, isAvatarReady, setPresetById, animationMode, setAnimationMode } =
    useReactionStore();
  const [statusMessage, setStatusMessage] = useState(isAvatarReady ? 'Avatar ready' : 'Loading avatar...');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const poseInputRef = useRef<HTMLInputElement>(null);
  const { currentUrl: sourceUrl, setFileSource, sourceLabel, reset } = useAvatarSource();
  const [customPose, setCustomPose] = useState<any>(null);
  const [customPoseName, setCustomPoseName] = useState<string | null>(null);
  const [isDraggingPose, setIsDraggingPose] = useState(false);

  useEffect(() => {
    if (isAvatarReady) {
      setStatusMessage('Avatar ready');
    } else {
      setStatusMessage('Loading avatar...');
    }
  }, [isAvatarReady]);

  const handleApply = () => {
    const preset = applyName();
    setStatusMessage(`Loaded ${preset.label}`);
  };

  const handleRandomize = () => {
    const preset = randomize();
    setStatusMessage(`Randomized to ${preset.label}`);
  };

  const handleStopAnimation = () => {
    avatarManager.stopAnimation();
    setStatusMessage('Animation stopped');
  };

  const handleVRMUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      setStatusMessage('❌ Please select a VRM file');
      return;
    }
    
    setStatusMessage(`⏳ Loading VRM: ${file.name}...`);
    
    // Use a small timeout to allow UI to update with "Loading..." before the heavy load starts
    setTimeout(() => {
      setFileSource(file);
    }, 50);
  };

  const handleResetAvatar = () => {
    reset();
    setStatusMessage('✅ Reset to default avatar');
  };

  const handlePoseUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
      setStatusMessage('❌ Please select a JSON file');
      return;
    }
    
    try {
      const text = await file.text();
      const poseData = JSON.parse(text);
      
      // Validate it has the expected structure (either pose or animation)
      if (!poseData.vrmPose && !poseData.tracks) {
        setStatusMessage('❌ Invalid file (missing vrmPose or tracks)');
        return;
      }
      
      const fileType = poseData.tracks ? 'animation' : 'pose';
      setCustomPose(poseData);
      
      // Clean up the name: remove extension and potential "PoseLab_" prefix
      let cleanName = file.name.replace('.json', '');
      if (cleanName.startsWith('PoseLab_')) {
        cleanName = cleanName.substring(8); // Remove 'PoseLab_'
      }
      setCustomPoseName(cleanName);
      
      setStatusMessage(`✅ Loaded custom ${fileType}: ${cleanName}`);
      
      // Auto-apply the custom pose
      await applyCustomPose(poseData);
    } catch (error) {
      console.error('Failed to load pose:', error);
      setStatusMessage('❌ Failed to parse JSON file');
    }
  };

  const applyCustomPose = async (poseData: any) => {
    if (!isAvatarReady) {
      setStatusMessage('⏳ Wait for avatar to load');
      return;
    }

    try {
      // Apply the raw VRM pose data directly to avatarManager
      await avatarManager.applyRawPose(poseData, animationMode);
      
      // Apply a single expression only when no expression map is provided
      const hasExpressionMap =
        poseData.expressions &&
        typeof poseData.expressions === 'object' &&
        Object.keys(poseData.expressions).length > 0;
      if (!hasExpressionMap) {
        const expression = poseData.expression || 'calm';
        avatarManager.applyExpression(expression);
      }
      
      // Apply background if available, but only if not locked
      const { backgroundLocked } = useSceneSettingsStore.getState();
      if (!backgroundLocked) {
        const background = poseData.background || 'midnight-circuit';
        await sceneManager.setBackground(background);
      }
      
      setStatusMessage(`✅ Applied custom pose: ${customPoseName || 'Custom'}`);
    } catch (error) {
      console.error('[ReactionPanel] Failed to apply custom pose:', error);
      setStatusMessage(`❌ Failed to apply pose: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClearCustomPose = () => {
    setCustomPose(null);
    setCustomPoseName(null);
    setStatusMessage('✅ Cleared custom pose');
  };

  const handlePoseDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPose(false);
    
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
      setStatusMessage('❌ Please drop a JSON file');
      return;
    }
    
    try {
      const text = await file.text();
      const poseData = JSON.parse(text);
      
      // Validate it has the expected structure (either pose or animation)
      if (!poseData.vrmPose && !poseData.tracks) {
        setStatusMessage('❌ Invalid file (missing vrmPose or tracks)');
        return;
      }
      
      const fileType = poseData.tracks ? 'animation' : 'pose';
      setCustomPose(poseData);
      setCustomPoseName(file.name.replace('.json', ''));
      setStatusMessage(`✅ Loaded custom ${fileType}: ${file.name}`);
      
      await applyCustomPose(poseData);
    } catch (error) {
      console.error('Failed to load pose:', error);
      setStatusMessage('❌ Failed to parse JSON file');
    }
  };

  const handlePoseDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPose(true);
  };

  const handlePoseDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPose(false);
  };

  const handleExportWebM = async () => {
    const canvas = sceneManager.getCanvas();
    if (!canvas) {
      setStatusMessage('Canvas not available');
      return;
    }

    if (animationMode === 'static') {
      setStatusMessage('Start an animation first (select Loop or Play Once)');
      return;
    }

    if (!canExportVideo()) {
      setStatusMessage('Video export not supported in this browser');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setStatusMessage('Recording animation...');

    try {
      await exportAsWebM(canvas, 3, `${activePreset.id}.webm`, (progress: number) => {
        setExportProgress(Math.round(progress * 100));
        setStatusMessage(`Recording... ${Math.round(progress * 100)}%`);
      });
      setStatusMessage('✅ Exported! For Twitter: convert at ezgif.com/webm-to-gif');
    } catch (error) {
      console.error('Export failed:', error);
      setStatusMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleSave = async () => {
    const dataUrl = await sceneManager.captureSnapshot();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${activePreset.id}.png`;
    link.click();
  };

  const handleShare = async () => {
    const dataUrl = await sceneManager.captureSnapshot();
    if (!dataUrl) return;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], `${activePreset.id}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Project 89 Reaction',
        text: 'Check out this Project 89 avatar reaction.',
      });
    } else {
      window.open(dataUrl, '_blank');
    }
  };

  return (
    <section className="panel">
      <header>
        <h1>PoseLab</h1>
        <p className="muted">Load a VRM avatar to create custom reactions</p>
      </header>
      
      {/* Empty State or VRM Upload Section */}
      {!sourceUrl ? (
        <div className="empty-state">
          <div className="empty-state__icon"><MaskHappy size={48} weight="duotone" /></div>
          <h2>Welcome to Reaction Forge</h2>
          <p>Load a VRM avatar to get started</p>
          <button 
            type="button"
            onClick={() => vrmInputRef.current?.click()}
            className="primary-large"
          >
            <Package size={18} weight="duotone" /> Load VRM Avatar
          </button>
          <input
            ref={vrmInputRef}
            type="file"
            accept=".vrm"
            onChange={handleVRMUpload}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <>
          {/* VRM Management Section */}
          <div className="field">
            <span>Avatar</span>
            <div className="actions">
              <button 
                type="button" 
                className="secondary"
                onClick={() => vrmInputRef.current?.click()}
              >
                <Package size={16} weight="duotone" /> Change VRM
              </button>
              <button 
                type="button" 
                className="secondary"
                onClick={handleResetAvatar}
                title="Clear avatar"
              >
                <Trash size={16} weight="duotone" /> Clear
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Current: {sourceLabel}
            </p>
            <input
              ref={vrmInputRef}
              type="file"
              accept=".vrm"
              onChange={handleVRMUpload}
              style={{ display: 'none' }}
            />
          </div>

          <label className="field">
            <span>Avatar name</span>
            <input
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="e.g. Harmon Vox"
            />
          </label>

          <div className="field">
            <span style={{ marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Reaction Library
            </span>
            {Object.values(PRESET_CATEGORIES).map((category) => (
              <PresetSection 
                key={category.title} 
                title={category.title} 
                icon={category.icon}
                defaultOpen={category.ids.includes(activePreset.id)}
              >
                {category.ids.map(id => {
                  const preset = reactionPresets.find(p => p.id === id);
                  if (!preset) return null;
                  const isActive = activePreset.id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={isActive ? 'secondary active' : 'secondary'}
                      onClick={() => {
                         const p = setPresetById(id);
                         if (p) setStatusMessage(`Selected ${p.label}`);
                      }}
                      style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.5rem', 
                        height: 'auto',
                        textAlign: 'center',
                        justifyContent: 'center',
                        border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                        background: isActive ? 'rgba(0, 255, 214, 0.1)' : 'rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </PresetSection>
            ))}
          </div>

          {/* Custom Pose Drop Zone */}
          <div className="field">
            <span>Custom Pose (Optional)</span>
            <div
              className={`drop-zone-small ${isDraggingPose ? 'drop-zone-small--active' : ''} ${customPose ? 'drop-zone-small--loaded' : ''}`}
              onDrop={handlePoseDrop}
              onDragOver={handlePoseDragOver}
              onDragLeave={handlePoseDragLeave}
              onClick={() => poseInputRef.current?.click()}
            >
              {customPose ? (
                <>
                  <span className="drop-zone-small__icon"><CheckCircle size={24} weight="fill" style={{ color: 'var(--accent)' }} /></span>
                  <span className="drop-zone-small__text">
                    <strong>{customPoseName}</strong>
                    <small>Click to replace or drag another</small>
                  </span>
                </>
              ) : (
                <>
                  <span className="drop-zone-small__icon"><FileIcon size={24} weight="duotone" /></span>
                  <span className="drop-zone-small__text">
                    <strong>Drop JSON here</strong>
                    <small>Or click to browse</small>
                  </span>
                </>
              )}
            </div>
            {customPose && (
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="secondary"
                  onClick={() => applyCustomPose(customPose)}
                  disabled={!isAvatarReady}
                >
                  <MaskHappy size={16} weight="duotone" /> Apply Pose
                </button>
                <button 
                  type="button" 
                  className="secondary"
                  onClick={handleClearCustomPose}
                >
                  <Trash size={16} weight="duotone" /> Clear
                </button>
              </div>
            )}
            <input
              ref={poseInputRef}
              type="file"
              accept=".json"
              onChange={handlePoseUpload}
              style={{ display: 'none' }}
            />
          </div>

          <label className="field">
            <span>Animation mode</span>
            <select
              value={animationMode}
              onChange={(event) => setAnimationMode(event.target.value as AnimationMode)}
            >
              <option value="static">Static Pose</option>
              <option value="once">Play Once</option>
              <option value="loop">Loop Animation</option>
            </select>
          </label>
          <div className="actions">
            <button type="button" disabled={!isAvatarReady} onClick={handleApply}>
              Generate reaction
            </button>
            <button type="button" className="secondary" onClick={handleRandomize}>
              Randomize
            </button>
          </div>
          {animationMode !== 'static' && (
            <div className="actions">
              <button type="button" className="secondary" onClick={handleStopAnimation}>
                Stop Animation
              </button>
            </div>
          )}
          <div className="status-card">
            <span className="status-label">Active reaction</span>
            <h2>{activePreset.label}</h2>
            <p className="muted">{activePreset.description}</p>
            <p className="status-message">{statusMessage}</p>
          </div>
          <div className="actions">
            <button type="button" onClick={handleSave} disabled={isExporting}>
              Save PNG
            </button>
            <button type="button" className="secondary" onClick={handleShare} disabled={isExporting}>
              Share
            </button>
          </div>
          {animationMode !== 'static' && (
            <div className="actions">
              <button type="button" onClick={handleExportWebM} disabled={isExporting || !isAvatarReady || !canExportVideo()}>
                {isExporting && exportProgress > 0 ? `Exporting... ${exportProgress}%` : 'Export Animation'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
