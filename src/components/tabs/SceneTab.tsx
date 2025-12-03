import { useState, useEffect } from 'react';
import { sceneManager } from '../../three/sceneManager';
import { backgroundOptions } from '../../three/backgrounds';

type AspectRatio = '16:9' | '1:1' | '9:16';

export function SceneTab() {
  const [selectedBackground, setSelectedBackground] = useState('midnight-circuit');
  const [showLogo, setShowLogo] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

  useEffect(() => {
    // Initialize aspect ratio from sceneManager
    const currentRatio = sceneManager.getAspectRatio();
    setAspectRatio(currentRatio);
  }, []);

  const handleBackgroundSelect = async (backgroundId: string) => {
    setSelectedBackground(backgroundId);
    await sceneManager.setBackground(backgroundId);
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
        <h3>Backgrounds</h3>
        <p className="muted small">Select a background for your scene</p>
        
        <div className="background-grid">
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

