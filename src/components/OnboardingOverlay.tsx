import { useRef, useEffect } from 'react';
import { useAvatarSource } from '../state/useAvatarSource';
import { useToastStore } from '../state/useToastStore';
import { useUIStore } from '../state/useUIStore';
import { Eye, FolderOpen, Robot } from '@phosphor-icons/react';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to PoseLab',
    description: 'Your creative studio for VRM avatars. Pose, animate, capture—let\'s get you started.',
    targetId: null,
    highlight: false
  },
  {
    id: 'upload',
    title: '1. Load Your Avatar',
    description: 'Upload your own VRM file or try our sample avatar. This is your digital canvas.',
    targetId: 'canvas-stage',
    highlight: true
  },
  {
    id: 'modes',
    title: '2. Choose Your Mode',
    description: '"Reactions" gives you instant presets for streaming and content. "Pose Lab" unlocks full creative control.',
    targetId: 'mode-switch',
    highlight: true,
    action: (store: any) => store.setMode('reactions')
  },
  {
    id: 'poselab',
    title: '3. Pose Lab Tools',
    description: 'In Pose Lab, access Animations, Poses, and Mocap tabs for deep customization.',
    targetId: 'mode-switch',
    highlight: true,
    action: (store: any) => store.setMode('poselab')
  },
  {
    id: 'tabs',
    title: '4. Your Toolkit',
    description: 'Anims: play imported animations. Poses: save and load poses. Mocap: use your webcam for motion capture.',
    targetId: 'poselab-tabs',
    highlight: true
  },
  {
    id: 'export',
    title: '5. Export & Save',
    description: 'Export images, videos, or 3D models. Use Ctrl+S to save your project and Ctrl+O to load it later.',
    targetId: 'poselab-tabs',
    highlight: true,
    action: (store: any) => store.setPoseLabTab('export')
  },
  {
    id: 'camera',
    title: '6. Camera Controls',
    description: 'Use hotkeys 1, 3, 5, 7 for quick camera views: Headshot, 3/4, Side, and Home. Scroll to zoom, drag to orbit.',
    targetId: 'canvas-stage',
    highlight: true
  },
  {
    id: 'finish',
    title: 'You\'re Ready!',
    description: 'Explore, create, and share. Check the About (?) for more features. Have fun!',
    targetId: null,
    highlight: false
  }
];

export function OnboardingOverlay() {
  const { avatarType, setFileSource } = useAvatarSource();
  const { addToast } = useToastStore();
  const { 
    isTutorialActive, 
    currentTutorialStep, 
    startTutorial, 
    endTutorial, 
    nextTutorialStep,
    prevTutorialStep,
    setMode,
    setPoseLabTab
  } = useUIStore();
  
  const vrmInputRef = useRef<HTMLInputElement>(null);

  // Auto-start tutorial if no avatar is loaded
  useEffect(() => {
    if (avatarType === 'none' && !isTutorialActive) {
      startTutorial();
    }
  }, [avatarType, isTutorialActive, startTutorial]);

  // Handle step actions
  useEffect(() => {
    if (!isTutorialActive) return;
    
    const step = TUTORIAL_STEPS[currentTutorialStep];
    if (step && step.action) {
      step.action({ setMode, setPoseLabTab });
    }

    // specific check for upload step completion
    if (step && step.id === 'upload' && avatarType !== 'none') {
       nextTutorialStep();
    }

  }, [currentTutorialStep, isTutorialActive, avatarType, nextTutorialStep, setMode, setPoseLabTab]);

  // Clean up highlights
  useEffect(() => {
    // Remove all highlights first
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
    });

    if (!isTutorialActive) return;

    const step = TUTORIAL_STEPS[currentTutorialStep];
    if (step && step.highlight && step.targetId) {
      const el = document.querySelector(`[data-tutorial-id="${step.targetId}"]`);
      if (el) {
        el.classList.add('tutorial-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTutorialStep, isTutorialActive]);

  const handleVRMUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      addToast('Invalid data signature. Please provide a .vrm file.', 'error');
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
      addToast('Agent HarmonVox materialized.', 'success');
    } catch (error) {
      console.error('Failed to load sample avatar:', error);
      addToast('Transmission failed. Please upload your own avatar.', 'error');
    }
  };

  const handleSkip = () => {
    endTutorial();
  };
  
  const handleNext = () => {
    if (currentTutorialStep < TUTORIAL_STEPS.length - 1) {
        nextTutorialStep();
    } else {
        endTutorial();
    }
  };

  const handleBack = () => {
    if (currentTutorialStep > 0) {
      prevTutorialStep();
    }
  };

  // If tutorial is not active and avatar is loaded, show nothing
  if (!isTutorialActive && avatarType !== 'none') return null;

  // Initial Load Screen
  const isInitialLoad = avatarType === 'none';
  const step = TUTORIAL_STEPS[currentTutorialStep];

  if (isInitialLoad && (!isTutorialActive || currentTutorialStep <= 1)) {
     return (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
              <div className="onboarding-icon"><Eye size={48} weight="duotone" /></div>
              <h2>Welcome to PoseLab</h2>
              <p>Create stunning poses, animations, and captures with your VRM avatar.</p>
              
              <div className="onboarding-actions">
                <button 
                    className="primary large full-width"
                    onClick={() => vrmInputRef.current?.click()}
                >
                    <FolderOpen size={18} weight="duotone" /> Load Your VRM
                </button>
                
                <button 
                    className="secondary full-width"
                    onClick={loadSampleAvatar}
                >
                    <Robot size={18} weight="duotone" /> Try Sample Avatar
                </button>

                <div className="divider" style={{ margin: '1.5rem 0', borderTop: '1px solid var(--border-color)' }}></div>
                
                <p className="muted small" style={{ marginBottom: 0 }}>
                    New here? Try the sample avatar to explore all features.
                </p>
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

  // Standard Tutorial Overlay
  if (!isTutorialActive) return null;

  return (
    <div className="tutorial-overlay-container">
      <div className="tutorial-card">
        <div className="tutorial-progress-container">
          {TUTORIAL_STEPS.map((_, index) => (
            <div 
              key={index} 
              className={`tutorial-progress-dot ${index <= currentTutorialStep ? 'active' : ''}`}
            />
          ))}
        </div>

        <div className="tutorial-header">
            <span className="tutorial-step-indicator">
                Phase {currentTutorialStep + 1} / {TUTORIAL_STEPS.length}
            </span>
            <button className="tutorial-skip-btn" onClick={handleSkip}>
                Exit Loop
            </button>
        </div>
        
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        
        <div className="tutorial-footer">
            <div className="tutorial-nav-buttons">
              {currentTutorialStep > 0 && (
                <button 
                  className="secondary small" 
                  onClick={handleBack}
                >
                  ⇠ Back
                </button>
              )}
            </div>
            
            <button 
                className="primary" 
                onClick={handleNext}
                style={{ padding: '0.6rem 2rem' }}
            >
                {currentTutorialStep === TUTORIAL_STEPS.length - 1 ? 'Awaken' : 'Proceed ⇢'}
            </button>
        </div>
      </div>
    </div>
  );
}
