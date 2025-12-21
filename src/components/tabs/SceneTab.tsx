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
  const [customOverlay, setCustomOverlay] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [cssOverlay, setCssOverlay] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

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

  const handleOverlayUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      addToast('Please select a PNG, WebM, or MP4 file', 'warning');
      return;
    }

    const url = URL.createObjectURL(file);
    setCustomOverlay(url);
    setShowOverlay(true);
    await sceneManager.setOverlay(url);
    addToast('Overlay loaded successfully', 'success');
  };

  const toggleOverlay = async (show: boolean) => {
    setShowOverlay(show);
    await sceneManager.setOverlay(show ? customOverlay : null);
  };

  const handleCssOverlayChange = (overlay: string) => {
      // Toggle logic: if clicking active, turn off. Else set active.
      const newOverlay = overlay === cssOverlay ? null : overlay;
      setCssOverlay(newOverlay);
      
      document.documentElement.style.setProperty('--active-overlay', newOverlay || 'none');
      
      // Target the canvas-container instead of the full viewport to prevent overlapping UI
      const viewport = document.querySelector('.canvas-container');
      if (viewport) {
          // Remove ALL old overlay classes first to be safe
          viewport.classList.remove('overlay-glitch', 'overlay-scanlines', 'overlay-vignette', 'overlay-crt');
          
          // Clear any previous overlay elements (for safety)
          const old = document.getElementById('active-css-overlay');
          if (old) old.remove();

          if (newOverlay) {
              const div = document.createElement('div');
              div.className = newOverlay;
              div.id = 'active-css-overlay';
              viewport.appendChild(div);
          }
      }
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
        
        {isAvatarReady && (
            <button
              className="secondary full-width"
              onClick={() => {
                  const vrm = avatarManager.getVRM();
                  if (vrm) {
                      sceneManager.frameObject(vrm.scene);
                  }
              }}
              style={{ marginTop: '0.5rem' }}
            >
              🔍 Fit Avatar to Screen
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
        <h3>Overlays</h3>
        <p className="muted small">Transparent overlays (PNG/WebM)</p>
        
        <div style={{ marginBottom: '1rem' }}>
            <button
              className="secondary full-width"
              onClick={() => overlayInputRef.current?.click()}
            >
              {customOverlay ? '🔄 Change Overlay' : '📤 Upload Overlay'}
            </button>
            <input
              ref={overlayInputRef}
              type="file"
              accept="image/png,video/webm,video/mp4"
              onChange={handleOverlayUpload}
              style={{ display: 'none' }}
            />
        </div>

        {customOverlay && (
            <label className="checkbox-option" style={{ marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(e) => toggleOverlay(e.target.checked)}
              />
              <span>Show custom overlay</span>
            </label>
        )}

        <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.5rem' }}>FX Overlays</label>
            <div className="button-group small">
                <button 
                    className={cssOverlay === 'overlay-scanlines' ? 'secondary active' : 'secondary'}
                    onClick={() => handleCssOverlayChange('overlay-scanlines')}
                >Scanlines</button>
                <button 
                    className={cssOverlay === 'overlay-vignette' ? 'secondary active' : 'secondary'}
                    onClick={() => handleCssOverlayChange('overlay-vignette')}
                >Vignette</button>
                <button 
                    className={cssOverlay === 'overlay-glitch' ? 'secondary active' : 'secondary'}
                    onClick={() => handleCssOverlayChange('overlay-glitch')}
                >Glitch</button>
                <button 
                    className={cssOverlay === 'overlay-crt' ? 'secondary active' : 'secondary'}
                    onClick={() => handleCssOverlayChange('overlay-crt')}
                >CRT</button>
            </div>
        </div>

        <label className="checkbox-option" style={{ marginTop: '1rem' }}>
          <input
            type="checkbox"
            checked={showLogo}
            onChange={(e) => setShowLogo(e.target.checked)}
          />
          <span>Show logo watermark</span>
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

