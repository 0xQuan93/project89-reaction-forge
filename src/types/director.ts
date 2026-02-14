import type { PoseId, ExpressionId, BackgroundId } from './reactions';

export type CameraPreset = 
  | 'headshot' 
  | 'portrait' 
  | 'medium' 
  | 'full-body' 
  | 'wide' 
  | 'low-angle' 
  | 'high-angle' 
  | 'over-shoulder'
  | 'orbit-slow'
  | 'orbit-fast'
  | 'dolly-in'
  | 'dolly-out';

export interface Shot {
  id: string;
  name: string;
  poseId: PoseId;
  expressionId: ExpressionId;
  backgroundId: BackgroundId;
  cameraPreset: CameraPreset;
  duration: number; // in seconds
  transition: 'cut' | 'fade' | 'smooth';
  animated?: boolean;
  rootMotion?: boolean;
  actions?: string[]; // Array of bracketed commands to execute (e.g., ["[LIGHTING: dramatic]", "[MUSIC: play]"])
}

export interface DirectorScript {
  id: string;
  title: string;
  description?: string;
  shots: Shot[];
  totalDuration: number;
}
