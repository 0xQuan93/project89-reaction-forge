/**
 * Generate Animation JSON Files
 * 
 * This utility generates animation JSON files using the MotionEngine,
 * which produces animations with correct VRM bone names that can be
 * retargeted to any VRM model.
 * 
 * VRM Coordinate System (following CharacterStudio conventions):
 * - X-axis: Pitch (forward/back rotation, positive = forward/down)
 * - Y-axis: Yaw (left/right rotation, positive = left)
 * - Z-axis: Roll (clockwise/counter-clockwise)
 * 
 * For arms in T-pose:
 * - rightUpperArm Z negative = raise arm up (abduction)
 * - rightLowerArm Y positive = bend elbow (forearm toward body)
 * - leftUpperArm Z positive = raise arm up
 * - leftLowerArm Y negative = bend elbow
 * 
 * Run this script to regenerate animation files when needed.
 */

import { motionEngine } from './motionEngine';
import { serializeAnimationClip } from './animationClipSerializer';
import * as THREE from 'three';

/**
 * Base poses for each animation type
 * Values are in degrees, matching AvatarController gesture definitions
 */
const basePoses: Record<string, any> = {
  wave: {
    // Right arm raised and bent for waving
    rightUpperArm: { x: -10, y: 0, z: -75 },  // Z negative = raise arm
    rightLowerArm: { x: 0, y: 80, z: 0 },     // Y positive = bend elbow
    rightHand: { x: 0, y: 0, z: 0 },
    // Slight body engagement
    spine: { x: 0, y: 3, z: 2 },
  },
  point: {
    // Arm forward and slightly up for pointing
    rightUpperArm: { x: -20, y: 60, z: -15 },
    rightLowerArm: { x: 0, y: 15, z: 0 },
    rightHand: { x: 10, y: 0, z: 0 },
    // Head looks at pointing direction
    head: { x: 0, y: -10, z: 0 },
    spine: { x: 0, y: -5, z: 0 },
    // Index finger extended, others curled
    rightIndexProximal: { x: 0, y: 0, z: 0 },
    rightMiddleProximal: { x: 0, y: 0, z: -90 },
    rightRingProximal: { x: 0, y: 0, z: -90 },
    rightLittleProximal: { x: 0, y: 0, z: -90 },
    rightThumbProximal: { x: 0, y: -30, z: -45 },
  },
  idle: {
    // Subtle breathing pose
    spine: { x: 1, y: 0, z: 0 },
    chest: { x: 1, y: 0, z: 0 },
  },
  breath: {
    // Same as idle
    spine: { x: 1, y: 0, z: 0 },
    chest: { x: 1, y: 0, z: 0 },
  },
  nod: {
    // Head will nod in the animation
    head: { x: 0, y: 0, z: 0 },
    neck: { x: 0, y: 0, z: 0 },
  },
  shake: {
    // Head will shake in the animation
    head: { x: 0, y: 0, z: 0 },
    neck: { x: 0, y: 0, z: 0 },
  },
  shrug: {
    // Shoulders raised, arms out with palms up
    rightShoulder: { x: 0, y: 0, z: -20 },   // Lift shoulder
    leftShoulder: { x: 0, y: 0, z: 20 },
    rightUpperArm: { x: 0, y: 15, z: -25 },  // Arms flare out
    leftUpperArm: { x: 0, y: -15, z: 25 },
    rightLowerArm: { x: 0, y: 30, z: 0 },    // Slight bend
    leftLowerArm: { x: 0, y: -30, z: 0 },
    rightHand: { x: 0, y: 30, z: 0 },        // Palms up
    leftHand: { x: 0, y: -30, z: 0 },
    head: { x: 5, y: 0, z: 8 },              // Tilt head
    spine: { x: -3, y: 0, z: 0 },
  },
};

/**
 * Generate an animation clip using the MotionEngine
 */
export function generateAnimation(
  type: 'wave' | 'idle' | 'breath' | 'point' | 'shrug' | 'nod' | 'shake',
  config?: {
    duration?: number;
    fps?: number;
    energy?: number;
    emotion?: 'neutral' | 'happy' | 'sad' | 'alert' | 'tired' | 'nervous';
  }
): THREE.AnimationClip {
  const basePose = basePoses[type] || {};
  
  // Generate procedural animation data
  const animationData = motionEngine.generateProceduralAnimation(basePose, type, {
    duration: config?.duration || 2.0,
    fps: config?.fps || 30,
    energy: config?.energy || 1.0,
    emotion: config?.emotion || 'neutral',
  });
  
  // Convert to THREE.AnimationClip
  const tracks: THREE.KeyframeTrack[] = [];
  
  animationData.tracks.forEach(trackData => {
    let track: THREE.KeyframeTrack;
    
    if (trackData.type === 'quaternion') {
      track = new THREE.QuaternionKeyframeTrack(
        trackData.name,
        trackData.times,
        trackData.values
      );
    } else if (trackData.type === 'vector') {
      track = new THREE.VectorKeyframeTrack(
        trackData.name,
        trackData.times,
        trackData.values
      );
    } else {
      track = new THREE.NumberKeyframeTrack(
        trackData.name,
        trackData.times,
        trackData.values
      );
    }
    
    tracks.push(track);
  });
  
  return new THREE.AnimationClip(animationData.name, animationData.duration, tracks);
}

/**
 * Generate and serialize an animation to JSON format
 * The output can be saved to a file and loaded later
 */
export function generateAnimationJSON(
  type: 'wave' | 'idle' | 'breath' | 'point' | 'shrug' | 'nod' | 'shake',
  config?: {
    duration?: number;
    fps?: number;
    energy?: number;
    emotion?: 'neutral' | 'happy' | 'sad' | 'alert' | 'tired' | 'nervous';
  }
): string {
  const clip = generateAnimation(type, config);
  const serialized = serializeAnimationClip(clip);
  return JSON.stringify(serialized, null, 2);
}

// Export for use in other modules
export { motionEngine };

