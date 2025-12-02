import type { VRM } from '@pixiv/three-vrm';
import type { VRMPose } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { posesToAnimationClip } from './poseToAnimation';

/**
 * Create animated variations of poses
 * These add subtle movements to make poses feel alive
 */

/**
 * Create a swaying animation for Stand Tall pose
 * Adds subtle weight shift and breathing
 */
export function createStandTallAnimation(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  // Clone the base pose
  const pose1 = JSON.parse(JSON.stringify(basePose)) as VRMPose;
  const pose2 = JSON.parse(JSON.stringify(basePose)) as VRMPose;
  const pose3 = JSON.parse(JSON.stringify(basePose)) as VRMPose;
  const pose4 = JSON.parse(JSON.stringify(basePose)) as VRMPose;

  // Add subtle sway to hips (weight shift)
  if (pose2.hips?.rotation) {
    const [x, y, z, w] = pose2.hips.rotation;
    const quat = new THREE.Quaternion(x, y, z, w);
    const sway = new THREE.Euler(0, 0.05, 0); // 5 degrees sway
    quat.multiply(new THREE.Quaternion().setFromEuler(sway));
    pose2.hips.rotation = [quat.x, quat.y, quat.z, quat.w];
  }

  // Opposite sway
  if (pose4.hips?.rotation) {
    const [x, y, z, w] = pose4.hips.rotation;
    const quat = new THREE.Quaternion(x, y, z, w);
    const sway = new THREE.Euler(0, -0.05, 0);
    quat.multiply(new THREE.Quaternion().setFromEuler(sway));
    pose4.hips.rotation = [quat.x, quat.y, quat.z, quat.w];
  }

  // Add breathing to spine
  if (pose2.spine?.rotation) {
    const [x, y, z, w] = pose2.spine.rotation;
    const quat = new THREE.Quaternion(x, y, z, w);
    const breath = new THREE.Euler(0.03, 0, 0); // Slight forward lean
    quat.multiply(new THREE.Quaternion().setFromEuler(breath));
    pose2.spine.rotation = [quat.x, quat.y, quat.z, quat.w];
  }

  // Create animation from 4 poses (creates smooth loop)
  return posesToAnimationClip([pose1, pose2, pose3, pose4, pose1], vrm, 0.8, 'stand-tall-sway');
}

/**
 * Create a typing animation
 * Adds hand/arm movement for typing motion
 */
export function createTypingAnimation(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  const frameCount = 8;

  for (let i = 0; i < frameCount; i++) {
    const pose = JSON.parse(JSON.stringify(basePose)) as VRMPose;
    const t = i / frameCount;
    
    // Animate left hand (typing motion)
    if (pose.leftHand?.rotation) {
      const [x, y, z, w] = pose.leftHand.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      const typing = new THREE.Euler(Math.sin(t * Math.PI * 4) * 0.1, 0, 0);
      quat.multiply(new THREE.Quaternion().setFromEuler(typing));
      pose.leftHand.rotation = [quat.x, quat.y, quat.z, quat.w];
    }

    // Animate right hand (typing motion, offset)
    if (pose.rightHand?.rotation) {
      const [x, y, z, w] = pose.rightHand.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      const typing = new THREE.Euler(Math.sin((t + 0.5) * Math.PI * 4) * 0.1, 0, 0);
      quat.multiply(new THREE.Quaternion().setFromEuler(typing));
      pose.rightHand.rotation = [quat.x, quat.y, quat.z, quat.w];
    }

    frames.push(pose);
  }

  return posesToAnimationClip(frames, vrm, 0.15, 'typing-motion');
}

/**
 * Create an idle breathing animation
 * Adds subtle chest/spine movement
 */
export function createIdleBreathing(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  const frameCount = 12;

  for (let i = 0; i < frameCount; i++) {
    const pose = JSON.parse(JSON.stringify(basePose)) as VRMPose;
    const t = i / frameCount;
    const breathCycle = Math.sin(t * Math.PI * 2);
    
    // Breathing motion in chest
    if (pose.chest?.rotation) {
      const [x, y, z, w] = pose.chest.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      const breath = new THREE.Euler(breathCycle * 0.02, 0, 0);
      quat.multiply(new THREE.Quaternion().setFromEuler(breath));
      pose.chest.rotation = [quat.x, quat.y, quat.z, quat.w];
    }

    // Subtle spine movement
    if (pose.spine?.rotation) {
      const [x, y, z, w] = pose.spine.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      const breath = new THREE.Euler(breathCycle * 0.015, 0, 0);
      quat.multiply(new THREE.Quaternion().setFromEuler(breath));
      pose.spine.rotation = [quat.x, quat.y, quat.z, quat.w];
    }

    frames.push(pose);
  }

  return posesToAnimationClip(frames, vrm, 0.25, 'idle-breathing');
}

/**
 * Create a taunt animation with movement
 * Adds playful gestures
 */
export function createTauntAnimation(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  const frameCount = 16;

  for (let i = 0; i < frameCount; i++) {
    const pose = JSON.parse(JSON.stringify(basePose)) as VRMPose;
    const t = i / frameCount;
    
    // Hip sway
    if (pose.hips?.rotation) {
      const [x, y, z, w] = pose.hips.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      const sway = new THREE.Euler(0, Math.sin(t * Math.PI * 2) * 0.1, 0);
      quat.multiply(new THREE.Quaternion().setFromEuler(sway));
      pose.hips.rotation = [quat.x, quat.y, quat.z, quat.w];
    }

    // Head tilt
    if (pose.head?.rotation) {
      const [x, y, z, w] = pose.head.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      const tilt = new THREE.Euler(0, 0, Math.sin(t * Math.PI * 2) * 0.08);
      quat.multiply(new THREE.Quaternion().setFromEuler(tilt));
      pose.head.rotation = [quat.x, quat.y, quat.z, quat.w];
    }

    frames.push(pose);
  }

  return posesToAnimationClip(frames, vrm, 0.12, 'taunt-motion');
}

/**
 * Get or create an animated version of a pose
 */
export function getAnimatedPose(poseId: string, basePose: VRMPose, vrm: VRM): THREE.AnimationClip | null {
  switch (poseId) {
    case 'stand-tall':
      return createStandTallAnimation(basePose, vrm);
    case 'typing':
      return createTypingAnimation(basePose, vrm);
    case 'agent-taunt':
      return createTauntAnimation(basePose, vrm);
    default:
      // For other poses, add idle breathing
      return createIdleBreathing(basePose, vrm);
  }
}

