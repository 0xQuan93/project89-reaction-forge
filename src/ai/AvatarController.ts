/**
 * AI Avatar Controller
 * 
 * This module provides the AI with complete control over the VRM avatar,
 * including poses, expressions, animations, and procedural movements.
 * 
 * The AI is the "soul" of the avatar - it can make it move, emote, gesture,
 * and respond naturally to any situation.
 * 
 * Based on best practices from CharacterStudio (https://github.com/M3-org/CharacterStudio)
 * and VRM specification standards.
 */

import * as THREE from 'three';
import { avatarManager } from '../three/avatarManager';
import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import type { VRMPose } from '@pixiv/three-vrm';
import type { PoseId } from '../types/reactions';

// VRM Standard Bone Names (from @pixiv/three-vrm specification)
// These match CharacterStudio's implementation
// Reference: https://github.com/M3-org/CharacterStudio
export const VRM_BONE_NAMES: VRMHumanBoneName[] = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  // Fingers (optional but important for gestures)
  'leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal',
  'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
  'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
  'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
  'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  'rightThumbProximal', 'rightThumbIntermediate', 'rightThumbDistal',
  'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
  'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
  'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
  'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
] as VRMHumanBoneName[];

// ============================================================================
// TYPES
// ============================================================================

export type EmotionState = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'excited' | 'tired' | 'nervous';

export type GestureType = 
  | 'wave' | 'nod' | 'shake' | 'shrug' | 'point' 
  | 'thumbsUp' | 'clap' | 'bow' | 'celebrate' 
  | 'think' | 'listen' | 'acknowledge';

export type BodyLanguage = 
  | 'open' | 'closed' | 'confident' | 'shy' 
  | 'attentive' | 'relaxed' | 'tense' | 'curious';

export interface AvatarState {
  emotion: EmotionState;
  bodyLanguage: BodyLanguage;
  isAnimating: boolean;
  isSpeaking: boolean;
  currentGesture: GestureType | null;
  lookTarget: THREE.Vector3 | null;
}

export interface ActionCommand {
  type: 'gesture' | 'pose' | 'expression' | 'look' | 'speak' | 'idle';
  value: string;
  intensity?: number;  // 0-1
  duration?: number;   // seconds
  blend?: boolean;     // smooth transition
}

// ============================================================================
// EASING FUNCTIONS (for natural animation)
// ============================================================================

const Easing = {
  // Slow start, fast end
  easeIn: (t: number) => t * t,
  
  // Fast start, slow end  
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  
  // Slow start and end
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  
  // Overshoot then settle (anticipation)
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  
  // Bounce effect
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  
  // Organic breathing curve
  breath: (t: number) => (1 - Math.cos(t * Math.PI * 2)) / 2,
  
  // Natural sway
  sway: (t: number, frequency = 1) => Math.sin(t * Math.PI * 2 * frequency),
};

// ============================================================================
// EXPRESSION PRESETS
// ============================================================================

const EXPRESSION_PRESETS: Record<EmotionState, Record<string, number>> = {
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
// GESTURE DEFINITIONS (in degrees, converted to radians when applied)
// ============================================================================

interface GestureKeyframe {
  time: number;  // 0-1 normalized
  bones: Partial<Record<VRMHumanBoneName, { x: number; y: number; z: number }>>;
  easing?: keyof typeof Easing;
}

/**
 * Helper to safely get a bone node from VRM humanoid
 * Following CharacterStudio's pattern of null-safe bone access
 */
function getBoneNode(vrm: any, boneName: VRMHumanBoneName): THREE.Object3D | null {
  if (!vrm?.humanoid) return null;
  return vrm.humanoid.getNormalizedBoneNode(boneName);
}

/**
 * Apply rotation to a bone using Euler angles (in degrees)
 * Converts to quaternion for smooth interpolation
 * Exported for use by other modules (e.g., MotionEngine)
 */
export function applyBoneRotation(
  bone: THREE.Object3D,
  rotation: { x: number; y: number; z: number },
  intensity = 1.0
): void {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotation.x * intensity),
    THREE.MathUtils.degToRad(rotation.y * intensity),
    THREE.MathUtils.degToRad(rotation.z * intensity),
    'XYZ'
  );
  bone.quaternion.setFromEuler(euler);
}

/**
 * Smoothly interpolate between two bone rotations using SLERP
 * This is the key to natural-looking animations
 */
function slerpBoneRotation(
  bone: THREE.Object3D,
  fromRot: { x: number; y: number; z: number },
  toRot: { x: number; y: number; z: number },
  t: number,
  intensity = 1.0
): void {
  const fromQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(fromRot.x * intensity),
      THREE.MathUtils.degToRad(fromRot.y * intensity),
      THREE.MathUtils.degToRad(fromRot.z * intensity),
      'XYZ'
    )
  );
  
  const toQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(toRot.x * intensity),
      THREE.MathUtils.degToRad(toRot.y * intensity),
      THREE.MathUtils.degToRad(toRot.z * intensity),
      'XYZ'
    )
  );
  
  bone.quaternion.slerpQuaternions(fromQuat, toQuat, t);
}

/**
 * Gesture Library
 * 
 * VRM Coordinate System (following CharacterStudio conventions):
 * - X-axis: Pitch (forward/back rotation, positive = forward)
 * - Y-axis: Yaw (left/right rotation, positive = left)
 * - Z-axis: Roll (clockwise/counter-clockwise, positive = counter-clockwise)
 * 
 * For arms in T-pose:
 * - rightUpperArm Z negative = raise arm up
 * - rightLowerArm Y positive = bend elbow (forearm toward body)
 * - leftUpperArm Z positive = raise arm up
 * - leftLowerArm Y negative = bend elbow
 */
const GESTURE_LIBRARY: Record<GestureType, { duration: number; keyframes: GestureKeyframe[] }> = {
  wave: {
    duration: 1.8,
    keyframes: [
      // Start: Anticipation - slight pull back before raising arm
      { time: 0, bones: { 
        rightUpperArm: { x: 5, y: 0, z: 5 }, 
        rightLowerArm: { x: 0, y: 10, z: 0 }, 
        rightHand: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Raise arm up (shoulder abduction)
      { time: 0.15, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -70 },  // Z negative raises arm
        rightLowerArm: { x: 0, y: 70, z: 0 },     // Y positive bends elbow
        rightHand: { x: 0, y: 0, z: -10 },
        spine: { x: 0, y: 3, z: 2 }               // Slight body turn toward wave
      }, easing: 'easeOutBack' },
      // Wave motion 1 (wrist rotation)
      { time: 0.3, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -75 }, 
        rightLowerArm: { x: 0, y: 80, z: 0 }, 
        rightHand: { x: 0, y: -25, z: 15 },      // Wrist waves
        spine: { x: 0, y: 3, z: 2 }
      }, easing: 'easeInOut' },
      // Wave motion 2
      { time: 0.45, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -75 }, 
        rightLowerArm: { x: 0, y: 80, z: 0 }, 
        rightHand: { x: 0, y: 25, z: -15 },
        spine: { x: 0, y: 3, z: 2 }
      }, easing: 'easeInOut' },
      // Wave motion 3
      { time: 0.6, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -75 }, 
        rightLowerArm: { x: 0, y: 80, z: 0 }, 
        rightHand: { x: 0, y: -25, z: 15 },
        spine: { x: 0, y: 3, z: 2 }
      }, easing: 'easeInOut' },
      // Wave motion 4
      { time: 0.75, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -75 }, 
        rightLowerArm: { x: 0, y: 80, z: 0 }, 
        rightHand: { x: 0, y: 25, z: -15 },
        spine: { x: 0, y: 3, z: 2 }
      }, easing: 'easeInOut' },
      // Return with follow-through
      { time: 1.0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 0 }, 
        rightLowerArm: { x: 0, y: 0, z: 0 }, 
        rightHand: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  nod: {
    duration: 1.0,
    keyframes: [
      // Start neutral
      { time: 0, bones: { 
        head: { x: 0, y: 0, z: 0 }, 
        neck: { x: 0, y: 0, z: 0 } 
      }, easing: 'easeOut' },
      // First nod down (agreement)
      { time: 0.2, bones: { 
        head: { x: 15, y: 0, z: 0 },   // X positive = look down
        neck: { x: 5, y: 0, z: 0 } 
      }, easing: 'easeInOut' },
      // Back up with slight overshoot
      { time: 0.4, bones: { 
        head: { x: -8, y: 0, z: 0 },   // Slight overshoot up
        neck: { x: -3, y: 0, z: 0 } 
      }, easing: 'easeInOut' },
      // Second smaller nod
      { time: 0.6, bones: { 
        head: { x: 10, y: 0, z: 0 }, 
        neck: { x: 3, y: 0, z: 0 } 
      }, easing: 'easeInOut' },
      // Return to neutral
      { time: 1.0, bones: { 
        head: { x: 0, y: 0, z: 0 }, 
        neck: { x: 0, y: 0, z: 0 } 
      }, easing: 'easeIn' },
    ],
  },
  shake: {
    duration: 1.0,
    keyframes: [
      { time: 0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Turn right
      { time: 0.15, bones: { 
        head: { x: 0, y: -20, z: 0 },  // Y negative = turn right
        neck: { x: 0, y: -5, z: 0 }
      }, easing: 'easeInOut' },
      // Turn left
      { time: 0.35, bones: { 
        head: { x: 0, y: 20, z: 0 },   // Y positive = turn left
        neck: { x: 0, y: 5, z: 0 }
      }, easing: 'easeInOut' },
      // Turn right (smaller)
      { time: 0.55, bones: { 
        head: { x: 0, y: -15, z: 0 },
        neck: { x: 0, y: -3, z: 0 }
      }, easing: 'easeInOut' },
      // Turn left (smaller)
      { time: 0.75, bones: { 
        head: { x: 0, y: 10, z: 0 },
        neck: { x: 0, y: 2, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  shrug: {
    duration: 1.5,
    keyframes: [
      // Start
      { time: 0, bones: { 
        rightShoulder: { x: 0, y: 0, z: 0 }, 
        leftShoulder: { x: 0, y: 0, z: 0 },
        rightUpperArm: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0, y: 0, z: 0 },
        head: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Shoulders up, arms out, head tilt
      { time: 0.25, bones: { 
        rightShoulder: { x: 0, y: 0, z: -20 },  // Lift shoulder
        leftShoulder: { x: 0, y: 0, z: 20 },
        rightUpperArm: { x: 0, y: 15, z: -25 }, // Arms flare out
        leftUpperArm: { x: 0, y: -15, z: 25 },
        rightLowerArm: { x: 0, y: 30, z: 0 },   // Slight bend
        leftLowerArm: { x: 0, y: -30, z: 0 },
        rightHand: { x: 0, y: 30, z: 0 },       // Palms up
        leftHand: { x: 0, y: -30, z: 0 },
        head: { x: 5, y: 0, z: 8 },             // Tilt head
        spine: { x: -3, y: 0, z: 0 }
      }, easing: 'easeOutBack' },
      // Hold with slight head wobble
      { time: 0.5, bones: { 
        rightShoulder: { x: 0, y: 0, z: -20 },
        leftShoulder: { x: 0, y: 0, z: 20 },
        rightUpperArm: { x: 0, y: 15, z: -25 },
        leftUpperArm: { x: 0, y: -15, z: 25 },
        rightLowerArm: { x: 0, y: 30, z: 0 },
        leftLowerArm: { x: 0, y: -30, z: 0 },
        rightHand: { x: 0, y: 30, z: 0 },
        leftHand: { x: 0, y: -30, z: 0 },
        head: { x: 5, y: 0, z: -8 },            // Wobble other way
        spine: { x: -3, y: 0, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        rightShoulder: { x: 0, y: 0, z: 0 }, 
        leftShoulder: { x: 0, y: 0, z: 0 },
        rightUpperArm: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        leftLowerArm: { x: 0, y: 0, z: 0 },
        rightHand: { x: 0, y: 0, z: 0 },
        leftHand: { x: 0, y: 0, z: 0 },
        head: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  point: {
    duration: 1.2,
    keyframes: [
      // Start with anticipation
      { time: 0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 5 },    // Slight wind-up
        rightLowerArm: { x: 0, y: 10, z: 0 },
        head: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Point forward
      { time: 0.25, bones: { 
        rightUpperArm: { x: -20, y: 60, z: -15 },  // Arm forward and slightly up
        rightLowerArm: { x: 0, y: 15, z: 0 },      // Mostly straight
        rightHand: { x: 10, y: 0, z: 0 },          // Wrist aligned
        head: { x: 0, y: -10, z: 0 },              // Look at pointing direction
        spine: { x: 0, y: -5, z: 0 }               // Slight body turn
      }, easing: 'easeOutBack' },
      // Hold point
      { time: 0.7, bones: { 
        rightUpperArm: { x: -20, y: 60, z: -15 },
        rightLowerArm: { x: 0, y: 15, z: 0 },
        rightHand: { x: 10, y: 0, z: 0 },
        head: { x: 0, y: -10, z: 0 },
        spine: { x: 0, y: -5, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        rightHand: { x: 0, y: 0, z: 0 },
        head: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  thumbsUp: {
    duration: 1.2,
    keyframes: [
      // Start
      { time: 0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        rightHand: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Bring arm up, fist with thumb up
      { time: 0.25, bones: { 
        rightUpperArm: { x: 20, y: 30, z: -40 },   // Arm up and forward
        rightLowerArm: { x: 0, y: 100, z: 0 },    // Elbow bent
        rightHand: { x: -30, y: 0, z: 10 },       // Wrist rotated for thumb up
        spine: { x: -3, y: 3, z: 0 }              // Slight lean
      }, easing: 'easeOutBack' },
      // Hold
      { time: 0.7, bones: { 
        rightUpperArm: { x: 20, y: 30, z: -40 },
        rightLowerArm: { x: 0, y: 100, z: 0 },
        rightHand: { x: -30, y: 0, z: 10 },
        spine: { x: -3, y: 3, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        rightHand: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  clap: {
    duration: 2.0,
    keyframes: [
      // Start - arms apart
      { time: 0, bones: { 
        rightUpperArm: { x: 30, y: 20, z: -25 },
        leftUpperArm: { x: 30, y: -20, z: 25 },
        rightLowerArm: { x: 0, y: 50, z: 0 },
        leftLowerArm: { x: 0, y: -50, z: 0 },
        spine: { x: -5, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Clap 1 - hands together
      { time: 0.12, bones: { 
        rightUpperArm: { x: 30, y: 5, z: -15 },
        leftUpperArm: { x: 30, y: -5, z: 15 },
        rightLowerArm: { x: 0, y: 70, z: 0 },
        leftLowerArm: { x: 0, y: -70, z: 0 },
        spine: { x: -3, y: 0, z: 0 }
      }, easing: 'easeIn' },
      // Apart
      { time: 0.24, bones: { 
        rightUpperArm: { x: 30, y: 20, z: -25 },
        leftUpperArm: { x: 30, y: -20, z: 25 },
        rightLowerArm: { x: 0, y: 50, z: 0 },
        leftLowerArm: { x: 0, y: -50, z: 0 },
        spine: { x: -5, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Clap 2
      { time: 0.36, bones: { 
        rightUpperArm: { x: 30, y: 5, z: -15 },
        leftUpperArm: { x: 30, y: -5, z: 15 },
        rightLowerArm: { x: 0, y: 70, z: 0 },
        leftLowerArm: { x: 0, y: -70, z: 0 },
        spine: { x: -3, y: 0, z: 0 }
      }, easing: 'easeIn' },
      // Apart
      { time: 0.48, bones: { 
        rightUpperArm: { x: 30, y: 20, z: -25 },
        leftUpperArm: { x: 30, y: -20, z: 25 },
        rightLowerArm: { x: 0, y: 50, z: 0 },
        leftLowerArm: { x: 0, y: -50, z: 0 },
        spine: { x: -5, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Clap 3
      { time: 0.6, bones: { 
        rightUpperArm: { x: 30, y: 5, z: -15 },
        leftUpperArm: { x: 30, y: -5, z: 15 },
        rightLowerArm: { x: 0, y: 70, z: 0 },
        leftLowerArm: { x: 0, y: -70, z: 0 },
        spine: { x: -3, y: 0, z: 0 }
      }, easing: 'easeIn' },
      // Return
      { time: 1.0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        leftLowerArm: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  bow: {
    duration: 2.5,
    keyframes: [
      // Start
      { time: 0, bones: { 
        spine: { x: 0, y: 0, z: 0 }, 
        chest: { x: 0, y: 0, z: 0 }, 
        head: { x: 0, y: 0, z: 0 },
        hips: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Bow down
      { time: 0.3, bones: { 
        spine: { x: 25, y: 0, z: 0 },      // X positive = bend forward
        chest: { x: 20, y: 0, z: 0 },
        head: { x: 15, y: 0, z: 0 },       // Head follows
        hips: { x: -5, y: 0, z: 0 }        // Slight hip compensation
      }, easing: 'easeInOut' },
      // Hold bow
      { time: 0.6, bones: { 
        spine: { x: 25, y: 0, z: 0 },
        chest: { x: 20, y: 0, z: 0 },
        head: { x: 15, y: 0, z: 0 },
        hips: { x: -5, y: 0, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        spine: { x: 0, y: 0, z: 0 }, 
        chest: { x: 0, y: 0, z: 0 }, 
        head: { x: 0, y: 0, z: 0 },
        hips: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  celebrate: {
    duration: 2.5,
    keyframes: [
      // Start - anticipation crouch
      { time: 0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0, y: 0, z: 0 },
        spine: { x: 5, y: 0, z: 0 },       // Slight crouch
        hips: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Arms up! Victory pose
      { time: 0.2, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -150 },  // Arms way up
        leftUpperArm: { x: -10, y: 0, z: 150 },
        rightLowerArm: { x: 0, y: 25, z: 0 },
        leftLowerArm: { x: 0, y: -25, z: 0 },
        spine: { x: -10, y: 0, z: 0 },            // Lean back
        chest: { x: -5, y: 0, z: 0 },
        head: { x: -10, y: 0, z: 0 }              // Look up
      }, easing: 'easeOutBack' },
      // Sway right
      { time: 0.4, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -145 },
        leftUpperArm: { x: -10, y: 0, z: 155 },
        rightLowerArm: { x: 0, y: 25, z: 0 },
        leftLowerArm: { x: 0, y: -25, z: 0 },
        spine: { x: -8, y: 8, z: 5 },
        chest: { x: -5, y: 0, z: 0 },
        head: { x: -10, y: 5, z: 0 }
      }, easing: 'easeInOut' },
      // Sway left
      { time: 0.6, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -155 },
        leftUpperArm: { x: -10, y: 0, z: 145 },
        rightLowerArm: { x: 0, y: 25, z: 0 },
        leftLowerArm: { x: 0, y: -25, z: 0 },
        spine: { x: -8, y: -8, z: -5 },
        chest: { x: -5, y: 0, z: 0 },
        head: { x: -10, y: -5, z: 0 }
      }, easing: 'easeInOut' },
      // Sway right again
      { time: 0.8, bones: { 
        rightUpperArm: { x: -10, y: 0, z: -145 },
        leftUpperArm: { x: -10, y: 0, z: 155 },
        rightLowerArm: { x: 0, y: 25, z: 0 },
        leftLowerArm: { x: 0, y: -25, z: 0 },
        spine: { x: -8, y: 8, z: 5 },
        chest: { x: -5, y: 0, z: 0 },
        head: { x: -10, y: 5, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        rightUpperArm: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        leftLowerArm: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 },
        chest: { x: 0, y: 0, z: 0 },
        head: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  think: {
    duration: 3.0,
    keyframes: [
      // Start
      { time: 0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        rightUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Hand to chin, head tilted
      { time: 0.3, bones: { 
        head: { x: 10, y: -12, z: 5 },            // Look down and to side
        rightUpperArm: { x: 50, y: 25, z: -30 },  // Arm up toward face
        rightLowerArm: { x: 0, y: 130, z: 0 },   // Bent to bring hand to chin
        rightHand: { x: -20, y: 0, z: -20 },     // Hand positioned at chin
        spine: { x: 3, y: -5, z: 0 }             // Slight lean
      }, easing: 'easeInOut' },
      // Subtle shift while thinking
      { time: 0.6, bones: { 
        head: { x: 12, y: -8, z: 3 },
        rightUpperArm: { x: 50, y: 25, z: -30 },
        rightLowerArm: { x: 0, y: 130, z: 0 },
        rightHand: { x: -20, y: 0, z: -20 },
        spine: { x: 3, y: -5, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        rightUpperArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        rightHand: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  listen: {
    duration: 2.0,
    keyframes: [
      // Start
      { time: 0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Attentive lean, head tilt
      { time: 0.3, bones: { 
        head: { x: 5, y: 12, z: -8 },    // Tilt toward speaker
        neck: { x: 2, y: 5, z: -3 },
        spine: { x: -3, y: 5, z: 0 }     // Lean forward slightly
      }, easing: 'easeInOut' },
      // Hold listening pose
      { time: 0.7, bones: { 
        head: { x: 5, y: 12, z: -8 },
        neck: { x: 2, y: 5, z: -3 },
        spine: { x: -3, y: 5, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 },
        spine: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
  acknowledge: {
    duration: 0.8,
    keyframes: [
      // Start
      { time: 0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 }
      }, easing: 'easeOut' },
      // Quick nod
      { time: 0.35, bones: { 
        head: { x: 12, y: 0, z: 0 },
        neck: { x: 4, y: 0, z: 0 }
      }, easing: 'easeInOut' },
      // Return
      { time: 1.0, bones: { 
        head: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 }
      }, easing: 'easeIn' },
    ],
  },
};

// ============================================================================
// AVATAR CONTROLLER CLASS
// ============================================================================

class AvatarController {
  private state: AvatarState = {
    emotion: 'neutral',
    bodyLanguage: 'relaxed',
    isAnimating: false,
    isSpeaking: false,
    currentGesture: null,
    lookTarget: null,
  };

  private idleAnimationId: number | null = null;
  private expressionTransitionId: number | null = null;
  private breathingEnabled = true;

  // -------------------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------------------

  getState(): AvatarState {
    return { ...this.state };
  }

  // -------------------------------------------------------------------------
  // EMOTION CONTROL
  // -------------------------------------------------------------------------

  /**
   * Set the avatar's emotional state with smooth transition
   */
  async setEmotion(emotion: EmotionState, transitionDuration = 0.5): Promise<void> {
    const vrm = avatarManager.getVRM();
    if (!vrm?.expressionManager) return;

    this.state.emotion = emotion;
    const targetExpressions = EXPRESSION_PRESETS[emotion];

    // Animate expression transition
    const startExpressions: Record<string, number> = {};
    
    // Get current expression values
    Object.keys(targetExpressions).forEach(name => {
      const expr = vrm.expressionManager!.getExpression(name);
      startExpressions[name] = expr?.weight ?? 0;
    });

    const startTime = performance.now();
    
    return new Promise(resolve => {
      const animate = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = Math.min(elapsed / transitionDuration, 1);
        const easedT = Easing.easeInOut(t);

        Object.entries(targetExpressions).forEach(([name, targetValue]) => {
          const startValue = startExpressions[name] || 0;
          const currentValue = startValue + (targetValue - startValue) * easedT;
          vrm.expressionManager!.setValue(name, currentValue);
        });

        vrm.expressionManager!.update();

        if (t < 1) {
          this.expressionTransitionId = requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      if (this.expressionTransitionId) {
        cancelAnimationFrame(this.expressionTransitionId);
      }
      animate();
    });
  }

  // -------------------------------------------------------------------------
  // GESTURE CONTROL
  // -------------------------------------------------------------------------

  /**
   * Perform a gesture animation
   * Uses keyframe interpolation with proper easing following CharacterStudio patterns
   */
  async performGesture(gesture: GestureType, intensity = 1.0): Promise<void> {
    const vrm = avatarManager.getVRM();
    if (!vrm?.humanoid) {
      console.warn(`[AvatarController] No VRM loaded, cannot perform gesture: ${gesture}`);
      return;
    }

    const gestureData = GESTURE_LIBRARY[gesture];
    if (!gestureData) {
      console.warn(`[AvatarController] Unknown gesture: ${gesture}`);
      return;
    }

    // Don't interrupt ongoing gestures
    if (this.state.isAnimating && this.state.currentGesture) {
      console.log(`[AvatarController] Gesture ${this.state.currentGesture} in progress, queuing ${gesture}`);
      // Wait for current gesture to finish
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.state.isAnimating) return;
    }

    this.state.isAnimating = true;
    this.state.currentGesture = gesture;
    console.log(`[AvatarController] Starting gesture: ${gesture} (intensity: ${intensity})`);

    const duration = gestureData.duration * 1000; // Convert to ms
    const startTime = performance.now();

    // Store initial bone states for blending
    const initialStates = new Map<string, THREE.Quaternion>();
    
    // Collect all bones used in this gesture
    const allBoneNames = new Set<string>();
    gestureData.keyframes.forEach(kf => {
      Object.keys(kf.bones || {}).forEach(b => allBoneNames.add(b));
    });

    // Capture initial states
    allBoneNames.forEach(boneName => {
      const boneNode = getBoneNode(vrm, boneName as VRMHumanBoneName);
      if (boneNode) {
        initialStates.set(boneName, boneNode.quaternion.clone());
      }
    });
    
    return new Promise(resolve => {
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const normalizedTime = Math.min(elapsed / duration, 1);

        // Find the two keyframes we're between
        const keyframes = gestureData.keyframes;
        let prevKeyframe = keyframes[0];
        let nextKeyframe = keyframes[keyframes.length - 1];
        
        for (let i = 0; i < keyframes.length - 1; i++) {
          if (normalizedTime >= keyframes[i].time && normalizedTime <= keyframes[i + 1].time) {
            prevKeyframe = keyframes[i];
            nextKeyframe = keyframes[i + 1];
            break;
          }
        }

        // Calculate interpolation factor between keyframes
        const keyframeDuration = nextKeyframe.time - prevKeyframe.time;
        const keyframeProgress = keyframeDuration > 0 
          ? (normalizedTime - prevKeyframe.time) / keyframeDuration 
          : 1;

        // Apply easing for natural motion
        const easingFn = nextKeyframe.easing ? Easing[nextKeyframe.easing] : Easing.easeInOut;
        const easedProgress = easingFn(keyframeProgress);

        // Apply bone rotations using SLERP interpolation
        allBoneNames.forEach(boneName => {
          const boneNode = getBoneNode(vrm, boneName as VRMHumanBoneName);
          if (!boneNode) return;

          const prevRot = prevKeyframe.bones?.[boneName as VRMHumanBoneName] || { x: 0, y: 0, z: 0 };
          const nextRot = nextKeyframe.bones?.[boneName as VRMHumanBoneName] || { x: 0, y: 0, z: 0 };

          // Use SLERP for smooth quaternion interpolation
          slerpBoneRotation(boneNode, prevRot, nextRot, easedProgress, intensity);
        });

        // Update VRM (following CharacterStudio pattern)
        vrm.humanoid!.update();
        vrm.update(0);

        if (normalizedTime < 1) {
          requestAnimationFrame(animate);
        } else {
          this.state.isAnimating = false;
          this.state.currentGesture = null;
          console.log(`[AvatarController] Gesture complete: ${gesture}`);
          resolve();
        }
      };

      animate();
    });
  }

  // -------------------------------------------------------------------------
  // POSE CONTROL
  // -------------------------------------------------------------------------

  /**
   * Apply a preset pose
   */
  async applyPose(poseId: PoseId, animated = true): Promise<void> {
    try {
      await avatarManager.applyPose(poseId, animated, animated ? 'loop' : 'static');
    } catch (e) {
      console.error(`[AvatarController] Failed to apply pose: ${poseId}`, e);
    }
  }

  /**
   * Apply a custom pose from bone rotations
   */
  async applyCustomPose(
    boneRotations: Partial<Record<VRMHumanBoneName, { x: number; y: number; z: number }>>,
    _transitionDuration = 0.5
  ): Promise<void> {
    const vrm = avatarManager.getVRM();
    if (!vrm?.humanoid) return;

    // Build VRMPose from bone rotations
    const pose: VRMPose = {};
    Object.entries(boneRotations).forEach(([boneName, rotation]) => {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rotation.x),
        THREE.MathUtils.degToRad(rotation.y),
        THREE.MathUtils.degToRad(rotation.z),
        'XYZ'
      );
      const quat = new THREE.Quaternion().setFromEuler(euler);
      pose[boneName as VRMHumanBoneName] = { rotation: [quat.x, quat.y, quat.z, quat.w] };
    });

    // Apply with smooth transition
    await avatarManager.applyRawPose({ vrmPose: pose }, 'static');
  }

  // -------------------------------------------------------------------------
  // IDLE ANIMATION
  // -------------------------------------------------------------------------

  /**
   * Start subtle idle animation (breathing, micro-movements)
   */
  startIdleAnimation(): void {
    if (this.idleAnimationId) return;

    const vrm = avatarManager.getVRM();
    if (!vrm?.humanoid) return;

    let time = 0;
    const breathFrequency = 0.15; // breaths per second
    const swayFrequency = 0.05;   // sway cycles per second

    const animate = () => {
      if (!this.breathingEnabled || this.state.isAnimating) {
        this.idleAnimationId = requestAnimationFrame(animate);
        return;
      }

      time += 0.016; // ~60fps

      // Breathing
      const breathPhase = Easing.breath(time * breathFrequency);
      const breathAmount = breathPhase * 2; // degrees

      // Apply breathing to spine/chest
      const spine = vrm.humanoid!.getNormalizedBoneNode('spine' as VRMHumanBoneName);
      const chest = vrm.humanoid!.getNormalizedBoneNode('chest' as VRMHumanBoneName);
      
      if (spine) {
        const euler = new THREE.Euler(THREE.MathUtils.degToRad(breathAmount * 0.5), 0, 0, 'XYZ');
        spine.quaternion.setFromEuler(euler);
      }
      if (chest) {
        const euler = new THREE.Euler(THREE.MathUtils.degToRad(breathAmount), 0, 0, 'XYZ');
        chest.quaternion.setFromEuler(euler);
      }

      // Subtle weight shift
      const swayPhase = Easing.sway(time * swayFrequency);
      const hips = vrm.humanoid!.getNormalizedBoneNode('hips' as VRMHumanBoneName);
      if (hips) {
        const euler = new THREE.Euler(0, THREE.MathUtils.degToRad(swayPhase * 0.5), THREE.MathUtils.degToRad(swayPhase * 1), 'XYZ');
        hips.quaternion.setFromEuler(euler);
      }

      vrm.humanoid!.update();
      vrm.update(0);

      this.idleAnimationId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Stop idle animation
   */
  stopIdleAnimation(): void {
    if (this.idleAnimationId) {
      cancelAnimationFrame(this.idleAnimationId);
      this.idleAnimationId = null;
    }
  }

  // -------------------------------------------------------------------------
  // SPEAKING ANIMATION
  // -------------------------------------------------------------------------

  /**
   * Trigger speaking visual feedback
   */
  startSpeaking(): void {
    this.state.isSpeaking = true;
    
    // Add subtle head movements while speaking
    const vrm = avatarManager.getVRM();
    if (!vrm?.humanoid) return;

    let time = 0;
    const speakingLoop = () => {
      if (!this.state.isSpeaking) return;

      time += 0.016;
      
      const head = vrm.humanoid!.getNormalizedBoneNode('head' as VRMHumanBoneName);
      if (head) {
        // Subtle nodding and tilting while speaking
        const nodAmount = Math.sin(time * 3) * 2;
        const tiltAmount = Math.sin(time * 1.5) * 1;
        const euler = new THREE.Euler(
          THREE.MathUtils.degToRad(nodAmount),
          THREE.MathUtils.degToRad(tiltAmount),
          0,
          'XYZ'
        );
        head.quaternion.setFromEuler(euler);
      }

      vrm.humanoid!.update();
      vrm.update(0);

      requestAnimationFrame(speakingLoop);
    };

    speakingLoop();
  }

  /**
   * Stop speaking animation
   */
  stopSpeaking(): void {
    this.state.isSpeaking = false;
  }

  // -------------------------------------------------------------------------
  // COMPOUND ACTIONS (for AI)
  // -------------------------------------------------------------------------

  /**
   * Execute a compound action that combines gesture + expression
   */
  async executeAction(action: ActionCommand): Promise<void> {
    console.log(`[AvatarController] Executing action:`, action);

    switch (action.type) {
      case 'gesture':
        await this.performGesture(action.value as GestureType, action.intensity ?? 1.0);
        break;
      
      case 'expression':
        await this.setEmotion(action.value as EmotionState, action.duration ?? 0.5);
        break;
      
      case 'pose':
        await this.applyPose(action.value as PoseId, action.blend ?? true);
        break;
      
      case 'speak':
        this.startSpeaking();
        break;
      
      case 'idle':
        this.startIdleAnimation();
        break;
      
      default:
        console.warn(`[AvatarController] Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute multiple actions in sequence
   */
  async executeSequence(actions: ActionCommand[]): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action);
    }
  }

  /**
   * React naturally to a situation (AI helper)
   */
  async react(situation: string): Promise<void> {
    // Map common situations to actions
    const reactions: Record<string, ActionCommand[]> = {
      greeting: [
        { type: 'expression', value: 'happy' },
        { type: 'gesture', value: 'wave' },
      ],
      agreement: [
        { type: 'expression', value: 'happy' },
        { type: 'gesture', value: 'nod' },
      ],
      disagreement: [
        { type: 'expression', value: 'thinking' },
        { type: 'gesture', value: 'shake' },
      ],
      confusion: [
        { type: 'expression', value: 'surprised' },
        { type: 'gesture', value: 'shrug' },
      ],
      excitement: [
        { type: 'expression', value: 'excited' },
        { type: 'gesture', value: 'celebrate' },
      ],
      thinking: [
        { type: 'expression', value: 'thinking' },
        { type: 'gesture', value: 'think' },
      ],
      listening: [
        { type: 'expression', value: 'neutral' },
        { type: 'gesture', value: 'listen' },
      ],
      acknowledgment: [
        { type: 'expression', value: 'happy' },
        { type: 'gesture', value: 'acknowledge' },
      ],
      success: [
        { type: 'expression', value: 'excited' },
        { type: 'gesture', value: 'thumbsUp' },
      ],
      respect: [
        { type: 'expression', value: 'neutral' },
        { type: 'gesture', value: 'bow' },
      ],
    };

    const actionSequence = reactions[situation.toLowerCase()];
    if (actionSequence) {
      await this.executeSequence(actionSequence);
    } else {
      console.warn(`[AvatarController] Unknown situation: ${situation}`);
    }
  }

  // -------------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------------

  cleanup(): void {
    this.stopIdleAnimation();
    if (this.expressionTransitionId) {
      cancelAnimationFrame(this.expressionTransitionId);
    }
    this.state.isSpeaking = false;
    this.state.isAnimating = false;
  }
}

// Export singleton
export const avatarController = new AvatarController();

// Export types and constants for AI use
export { GESTURE_LIBRARY, EXPRESSION_PRESETS, Easing };

