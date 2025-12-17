import { useRef, useEffect } from 'react';
import { useAvatarSource } from '../state/useAvatarSource';
import { useToastStore } from '../state/useToastStore';
import { useUIStore } from '../state/useUIStore';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to PoseLab',
    description: 'The ultimate tool for animating and posing your VRM avatars. Let\'s get you started!',
    targetId: null,
    highlight: false
  },
  {
    id: 'upload',
    title: '1. Load Your Avatar',
    description: 'Start by loading your own VRM file, or use our sample avatar to explore.',
    targetId: 'canvas-stage',
    highlight: true
  },
  {
    id: 'modes',
    title: '2. Choose Your Mode',
    description: 'Switch between "Reactions" for quick presets and "Pose Lab" for detailed editing.',
    targetId: 'mode-switch',
    highlight: true,
    action: (store: any) => store.setMode('reactions')
  },
  {
    id: 'poselab',
    title: '3. Enter Pose Lab',
    description: 'Let\'s switch to Pose Lab to see the advanced tools.',
    targetId: 'mode-switch',
    highlight: true,
    action: (store: any) => store.setMode('poselab')
  },
  {
    id: 'tabs',
    title: '4. The Toolset',
    description: 'Here you can access Animations, Poses, AI tools, and Mocap.',
    targetId: 'poselab-tabs',
    highlight: true
  },
  {
    id: 'timeline',
    title: '5. The Sequencer',
    description: 'Create complex animations using the Timeline Sequencer. This is the heart of PoseLab.',
    targetId: 'tab-seq',
    highlight: true,
    action: (store: any) => store.setPoseLabTab('timeline')
  },
  {
    id: 'finish',
    title: 'You\'re Ready!',
    description: 'Explore the tools, create something amazing, and export your creations.',
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
      addToast('Please select a VRM file', 'error');
      return;
    }
    
    setFileSource(file);
    // If in tutorial, next step will trigger automatically via useEffect
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

  const handleSkip = () => {
    endTutorial();
    // Ensure we are in a good state
    if (currentUrl) {
        // stay where we are
    }
  };
  
  const handleNext = () => {
    if (currentTutorialStep < TUTORIAL_STEPS.length - 1) {
        nextTutorialStep();
    } else {
        endTutorial();
    }
  };

  // If tutorial is not active and avatar is loaded, show nothing (or maybe a "Help" button elsewhere)
  if (!isTutorialActive && currentUrl) return null;

  // Special Case: Initial Load Screen (Step 0 & 1 effectively merged visually)
  const isInitialLoad = !currentUrl;
  const step = TUTORIAL_STEPS[currentTutorialStep];

  if (isInitialLoad && (!isTutorialActive || currentTutorialStep <= 1)) {
     return (
        <div className="onboarding-overlay">
        <div className="onboarding-card">
            <div className="onboarding-icon">✨</div>
            <h2>Welcome to PoseLab</h2>
            <p>Turn your VRM avatar into endless reactions and animation clips.</p>
            
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

            <div className="divider" style={{ margin: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>
             <p className="muted small">
                Don't have an avatar? Load the sample to try the tutorial.
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
    <div className="tutorial-overlay-container" style={{
        position: 'absolute',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none' // Let clicks pass through to the app mostly
    }}>
      <div className="tutorial-card" style={{
        background: 'rgba(8, 10, 17, 0.95)',
        border: '1px solid #00ffd6',
        borderRadius: '16px',
        padding: '1.5rem',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        pointerEvents: 'auto', // Re-enable clicks for the card itself
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: '#00ffd6', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                Step {currentTutorialStep + 1}/{TUTORIAL_STEPS.length}
            </span>
            <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.8rem' }}>
                Skip Tutorial
            </button>
        </div>
        
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>{step.title}</h3>
        <p style={{ margin: '0 0 1.5rem 0', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>
            {step.description}
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button 
                className="primary" 
                onClick={handleNext}
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
            >
                {currentTutorialStep === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next ➜'}
            </button>
        </div>
      </div>
    </div>
  );
}
