export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  cta?: string;
}

export interface OnboardingPersona {
  id: string;
  label: string;
  description: string;
  steps: OnboardingStep[];
}

export const ONBOARDING_PERSONAS: OnboardingPersona[] = [
  {
    id: 'vtuber',
    label: 'VTuber Starter',
    description: 'Build your first streaming-ready avatar scenes with expression control and looping reactions.',
    steps: [
      {
        id: 'vtuber-load-avatar',
        title: 'Load your VRM avatar',
        description: 'Import a VRM to see PoseLab tools light up for your model.',
        cta: 'Use “Load VRM Avatar” in the Avatar panel.',
      },
      {
        id: 'vtuber-expressions',
        title: 'Dial in expressions',
        description: 'Adjust joy/surprise/calm sliders to match your stream persona.',
        cta: 'Open the Reactions tab and move expression sliders.',
      },
      {
        id: 'vtuber-loop',
        title: 'Create a looping reaction',
        description: 'Pick a preset and export a clean WebM loop for OBS.',
        cta: 'Try “Simple Wave” then export WebM (9:16).',
      },
    ],
  },
  {
    id: 'pngtuber',
    label: 'PNG Tuber Essentials',
    description: 'Generate polished poses and cutouts for static or lightly animated assets.',
    steps: [
      {
        id: 'pngtuber-pose',
        title: 'Pose your avatar',
        description: 'Use AI or manual posing to create your hero stance.',
        cta: 'Pose Lab → AI Gen: “confident smile”.',
      },
      {
        id: 'pngtuber-expression',
        title: 'Capture expression variants',
        description: 'Generate a set of emotions for quick swaps in your scene.',
        cta: 'Export PNG with Joy, Surprise, Calm.',
      },
      {
        id: 'pngtuber-export',
        title: 'Export transparent PNGs',
        description: 'Deliver clean cutouts ready for Photoshop or OBS.',
        cta: 'Export PNG with transparent background.',
      },
    ],
  },
  {
    id: 'creator',
    label: 'Content Creator Flow',
    description: 'Build multi-format assets for YouTube, TikTok, and socials.',
    steps: [
      {
        id: 'creator-scene',
        title: 'Set your scene style',
        description: 'Pick a background and lighting mood that matches your brand.',
        cta: 'Scene → Backgrounds & Lighting presets.',
      },
      {
        id: 'creator-aspect',
        title: 'Choose aspect ratios',
        description: 'Switch between 16:9, 9:16, and 1:1 for distribution.',
        cta: 'Use Aspect Ratio toggle before export.',
      },
      {
        id: 'creator-export',
        title: 'Export multi-format assets',
        description: 'Generate a thumbnail + short-form clip in one session.',
        cta: 'Export PNG (16:9) and WebM (9:16).',
      },
    ],
  },
  {
    id: 'animator',
    label: 'Animator / Mocap',
    description: 'Capture motion and refine sequences for storytelling.',
    steps: [
      {
        id: 'animator-mocap',
        title: 'Record motion capture',
        description: 'Use webcam tracking for body + face performance.',
        cta: 'Mocap tab → Start Camera + Record.',
      },
      {
        id: 'animator-keyframes',
        title: 'Refine with keyframes',
        description: 'Blend captured motion with manual adjustments.',
        cta: 'Pose Lab → Timeline keyframes.',
      },
      {
        id: 'animator-export',
        title: 'Export animation data',
        description: 'Save motion JSON for reuse and remixing.',
        cta: 'Export animation JSON.',
      },
    ],
  },
];

export const getOnboardingPersona = (id: string): OnboardingPersona | undefined =>
  ONBOARDING_PERSONAS.find((persona) => persona.id === id);
