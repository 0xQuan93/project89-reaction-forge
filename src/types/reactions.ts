export type PoseId =
  | 'dawn-runner'
  | 'sunset-call'
  | 'cipher-whisper'
  | 'nebula-drift'
  | 'signal-reverie'
  | 'typing'
  | 'agent-taunt'
  | 'agent-dance'
  | 'agent-clapping'
  | 'silly-agent'
  | 'victory-celebration'
  | 'simple-wave'
  | 'point';

export type ExpressionId = 'calm' | 'joy' | 'surprise';

export type BackgroundId = 
  | 'midnight-circuit'
  | 'protocol-sunset'
  | 'green-loom-matrix'
  | 'neural-grid'
  | 'cyber-waves'
  | 'signal-breach'
  | 'quantum-field'
  | 'protocol-dawn';

// Animation playback mode
export type AnimationMode = 'static' | 'loop' | 'once';

export type ReactionPreset = {
  id: string;
  label: string;
  description: string;
  pose: PoseId;
  expression: ExpressionId;
  background: BackgroundId;
  // Optional: if true, play as animation instead of static pose
  animated?: boolean;
  // Optional: animation playback mode
  animationMode?: AnimationMode;
};

