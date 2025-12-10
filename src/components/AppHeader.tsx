
import { useRef, useState } from 'react';
import { useAvatarSource } from '../state/useAvatarSource';
import { useReactionStore } from '../state/useReactionStore';
import { useToastStore } from '../state/useToastStore';
import { AboutModal } from './AboutModal';
import { SettingsModal } from './SettingsModal';

interface AppHeaderProps {
  mode: 'reactions' | 'poselab';
  onModeChange: (mode: 'reactions' | 'poselab') => void;
}

export function AppHeader({ mode, onModeChange }: AppHeaderProps) {
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { currentUrl, setFileSource, sourceLabel } = useAvatarSource();
  const isAvatarReady = useReactionStore((state) => state.isAvatarReady);
  const { addToast } = useToastStore();

  const handleVRMUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      addToast('Please select a VRM file', 'error');
      return;
    }
    
    setFileSource(file);
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <div className="app-header__logo">
            <img src="/logo/poselab.svg" alt="PoseLab" />
            <span>PoseLab</span>
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
            style={{ width: '32px', height: '32px', fontSize: '1.1rem', marginLeft: '0.5rem' }}
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
          <button 
            className="icon-button"
            style={{ width: '32px', height: '32px', fontSize: '0.9rem', marginLeft: '0.5rem' }}
            onClick={() => setShowAbout(true)}
            title="About PoseLab"
          >
            ?
          </button>
        </div>
      </header>
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
