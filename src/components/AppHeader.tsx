
import { useRef, useState } from 'react';
import { useAvatarSource } from '../state/useAvatarSource';
import { useReactionStore } from '../state/useReactionStore';
import { AboutModal } from './AboutModal';

interface AppHeaderProps {
  mode: 'reactions' | 'poselab';
  onModeChange: (mode: 'reactions' | 'poselab') => void;
}

export function AppHeader({ mode, onModeChange }: AppHeaderProps) {
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const [showAbout, setShowAbout] = useState(false);
  const { currentUrl, setFileSource, sourceLabel, reset } = useAvatarSource();
  const isAvatarReady = useReactionStore((state) => state.isAvatarReady);

  const handleVRMUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      alert('Please select a VRM file');
      return;
    }
    
    setFileSource(file);
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <div className="app-header__logo">
            <img src="/logo/89-logo.svg" alt="Project 89" />
            <span>Reaction Forge</span>
          </div>
          <div className="mode-switch">
            <button
              className={mode === 'reactions' ? 'active' : ''}
              onClick={() => onModeChange('reactions')}
            >
              Reactions
            </button>
            <button
              className={mode === 'poselab' ? 'active' : ''}
              onClick={() => onModeChange('poselab')}
            >
              Pose Lab
            </button>
          </div>
        </div>

        <div className="app-header__center">
          {currentUrl ? (
            <div className="avatar-selector">
              <span className="avatar-selector__label">{sourceLabel}</span>
              <button
                className="avatar-selector__button"
                onClick={() => vrmInputRef.current?.click()}
                title="Change avatar"
              >
                Change Avatar
              </button>
            </div>
          ) : (
            <button
              className="avatar-selector__button primary"
              onClick={() => vrmInputRef.current?.click()}
            >
              Load VRM Avatar
            </button>
          )}
          <input
            ref={vrmInputRef}
            type="file"
            accept=".vrm"
            onChange={handleVRMUpload}
            style={{ display: 'none' }}
          />
        </div>

        <div className="app-header__right">
          <div className="status-indicator">
            <span className={`status-dot ${isAvatarReady ? 'ready' : 'loading'}`} />
            <span className="status-text">{isAvatarReady ? 'Ready' : 'Loading...'}</span>
          </div>
          <button 
            className="icon-button"
            style={{ width: '32px', height: '32px', fontSize: '0.9rem', marginLeft: '1rem' }}
            onClick={() => setShowAbout(true)}
            title="About Reaction Forge"
          >
            ?
          </button>
        </div>
      </header>
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
}
