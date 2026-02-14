import type { VRMHumanBoneName } from '@pixiv/three-vrm';

// ============================================================================
// TYPES
// ============================================================================

export type EmotionState = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'excited' | 'tired' | 'nervous';

export type GestureType = 
  | 'wave' | 'nod' | 'shake' | 'shrug' | 'point' 
  | 'thumbsUp' | 'clap' | 'bow' | 'celebrate' 
  | 'think' | 'listen' | 'acknowledge' | 'dance' | 'laugh' | 'surprised';

export interface GestureKeyframe {
  time: number;  // 0-1 normalized
  bones: Partial<Record<VRMHumanBoneName, { x: number; y: number; z: number }>>;
  easing?: keyof typeof Easing;
}

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

export const Easing = {
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  breath: (t: number) => (1 - Math.cos(t * Math.PI * 2)) / 2,
  sway: (t: number, frequency = 1) => Math.sin(t * Math.PI * 2 * frequency),
};

// ============================================================================
// EXPRESSION PRESETS
// ============================================================================

export const EXPRESSION_PRESETS: Record<EmotionState, Record<string, number>> = {
  neutral: { Joy: 0, Angry: 0, Sorrow: 0, Surprised: 0 },
  happy: { Joy: 0.8, Angry: 0, Sorrow: 0, Surprised: 0.1 },
  sad: { Joy: 0, Angry: 0, Sorrow: 0.7, Surprised: 0 },
  angry: { Joy: 0, Angry: 0.8, Sorrow: 0.1, Surprised: 0.1 },
  surprised: { Joy: 0.2, Angry: 0, Sorrow: 0, Surprised: 0.9 },
  thinking: { Joy: 0, Angry: 0, Sorrow: 0.1, Surprised: 0 },
  excited: { Joy: 0.9, Angry: 0, Sorrow: 0, Surprised: 0.4 },
  tired: { Joy: 0, Angry: 0, Sorrow: 0.3, Surprised: 0 },
  nervous: { Joy: 0.1, Angry: 0, Sorrow: 0.2, Surprised: 0.3 },
};

// ============================================================================
// GESTURE LIBRARY
// ============================================================================

export const GESTURE_LIBRARY: Record<string, { duration: number; keyframes: GestureKeyframe[] }> = {
  wave: {
    duration: 1.8,
    keyframes: [
      { time: 0, bones: { rightUpperArm: { x: 5, y: 0, z: 5 }, rightLowerArm: { x: 0, y: 10, z: 0 } }, easing: 'easeOut' },
      { time: 0.15, bones: { rightUpperArm: { x: -10, y: 0, z: -70 }, rightLowerArm: { x: 0, y: 70, z: 0 }, spine: { x: 0, y: 3, z: 2 } }, easing: 'easeOutBack' },
      { time: 0.3, bones: { rightUpperArm: { x: -10, y: 0, z: -75 }, rightLowerArm: { x: 0, y: 80, z: 0 }, rightHand: { x: 0, y: -25, z: 15 } }, easing: 'easeInOut' },
      { time: 0.45, bones: { rightHand: { x: 0, y: 25, z: -15 } }, easing: 'easeInOut' },
      { time: 0.6, bones: { rightHand: { x: 0, y: -25, z: 15 } }, easing: 'easeInOut' },
      { time: 0.75, bones: { rightHand: { x: 0, y: 25, z: -15 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { rightUpperArm: { x: 0, y: 0, z: 0 }, rightLowerArm: { x: 0, y: 0, z: 0 }, rightHand: { x: 0, y: 0, z: 0 }, spine: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  nod: {
    duration: 1.0,
    keyframes: [
      { time: 0, bones: { head: { x: 0, y: 0, z: 0 }, neck: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.2, bones: { head: { x: 15, y: 0, z: 0 }, neck: { x: 5, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 0.4, bones: { head: { x: -8, y: 0, z: 0 }, neck: { x: -3, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 0.6, bones: { head: { x: 10, y: 0, z: 0 }, neck: { x: 3, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { head: { x: 0, y: 0, z: 0 }, neck: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  shake: {
    duration: 1.0,
    keyframes: [
      { time: 0, bones: { head: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.15, bones: { head: { x: 0, y: -20, z: 0 } }, easing: 'easeInOut' },
      { time: 0.35, bones: { head: { x: 0, y: 20, z: 0 } }, easing: 'easeInOut' },
      { time: 0.55, bones: { head: { x: 0, y: -15, z: 0 } }, easing: 'easeInOut' },
      { time: 0.75, bones: { head: { x: 0, y: 10, z: 0 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { head: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  celebrate: {
    duration: 2.0,
    keyframes: [
      { time: 0, bones: { spine: { x: 5, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.2, bones: { rightUpperArm: { x: -10, y: 0, z: -150 }, leftUpperArm: { x: -10, y: 0, z: 150 }, spine: { x: -10, y: 0, z: 0 }, head: { x: -10, y: 0, z: 0 } }, easing: 'easeOutBack' },
      { time: 0.4, bones: { spine: { x: -8, y: 8, z: 5 } }, easing: 'easeInOut' },
      { time: 0.6, bones: { spine: { x: -8, y: -8, z: -5 } }, easing: 'easeInOut' },
      { time: 0.8, bones: { spine: { x: -8, y: 8, z: 5 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { rightUpperArm: { x: 0, y: 0, z: 0 }, leftUpperArm: { x: 0, y: 0, z: 0 }, spine: { x: 0, y: 0, z: 0 }, head: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  thumbsUp: {
    duration: 1.2,
    keyframes: [
      { time: 0, bones: { rightUpperArm: { x: 0, y: 0, z: 0 }, rightLowerArm: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.25, bones: { rightUpperArm: { x: 20, y: 30, z: -40 }, rightLowerArm: { x: 0, y: 100, z: 0 }, rightHand: { x: -30, y: 0, z: 10 } }, easing: 'easeOutBack' },
      { time: 0.7, bones: { rightUpperArm: { x: 20, y: 30, z: -40 }, rightLowerArm: { x: 0, y: 100, z: 0 }, rightHand: { x: -30, y: 0, z: 10 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { rightUpperArm: { x: 0, y: 0, z: 0 }, rightLowerArm: { x: 0, y: 0, z: 0 }, rightHand: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  laugh: {
    duration: 1.5,
    keyframes: [
      { time: 0, bones: { spine: { x: 0, y: 0, z: 0 }, head: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.2, bones: { spine: { x: -10, y: 0, z: 0 }, head: { x: -15, y: 0, z: 0 } }, easing: 'easeOutBack' },
      { time: 0.4, bones: { spine: { x: 5, y: 0, z: 0 }, head: { x: 5, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 0.6, bones: { spine: { x: -8, y: 0, z: 0 }, head: { x: -10, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 0.8, bones: { spine: { x: 5, y: 0, z: 0 }, head: { x: 5, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { spine: { x: 0, y: 0, z: 0 }, head: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  surprised: {
    duration: 1.2,
    keyframes: [
      { time: 0, bones: { spine: { x: 0, y: 0, z: 0 }, head: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.2, bones: { spine: { x: -15, y: 0, z: 0 }, head: { x: -20, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 15, z: -30 }, leftUpperArm: { x: 0, y: -15, z: 30 } }, easing: 'easeOutBack' },
      { time: 0.8, bones: { spine: { x: -15, y: 0, z: 0 }, head: { x: -20, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { spine: { x: 0, y: 0, z: 0 }, head: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 }, leftUpperArm: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  dance: {
    duration: 2.0,
    keyframes: [
      { time: 0, bones: { hips: { x: 0, y: 0, z: 0 }, spine: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.25, bones: { hips: { x: 0, y: 20, z: 10 }, spine: { x: 0, y: -10, z: -5 }, rightUpperArm: { x: 0, y: 40, z: -40 }, leftUpperArm: { x: 0, y: -40, z: 40 } }, easing: 'easeInOut' },
      { time: 0.5, bones: { hips: { x: 0, y: -20, z: -10 }, spine: { x: 0, y: 10, z: 5 } }, easing: 'easeInOut' },
      { time: 0.75, bones: { hips: { x: 0, y: 20, z: 10 }, spine: { x: 0, y: -10, z: -5 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { hips: { x: 0, y: 0, z: 0 }, spine: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 }, leftUpperArm: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  shrug: {
    duration: 1.5,
    keyframes: [
      { time: 0, bones: { leftUpperArm: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.3, bones: { leftUpperArm: { x: 0, y: 0, z: 20 }, rightUpperArm: { x: 0, y: 0, z: -20 }, spine: { x: 5, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 0.8, bones: { leftUpperArm: { x: 0, y: 0, z: 25 }, rightUpperArm: { x: 0, y: 0, z: -25 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { leftUpperArm: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 }, spine: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  point: {
    duration: 1.5,
    keyframes: [
      { time: 0, bones: { rightUpperArm: { x: 0, y: 0, z: 0 }, rightLowerArm: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.3, bones: { rightUpperArm: { x: -20, y: 0, z: -80 }, rightLowerArm: { x: 0, y: 20, z: 0 } }, easing: 'easeOutBack' },
      { time: 0.8, bones: { rightUpperArm: { x: -20, y: 0, z: -80 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { rightUpperArm: { x: 0, y: 0, z: 0 }, rightLowerArm: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  bow: {
    duration: 2.0,
    keyframes: [
      { time: 0, bones: { spine: { x: 0, y: 0, z: 0 }, head: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.5, bones: { spine: { x: 30, y: 0, z: 0 }, head: { x: 10, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 1.2, bones: { spine: { x: 35, y: 0, z: 0 }, head: { x: 15, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { spine: { x: 0, y: 0, z: 0 }, head: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  clap: {
    duration: 1.5,
    keyframes: [
      { time: 0, bones: { leftUpperArm: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.2, bones: { leftUpperArm: { x: -20, y: 20, z: 40 }, rightUpperArm: { x: -20, y: -20, z: -40 } }, easing: 'easeInOut' },
      { time: 0.4, bones: { leftUpperArm: { x: -30, y: 30, z: 20 }, rightUpperArm: { x: -30, y: -30, z: -20 } }, easing: 'easeInOut' },
      { time: 0.6, bones: { leftUpperArm: { x: -20, y: 20, z: 40 }, rightUpperArm: { x: -20, y: -20, z: -40 } }, easing: 'easeInOut' },
      { time: 0.8, bones: { leftUpperArm: { x: -30, y: 30, z: 20 }, rightUpperArm: { x: -30, y: -30, z: -20 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { leftUpperArm: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  think: {
    duration: 2.0,
    keyframes: [
      { time: 0, bones: { head: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.4, bones: { head: { x: 10, y: -15, z: 5 }, rightUpperArm: { x: 20, y: 40, z: -40 }, rightLowerArm: { x: 0, y: 110, z: 0 } }, easing: 'easeInOut' },
      { time: 1.2, bones: { head: { x: 12, y: -18, z: 6 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { head: { x: 0, y: 0, z: 0 }, rightUpperArm: { x: 0, y: 0, z: 0 }, rightLowerArm: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
  acknowledge: {
    duration: 1.0,
    keyframes: [
      { time: 0, bones: { head: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.3, bones: { head: { x: 15, y: 0, z: 0 } }, easing: 'easeInOut' },
      { time: 0.6, bones: { head: { x: 0, y: 0, z: 0 } }, easing: 'easeInOut' },
    ],
  },
  listen: {
    duration: 2.0,
    keyframes: [
      { time: 0, bones: { head: { x: 0, y: 0, z: 0 } }, easing: 'easeOut' },
      { time: 0.4, bones: { head: { x: 0, y: 15, z: 5 } }, easing: 'easeInOut' },
      { time: 1.2, bones: { head: { x: 0, y: 18, z: 6 } }, easing: 'easeInOut' },
      { time: 1.0, bones: { head: { x: 0, y: 0, z: 0 } }, easing: 'easeIn' },
    ],
  },
};
