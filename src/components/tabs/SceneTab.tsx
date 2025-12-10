import { useState, useEffect, useRef } from 'react';
import { sceneManager } from '../../three/sceneManager';
import { backgroundOptions } from '../../three/backgrounds';
import { avatarManager } from '../../three/avatarManager';
import { useReactionStore } from '../../state/useReactionStore';
import { useToastStore } from '../../state/useToastStore';
import type { BackgroundId } from '../../types/reactions';

type AspectRatio = '16:9' | '1:1' | '9:16';

export function SceneTab() {
  const { isAvatarReady, setAvatarReady } = useReactionStore();
  const { addToast } = useToastStore();
  const [selectedBackground, setSelectedBackground] = useState('midnight-circuit');
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize aspect ratio from sceneManager
    const currentRatio = sceneManager.getAspectRatio();
    setAspectRatio(currentRatio);
  }, []);

  const handleVRMUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAvatarReady(false);
    try {
      await avatarManager.load(url);
      setAvatarReady(true);
      addToast('Avatar loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to load VRM:', error);
      addToast('Failed to load VRM file', 'error');
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Allow Images and Videos (and GIFs)
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      addToast('Please select an image (PNG, JPG, GIF) or video (MP4, WebM) file', 'warning');
      return;
    }

    const url = URL.createObjectURL(file);
            // Append type info to hash for the background manager to detect
            const typeUrl = `${url}#type=${file.type}`;
            
            setCustomBackground(typeUrl);
            setSelectedBackground('custom');
            await sceneManager.setBackground(typeUrl);
          };

          const handleBackgroundSelect = async (backgroundId: string) => {
    setSelectedBackground(backgroundId);
    if (backgroundId === 'custom' && customBackground) {
      await sceneManager.setBackground(customBackground);
    } else {
      await sceneManager.setBackground(backgroundId as BackgroundId);
    }
  };

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    // Update the scene manager to adjust the camera aspect ratio
    sceneManager.setAspectRatio(ratio);
    console.log('[SceneTab] Aspect ratio changed to:', ratio);
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Avatar</h3>
        <p className="muted small">Load or change the current VRM avatar</p>
        <button
          className={isAvatarReady ? 'secondary full-width' : 'primary full-width'}
          onClick={() => vrmInputRef.current?.click()}
        >
          {isAvatarReady ? '🔄 Change Avatar' : '📦 Load VRM Avatar'}
        </button>
        <input
          ref={vrmInputRef}
          type="file"
          accept=".vrm"
          onChange={handleVRMUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="tab-section">
        <h3>Backgrounds</h3>
        <p className="muted small">Select a background for your scene</p>
        
        <div className="background-grid">
          <button
            className={`background-thumbnail ${selectedBackground === 'custom' ? 'active' : ''}`}
            onClick={() => customBackground ? handleBackgroundSelect('custom') : bgInputRef.current?.click()}
            title="Upload Custom Background"
          >
            <div className="background-thumbnail__preview" style={{
              backgroundImage: customBackground ? `url(${customBackground})` : 'none',
              backgroundColor: '#2a2a2a',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {!customBackground && <span style={{ fontSize: '1.5rem' }}>➕</span>}
            </div>
            <span className="background-thumbnail__name">Custom</span>
          </button>

          {backgroundOptions.map((bg) => (
            <button
              key={bg.id}
              className={`background-thumbnail ${selectedBackground === bg.id ? 'active' : ''}`}
              onClick={() => handleBackgroundSelect(bg.id)}
              title={bg.label}
            >
              <div className="background-thumbnail__preview" style={{
                backgroundImage: bg.image ? `url(${bg.image})` : 'none',
                backgroundColor: bg.image ? 'transparent' : String(bg.color),
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }} />
              <span className="background-thumbnail__name">{bg.label}</span>
            </button>
          ))}
        </div>

                <div style={{ marginTop: '1rem' }}>
                  <button 
                    className="secondary full-width"
                    onClick={() => bgInputRef.current?.click()}
                  >
                    📤 Upload Background
                  </button>
                  <p className="muted small" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                    Supports: PNG, JPG, GIF, MP4, WebM
                  </p>
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleBackgroundUpload}
                    style={{ display: 'none' }}
                  />
                </div>
      </div>

      <div className="tab-section">
        <h3>Overlay Options</h3>
        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={showLogo}
            onChange={(e) => setShowLogo(e.target.checked)}
          />
          <span>Show logo overlay</span>
        </label>
      </div>

      <div className="tab-section">
        <h3>Aspect Ratio</h3>
        <p className="muted small">Choose aspect ratio for export (applies to canvas framing)</p>
        <div className="button-group">
          <button 
            className={aspectRatio === '16:9' ? 'secondary active' : 'secondary'}
            onClick={() => handleAspectRatioChange('16:9')}
          >
            16:9
          </button>
          <button 
            className={aspectRatio === '1:1' ? 'secondary active' : 'secondary'}
            onClick={() => handleAspectRatioChange('1:1')}
          >
            1:1
          </button>
          <button 
            className={aspectRatio === '9:16' ? 'secondary active' : 'secondary'}
            onClick={() => handleAspectRatioChange('9:16')}
          >
            9:16
          </button>
        </div>
      </div>
    </div>
  );
}

