import { useRef, useEffect } from 'react';
import { useAvatarSource } from '../state/useAvatarSource';
import { useToastStore } from '../state/useToastStore';
import { useUIStore } from '../state/useUIStore';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to the Loop',
    description: 'You\'ve entered PoseLab—a tool for subverting reality and giving life to your VRM avatars. Let\'s synchronize your interface.',
    targetId: null,
    highlight: false
  },
  {
    id: 'upload',
    title: '1. Materialize Your Avatar',
    description: 'Load your own VRM file or use our HarmonVox agent. This is your digital presence in the Loom.',
    targetId: 'canvas-stage',
    highlight: true
  },
  {
    id: 'modes',
    title: '2. Frequency Tuning',
    description: 'Switch to "Reactions" for instant expressive patterns, or "Pose Lab" for deep neural manipulation.',
    targetId: 'mode-switch',
    highlight: true,
    action: (store: any) => store.setMode('reactions')
  },
  {
    id: 'poselab',
    title: '3. Neural Manipulation',
    description: 'Enter the Pose Lab to access advanced surgical tools for bone posing and animation.',
    targetId: 'mode-switch',
    highlight: true,
    action: (store: any) => store.setMode('poselab')
  },
  {
    id: 'tabs',
    title: '4. The Arsenal',
    description: 'Access Poses, Mocap, and AI tools here. Each module expands your capability to hack the consensus.',
    targetId: 'poselab-tabs',
    highlight: true
  },
  {
    id: 'export',
    title: '5. Signal Broadcast',
    description: 'When your manifestation is complete, use the Export tab to broadcast your avatar to other realms (Images, Video, GLB).',
    targetId: 'poselab-tabs',
    highlight: true,
    action: (store: any) => store.setPoseLabTab('export')
  },
  {
    id: 'finish',
    title: 'Awaken',
    description: 'You are now ready to weave your own narrative. Hack the reality, change the world. See you in the loop.',
    targetId: null,
    highlight: false
  }
];

export function OnboardingOverlay() {
  const { currentUrl, setFileSource } = useAvatarSource();
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
    if (!currentUrl && !isTutorialActive) {
      startTutorial();
    }
  }, [currentUrl, isTutorialActive, startTutorial]);

  // Handle step actions
  useEffect(() => {
    if (!isTutorialActive) return;
    
    const step = TUTORIAL_STEPS[currentTutorialStep];
    if (step && step.action) {
      step.action({ setMode, setPoseLabTab });
    }

    // specific check for upload step completion
    if (step && step.id === 'upload' && currentUrl) {
       nextTutorialStep();
    }

  }, [currentTutorialStep, isTutorialActive, currentUrl, nextTutorialStep, setMode, setPoseLabTab]);

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
  if (!isTutorialActive && currentUrl) return null;

  // Initial Load Screen
  const isInitialLoad = !currentUrl;
  const step = TUTORIAL_STEPS[currentTutorialStep];

  if (isInitialLoad && (!isTutorialActive || currentTutorialStep <= 1)) {
     return (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
              <div className="onboarding-icon">👁️</div>
              <h2>Welcome to PoseLab</h2>
              <p>Turn your digital presence into endless expressions and manifestations.</p>
              
              <div className="onboarding-actions">
                <button 
                    className="primary large full-width"
                    onClick={() => vrmInputRef.current?.click()}
                >
                    📂 Materialize VRM
                </button>
                
                <button 
                    className="secondary full-width"
                    onClick={loadSampleAvatar}
                >
                    🤖 Deploy Agent HarmonVox
                </button>

                <div className="divider" style={{ margin: '1.5rem 0', borderTop: '1px solid var(--border-color)' }}></div>
                
                <p className="muted small" style={{ marginBottom: 0 }}>
                    First time in the loop? Load the agent to begin your synchronization.
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
