import { useState } from 'react';
import { directorManager } from '../../three/DirectorManager';
import { useDirectorStore } from '../../state/useDirectorStore';
import { useToastStore } from '../../state/useToastStore';
import { 
  Play, 
  Stop, 
  Trash, 
  Plus,
  VideoCamera,
  CaretUp,
  CaretDown,
  Copy,
  Layout,
  PencilSimple,
  X,
  Clock,
  CheckCircle
} from '@phosphor-icons/react';
import type { PoseId, ExpressionId, BackgroundId } from '../../types/reactions';
import type { CameraPreset } from '../../types/director';

export function DirectorTab() {
  const { addToast } = useToastStore();
  const { 
    currentScript, 
    updateScriptTitle,
    updateShot,
    addShot,
    removeShot,
    duplicateShot,
    reorderShots,
    setScript
  } = useDirectorStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  const handlePlayScript = async () => {
    if (!currentScript || currentScript.shots.length === 0) {
      addToast('Add at least one shot to play!', 'warning');
      return;
    }
    setIsPlaying(true);
    await directorManager.playScript(currentScript);
    setIsPlaying(false);
  };

  const handleStopScript = () => {
    directorManager.stop();
    setIsPlaying(false);
  };

  const handleAddDefaultShot = () => {
    addShot({
      id: `shot-${Date.now()}`,
      name: `Shot ${currentScript ? currentScript.shots.length + 1 : 1}`,
      poseId: 'idle-neutral',
      expressionId: 'calm',
      backgroundId: 'synthwave-grid',
      cameraPreset: 'medium',
      duration: 3,
      transition: 'smooth',
      animated: true,
      rootMotion: false
    });
  };

  const handleClearScript = () => {
    if (confirm('Are you sure you want to clear the entire script?')) {
      setScript(null);
    }
  };

  const handleStartEditTitle = () => {
    setTempTitle(currentScript?.title || 'New Script');
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    updateScriptTitle(tempTitle || 'Untitled Script');
    setIsEditingTitle(false);
  };

  // Lists for selects
  const cameraPresets: CameraPreset[] = [
    'headshot', 'portrait', 'medium', 'full-body', 'wide', 
    'low-angle', 'high-angle', 'over-shoulder', 
    'orbit-slow', 'orbit-fast', 'dolly-in', 'dolly-out'
  ];

  const expressions: ExpressionId[] = ['calm', 'joy', 'surprise'];

  const backgrounds: BackgroundId[] = [
    'synthwave-grid', 'neural-circuit', 'neon-waves', 'quantum-particles', 
    'signal-glitch', 'cyber-hexagons', 'protocol-gradient', 'void-minimal',
    'green-screen', 'lush-forest', 'volcano', 'deep-sea', 
    'glass-platform', 'hacker-room', 'industrial', 'rooftop-garden', 'shinto-shrine'
  ];

  const poseGroups = {
    Locomotion: ['locomotion-walk', 'locomotion-run', 'locomotion-jog', 'locomotion-crouch-walk', 'locomotion-turn-left', 'locomotion-turn-right', 'locomotion-stop'],
    Idle: ['idle-neutral', 'idle-happy', 'idle-breathing', 'idle-nervous', 'idle-offensive'],
    Sitting: ['sit-chair', 'sit-floor', 'sit-sad', 'sit-typing', 'transition-stand-to-sit', 'transition-sit-to-stand', 'transition-floor-to-stand'],
    Social: ['emote-wave', 'emote-point', 'emote-clap', 'emote-cheer', 'emote-thumbsup', 'emote-bow', 'emote-dance-silly', 'emote-taunt', 'emote-bored'],
    Action: ['action-defeat', 'action-focus', 'action-rope-climb', 'action-climb-top', 'action-swim', 'action-waking'],
    Classic: ['dawn-runner', 'sunset-call', 'cipher-whisper', 'nebula-drift', 'signal-reverie', 'agent-taunt', 'agent-dance', 'agent-clapping', 'silly-agent', 'simple-wave', 'point', 'defeat', 'focus', 'rope-climb', 'climb-top', 'thumbs-up', 'offensive-idle', 'waking', 'treading-water', 'cheering']
  };

  // Stylized Select Input
  const selectStyle = {
    padding: '0.6rem 0.8rem',
    borderRadius: '8px',
    background: 'var(--surface-raised, #1a1a1a)',
    border: '1px solid var(--border-subtle, #333)',
    color: 'var(--text-bright, #fff)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    width: '100%',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.8rem center',
    backgroundSize: '1em',
  };

  return (
    <div className="tab-content">
      {/* --- SCRIPT HEADER --- */}
      <div className="tab-section" style={{ background: 'var(--surface-overlay)', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditingTitle ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="text-input small" 
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  autoFocus
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  style={{ fontSize: '1.1rem', fontWeight: 'bold', width: '100%' }}
                />
                <button className="icon-button small primary" onClick={handleSaveTitle}>
                  <CheckCircle size={18} weight="fill" />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentScript?.title || 'Director Script'}</h2>
                <button className="icon-button tiny muted" onClick={handleStartEditTitle}>
                  <PencilSimple size={14} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <span className="muted tiny uppercase bold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layout size={12} /> {currentScript?.shots.length || 0} shots
              </span>
              <span className="muted tiny uppercase bold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {currentScript?.totalDuration.toFixed(1) || 0}s
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
            <button className="button-primary small" onClick={handleAddDefaultShot} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
              <Plus size={16} weight="bold" /> Add Shot
            </button>
            <button className="icon-button secondary muted" onClick={handleClearScript} title="Clear Script">
              <Trash size={18} weight="duotone" />
            </button>
          </div>
        </div>
      </div>

      {/* --- SHOT LIST --- */}
      <div className="tab-section">
        {currentScript && currentScript.shots.length > 0 ? (
          <div className="shot-list" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px', 
            maxHeight: '520px', 
            overflowY: 'auto', 
            paddingRight: '12px', // Increased padding for scrollbar room
            paddingBottom: '20px',
            marginRight: '-4px' // Compensation
          }}>
            {currentScript.shots.map((shot, index) => (
              <div key={shot.id} className="shot-item-card" style={{ 
                padding: '16px', 
                background: 'var(--surface-raised)', 
                borderRadius: '12px', 
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                position: 'relative',
                width: '100%' // Ensure full width within container
              }}>
                {/* Shot Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <span className="tiny bold muted" style={{ color: 'var(--primary-color)', flexShrink: 0 }}>#{index + 1}</span>
                    <input 
                      type="text" 
                      className="shot-name-input" 
                      value={shot.name}
                      placeholder="Shot Name..."
                      onChange={(e) => updateShot(shot.id, { name: e.target.value })}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-bright)', 
                        fontSize: '1rem', 
                        fontWeight: 'bold',
                        width: '100%',
                        outline: 'none',
                        borderBottom: '1px solid transparent',
                        textOverflow: 'ellipsis'
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button className="icon-button tiny muted" onClick={() => index > 0 && reorderShots(index, index - 1)} disabled={index === 0}>
                      <CaretUp size={14} />
                    </button>
                    <button className="icon-button tiny muted" onClick={() => index < currentScript.shots.length - 1 && reorderShots(index, index + 1)} disabled={index === currentScript.shots.length - 1}>
                      <CaretDown size={14} />
                    </button>
                    <button className="icon-button tiny muted" onClick={() => duplicateShot(shot.id)} title="Duplicate">
                      <Copy size={14} />
                    </button>
                    <button className="icon-button tiny danger-hover muted" onClick={() => removeShot(shot.id)}>
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Shot Grid Controls */}
                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="field">
                    <label className="tiny muted uppercase bold" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Animation</label>
                    <select 
                      style={selectStyle}
                      value={shot.poseId}
                      onChange={(e) => updateShot(shot.id, { poseId: e.target.value as PoseId })}
                    >
                      {Object.entries(poseGroups).map(([group, poses]) => (
                        <optgroup key={group} label={group} style={{ background: '#1a1a1a' }}>
                          {poses.map(pose => (
                            <option key={pose} value={pose} style={{ background: '#1a1a1a' }}>{pose.replace(/-/g, ' ')}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="tiny muted uppercase bold" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Camera View</label>
                    <select 
                      style={selectStyle}
                      value={shot.cameraPreset}
                      onChange={(e) => updateShot(shot.id, { cameraPreset: e.target.value as CameraPreset })}
                    >
                      {cameraPresets.map(preset => (
                        <option key={preset} value={preset} style={{ background: '#1a1a1a' }}>{preset.replace(/-/g, ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="tiny muted uppercase bold" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Background</label>
                    <select 
                      style={selectStyle}
                      value={shot.backgroundId}
                      onChange={(e) => updateShot(shot.id, { backgroundId: e.target.value as BackgroundId })}
                    >
                      {backgrounds.map(bg => (
                        <option key={bg} value={bg} style={{ background: '#1a1a1a' }}>{bg.replace(/-/g, ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="tiny muted uppercase bold" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Duration</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="range"
                        min="0.5"
                        max="15"
                        step="0.5"
                        value={shot.duration}
                        onChange={(e) => updateShot(shot.id, { duration: parseFloat(e.target.value) })}
                        style={{ flex: 1, accentColor: 'var(--primary-color)' }}
                      />
                      <span className="small mono bold" style={{ width: '35px', color: 'var(--primary-color)', flexShrink: 0 }}>{shot.duration}s</span>
                    </div>
                  </div>

                  <div className="field">
                    <label className="tiny muted uppercase bold" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Expression</label>
                    <select 
                      style={selectStyle}
                      value={shot.expressionId}
                      onChange={(e) => updateShot(shot.id, { expressionId: e.target.value as ExpressionId })}
                    >
                      {expressions.map(exp => (
                        <option key={exp} value={exp} style={{ background: '#1a1a1a' }}>{exp}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="tiny muted uppercase bold" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Transition</label>
                    <select 
                      style={selectStyle}
                      value={shot.transition}
                      onChange={(e) => updateShot(shot.id, { transition: e.target.value as any })}
                    >
                      <option value="smooth" style={{ background: '#1a1a1a' }}>Smooth Flow</option>
                      <option value="cut" style={{ background: '#1a1a1a' }}>Hard Cut</option>
                      <option value="fade" style={{ background: '#1a1a1a' }}>Cross Fade</option>
                    </select>
                  </div>

                  <div className="field" style={{ gridColumn: 'span 2', marginTop: '4px', display: 'flex', gap: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={shot.animated !== false}
                        onChange={(e) => updateShot(shot.id, { animated: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                      />
                      <span className="tiny muted uppercase bold" style={{ letterSpacing: '0.05em' }}>Enable Bone Animation</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={shot.rootMotion === true}
                        onChange={(e) => updateShot(shot.id, { rootMotion: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                      />
                      <span className="tiny muted uppercase bold" style={{ letterSpacing: '0.05em' }}>Root Motion (Walk in Shot)</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            border: '2px dashed var(--border-subtle)',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ 
              width: '64px', height: '64px', 
              borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Layout size={32} weight="thin" style={{ opacity: 0.5 }} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-bright)' }}>No Script Active</h3>
            <p className="muted small" style={{ maxWidth: '240px', margin: '0 0 24px 0' }}>
              Create a cinematic sequence by adding your first shot manually.
            </p>
            <button className="primary" onClick={handleAddDefaultShot} style={{ padding: '10px 24px', borderRadius: '30px' }}>
              <Plus size={18} weight="bold" /> Start New Script
            </button>
          </div>
        )}
      </div>

      {/* --- FLOATING ACTIONS --- */}
      {currentScript && currentScript.shots.length > 0 && (
        <div className="director-actions-footer" style={{ 
          position: 'sticky',
          bottom: '0',
          background: 'var(--surface-overlay)',
          borderTop: '1px solid var(--border-subtle)', 
          padding: '20px',
          margin: '20px -20px -20px -20px',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.3)',
          zIndex: 10,
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
            {isPlaying ? (
              <button className="secondary full-width large pulse" onClick={handleStopScript} style={{ background: '#ff4d4d', color: 'white', border: 'none' }}>
                <Stop size={22} weight="fill" /> Stop Preview
              </button>
            ) : (
              <button className="primary full-width large" onClick={handlePlayScript}>
                <Play size={22} weight="fill" /> Play Script
              </button>
            )}
            
            <button className="secondary full-width large" onClick={() => addToast('Render feature coming soon!', 'info')}>
              <VideoCamera size={22} weight="duotone" /> Export WebM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
