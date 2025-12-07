import type { VRMPose } from '@pixiv/three-vrm';

export type EasingType = 'linear' | 'easeInOutQuad' | 'step';

export interface TimelineKeyframe {
  id: string;
  time: number; // Time in seconds
  pose: VRMPose; // The pose data at this keyframe
  label?: string; // Optional user-friendly name (e.g., "Start", "Jump")
  easing?: EasingType;
}

export interface TimelineSequence {
  duration: number;
  keyframes: TimelineKeyframe[];
}

