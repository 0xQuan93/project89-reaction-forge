import { useRef } from 'react';
import { useAvatarSource } from '../state/useAvatarSource';
import { useToastStore } from '../state/useToastStore';

export function OnboardingOverlay() {
  const { currentUrl, setFileSource } = useAvatarSource();
  const { addToast } = useToastStore();
  const vrmInputRef = useRef<HTMLInputElement>(null);

  if (currentUrl) return null;

  const handleVRMUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      addToast('Please select a VRM file', 'error');
      return;
    }
    
    setFileSource(file);
  };

  const loadSampleAvatar = async () => {
    try {
      const response = await fetch('/vrm/HarmonVox_519.vrm');
      const blob = await response.blob();
      const file = new File([blob], 'HarmonVox_519.vrm', { type: 'model/gltf-binary' });
      setFileSource(file);
      addToast('Sample avatar loaded', 'success');
    } catch (error) {
      console.error('Failed to load sample avatar:', error);
      addToast('Failed to load sample avatar. Please try uploading your own.', 'error');
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-icon">✨</div>
        <h2>Welcome to PoseLab</h2>
        <p>Turn your VRM avatar into endless reactions and animation clips.</p>
        
        <div className="onboarding-steps">
          <div className="step">
            <span className="step-number">1</span>
            <span>Load your VRM avatar</span>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <span>Pick a preset or create a pose</span>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <span>Export as PNG or WebM</span>
          </div>
        </div>

        <div className="onboarding-actions">
          <button 
            className="primary large full-width"
            onClick={() => vrmInputRef.current?.click()}
          >
            📂 Load Your VRM
          </button>
          
          <button 
            className="secondary full-width"
            onClick={loadSampleAvatar}
          >
            🤖 Load Sample Avatar
          </button>
        </div>

        <input
          ref={vrmInputRef}
          type="file"
          accept=".vrm"
          onChange={handleVRMUpload}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

