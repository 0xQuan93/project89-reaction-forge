import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

/**
 * Serialize an AnimationClip to JSON format
 * This allows us to save FBX animation data and reload it later
 */
export interface SerializedAnimationClip {
  name: string;
  duration: number;
  tracks: SerializedTrack[];
}

interface SerializedTrack {
  name: string;
  type: 'quaternion' | 'vector' | 'number';
  times: number[];
  values: number[];
}

/**
 * VRM Bone Name Mapping
 * 
 * Maps various bone naming conventions to standard VRM humanoid bone names.
 * Supports:
 * 1. VRM Standard: Normalized_rightUpperArm
 * 2. Legacy/Unity: Normalized_upper_armR, Normalized_shoulderR
 * 3. Direct: rightUpperArm, hips
 * 
 * Based on CharacterStudio patterns: https://github.com/M3-org/CharacterStudio
 */
const VRM_BONE_MAP: Record<string, VRMHumanBoneName> = {
  // ============================================
  // VRM Standard Normalized names (camelCase)
  // ============================================
  'Normalized_hips': 'hips' as VRMHumanBoneName,
  'Normalized_spine': 'spine' as VRMHumanBoneName,
  'Normalized_chest': 'chest' as VRMHumanBoneName,
  'Normalized_upperChest': 'upperChest' as VRMHumanBoneName,
  'Normalized_neck': 'neck' as VRMHumanBoneName,
  'Normalized_head': 'head' as VRMHumanBoneName,
  // Left side
  'Normalized_leftShoulder': 'leftShoulder' as VRMHumanBoneName,
  'Normalized_leftUpperArm': 'leftUpperArm' as VRMHumanBoneName,
  'Normalized_leftLowerArm': 'leftLowerArm' as VRMHumanBoneName,
  'Normalized_leftHand': 'leftHand' as VRMHumanBoneName,
  'Normalized_leftUpperLeg': 'leftUpperLeg' as VRMHumanBoneName,
  'Normalized_leftLowerLeg': 'leftLowerLeg' as VRMHumanBoneName,
  'Normalized_leftFoot': 'leftFoot' as VRMHumanBoneName,
  'Normalized_leftToes': 'leftToes' as VRMHumanBoneName,
  // Right side
  'Normalized_rightShoulder': 'rightShoulder' as VRMHumanBoneName,
  'Normalized_rightUpperArm': 'rightUpperArm' as VRMHumanBoneName,
  'Normalized_rightLowerArm': 'rightLowerArm' as VRMHumanBoneName,
  'Normalized_rightHand': 'rightHand' as VRMHumanBoneName,
  'Normalized_rightUpperLeg': 'rightUpperLeg' as VRMHumanBoneName,
  'Normalized_rightLowerLeg': 'rightLowerLeg' as VRMHumanBoneName,
  'Normalized_rightFoot': 'rightFoot' as VRMHumanBoneName,
  'Normalized_rightToes': 'rightToes' as VRMHumanBoneName,
  
  // ============================================
  // Legacy/Unity style (underscore + L/R suffix)
  // Used in older JSON animation files
  // ============================================
  // Shoulders
  'Normalized_shoulderL': 'leftShoulder' as VRMHumanBoneName,
  'Normalized_shoulderR': 'rightShoulder' as VRMHumanBoneName,
  // Arms
  'Normalized_upper_armL': 'leftUpperArm' as VRMHumanBoneName,
  'Normalized_upper_armR': 'rightUpperArm' as VRMHumanBoneName,
  'Normalized_lower_armL': 'leftLowerArm' as VRMHumanBoneName,
  'Normalized_lower_armR': 'rightLowerArm' as VRMHumanBoneName,
  'Normalized_handL': 'leftHand' as VRMHumanBoneName,
  'Normalized_handR': 'rightHand' as VRMHumanBoneName,
  // Legs
  'Normalized_upper_legL': 'leftUpperLeg' as VRMHumanBoneName,
  'Normalized_upper_legR': 'rightUpperLeg' as VRMHumanBoneName,
  'Normalized_lower_legL': 'leftLowerLeg' as VRMHumanBoneName,
  'Normalized_lower_legR': 'rightLowerLeg' as VRMHumanBoneName,
  'Normalized_footL': 'leftFoot' as VRMHumanBoneName,
  'Normalized_footR': 'rightFoot' as VRMHumanBoneName,
  'Normalized_toesL': 'leftToes' as VRMHumanBoneName,
  'Normalized_toesR': 'rightToes' as VRMHumanBoneName,
  
  // ============================================
  // Finger bones (VRM Standard)
  // ============================================
  // Left hand fingers
  'Normalized_leftThumbProximal': 'leftThumbProximal' as VRMHumanBoneName,
  'Normalized_leftThumbIntermediate': 'leftThumbIntermediate' as VRMHumanBoneName,
  'Normalized_leftThumbDistal': 'leftThumbDistal' as VRMHumanBoneName,
  'Normalized_leftIndexProximal': 'leftIndexProximal' as VRMHumanBoneName,
  'Normalized_leftIndexIntermediate': 'leftIndexIntermediate' as VRMHumanBoneName,
  'Normalized_leftIndexDistal': 'leftIndexDistal' as VRMHumanBoneName,
  'Normalized_leftMiddleProximal': 'leftMiddleProximal' as VRMHumanBoneName,
  'Normalized_leftMiddleIntermediate': 'leftMiddleIntermediate' as VRMHumanBoneName,
  'Normalized_leftMiddleDistal': 'leftMiddleDistal' as VRMHumanBoneName,
  'Normalized_leftRingProximal': 'leftRingProximal' as VRMHumanBoneName,
  'Normalized_leftRingIntermediate': 'leftRingIntermediate' as VRMHumanBoneName,
  'Normalized_leftRingDistal': 'leftRingDistal' as VRMHumanBoneName,
  'Normalized_leftLittleProximal': 'leftLittleProximal' as VRMHumanBoneName,
  'Normalized_leftLittleIntermediate': 'leftLittleIntermediate' as VRMHumanBoneName,
  'Normalized_leftLittleDistal': 'leftLittleDistal' as VRMHumanBoneName,
  // Right hand fingers
  'Normalized_rightThumbProximal': 'rightThumbProximal' as VRMHumanBoneName,
  'Normalized_rightThumbIntermediate': 'rightThumbIntermediate' as VRMHumanBoneName,
  'Normalized_rightThumbDistal': 'rightThumbDistal' as VRMHumanBoneName,
  'Normalized_rightIndexProximal': 'rightIndexProximal' as VRMHumanBoneName,
  'Normalized_rightIndexIntermediate': 'rightIndexIntermediate' as VRMHumanBoneName,
  'Normalized_rightIndexDistal': 'rightIndexDistal' as VRMHumanBoneName,
  'Normalized_rightMiddleProximal': 'rightMiddleProximal' as VRMHumanBoneName,
  'Normalized_rightMiddleIntermediate': 'rightMiddleIntermediate' as VRMHumanBoneName,
  'Normalized_rightMiddleDistal': 'rightMiddleDistal' as VRMHumanBoneName,
  'Normalized_rightRingProximal': 'rightRingProximal' as VRMHumanBoneName,
  'Normalized_rightRingIntermediate': 'rightRingIntermediate' as VRMHumanBoneName,
  'Normalized_rightRingDistal': 'rightRingDistal' as VRMHumanBoneName,
  'Normalized_rightLittleProximal': 'rightLittleProximal' as VRMHumanBoneName,
  'Normalized_rightLittleIntermediate': 'rightLittleIntermediate' as VRMHumanBoneName,
  'Normalized_rightLittleDistal': 'rightLittleDistal' as VRMHumanBoneName,
  
  // ============================================
  // Direct VRM bone names (from MotionEngine)
  // ============================================
  'hips': 'hips' as VRMHumanBoneName,
  'spine': 'spine' as VRMHumanBoneName,
  'chest': 'chest' as VRMHumanBoneName,
  'upperChest': 'upperChest' as VRMHumanBoneName,
  'neck': 'neck' as VRMHumanBoneName,
  'head': 'head' as VRMHumanBoneName,
  // Left side
  'leftShoulder': 'leftShoulder' as VRMHumanBoneName,
  'leftUpperArm': 'leftUpperArm' as VRMHumanBoneName,
  'leftLowerArm': 'leftLowerArm' as VRMHumanBoneName,
  'leftHand': 'leftHand' as VRMHumanBoneName,
  'leftUpperLeg': 'leftUpperLeg' as VRMHumanBoneName,
  'leftLowerLeg': 'leftLowerLeg' as VRMHumanBoneName,
  'leftFoot': 'leftFoot' as VRMHumanBoneName,
  'leftToes': 'leftToes' as VRMHumanBoneName,
  // Right side
  'rightShoulder': 'rightShoulder' as VRMHumanBoneName,
  'rightUpperArm': 'rightUpperArm' as VRMHumanBoneName,
  'rightLowerArm': 'rightLowerArm' as VRMHumanBoneName,
  'rightHand': 'rightHand' as VRMHumanBoneName,
  'rightUpperLeg': 'rightUpperLeg' as VRMHumanBoneName,
  'rightLowerLeg': 'rightLowerLeg' as VRMHumanBoneName,
  'rightFoot': 'rightFoot' as VRMHumanBoneName,
  'rightToes': 'rightToes' as VRMHumanBoneName,
  // Fingers (direct names)
  'leftThumbProximal': 'leftThumbProximal' as VRMHumanBoneName,
  'leftThumbIntermediate': 'leftThumbIntermediate' as VRMHumanBoneName,
  'leftThumbDistal': 'leftThumbDistal' as VRMHumanBoneName,
  'leftIndexProximal': 'leftIndexProximal' as VRMHumanBoneName,
  'leftIndexIntermediate': 'leftIndexIntermediate' as VRMHumanBoneName,
  'leftIndexDistal': 'leftIndexDistal' as VRMHumanBoneName,
  'leftMiddleProximal': 'leftMiddleProximal' as VRMHumanBoneName,
  'leftMiddleIntermediate': 'leftMiddleIntermediate' as VRMHumanBoneName,
  'leftMiddleDistal': 'leftMiddleDistal' as VRMHumanBoneName,
  'leftRingProximal': 'leftRingProximal' as VRMHumanBoneName,
  'leftRingIntermediate': 'leftRingIntermediate' as VRMHumanBoneName,
  'leftRingDistal': 'leftRingDistal' as VRMHumanBoneName,
  'leftLittleProximal': 'leftLittleProximal' as VRMHumanBoneName,
  'leftLittleIntermediate': 'leftLittleIntermediate' as VRMHumanBoneName,
  'leftLittleDistal': 'leftLittleDistal' as VRMHumanBoneName,
  'rightThumbProximal': 'rightThumbProximal' as VRMHumanBoneName,
  'rightThumbIntermediate': 'rightThumbIntermediate' as VRMHumanBoneName,
  'rightThumbDistal': 'rightThumbDistal' as VRMHumanBoneName,
  'rightIndexProximal': 'rightIndexProximal' as VRMHumanBoneName,
  'rightIndexIntermediate': 'rightIndexIntermediate' as VRMHumanBoneName,
  'rightIndexDistal': 'rightIndexDistal' as VRMHumanBoneName,
  'rightMiddleProximal': 'rightMiddleProximal' as VRMHumanBoneName,
  'rightMiddleIntermediate': 'rightMiddleIntermediate' as VRMHumanBoneName,
  'rightMiddleDistal': 'rightMiddleDistal' as VRMHumanBoneName,
  'rightRingProximal': 'rightRingProximal' as VRMHumanBoneName,
  'rightRingIntermediate': 'rightRingIntermediate' as VRMHumanBoneName,
  'rightRingDistal': 'rightRingDistal' as VRMHumanBoneName,
  'rightLittleProximal': 'rightLittleProximal' as VRMHumanBoneName,
  'rightLittleIntermediate': 'rightLittleIntermediate' as VRMHumanBoneName,
  'rightLittleDistal': 'rightLittleDistal' as VRMHumanBoneName,
};

/**
 * Convert THREE.AnimationClip to JSON-serializable format
 */
export function serializeAnimationClip(clip: THREE.AnimationClip): SerializedAnimationClip {
  const tracks: SerializedTrack[] = [];

  clip.tracks.forEach(track => {
    let type: 'quaternion' | 'vector' | 'number';
    
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      type = 'quaternion';
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      type = 'vector';
    } else if (track instanceof THREE.NumberKeyframeTrack) {
      type = 'number';
    } else {
      console.warn('[serializeAnimationClip] Unknown track type:', track.constructor.name);
      return;
    }

    tracks.push({
      name: track.name,
      type,
      times: Array.from(track.times),
      values: Array.from(track.values),
    });
  });

  return {
    name: clip.name,
    duration: clip.duration,
    tracks,
  };
}

/**
 * Convert serialized format back to THREE.AnimationClip
 */
export function deserializeAnimationClip(data: SerializedAnimationClip): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  data.tracks.forEach(trackData => {
    let track: THREE.KeyframeTrack;

    switch (trackData.type) {
      case 'quaternion':
        track = new THREE.QuaternionKeyframeTrack(
          trackData.name,
          trackData.times,
          trackData.values
        );
        break;
      case 'vector':
        track = new THREE.VectorKeyframeTrack(
          trackData.name,
          trackData.times,
          trackData.values
        );
        break;
      case 'number':
        track = new THREE.NumberKeyframeTrack(
          trackData.name,
          trackData.times,
          trackData.values
        );
        break;
      default:
        console.warn('[deserializeAnimationClip] Unknown track type:', trackData.type);
        return;
    }

    tracks.push(track);
  });

  return new THREE.AnimationClip(data.name, data.duration, tracks);
}

/**
 * Get the hierarchical path to a node from the root
 */
function getNodePath(node: THREE.Object3D, root: THREE.Object3D): string | null {
  const path: string[] = [];
  let current: THREE.Object3D | null = node;

  while (current && current !== root) {
    path.unshift(current.name);
    current = current.parent;
  }

  if (current === root) {
    return path.join('/');
  }

  return null;
}

/**
 * Extract VRM bone name from a track name like "VRMHumanoidRig/Normalized_hips/Normalized_spine.quaternion"
 */
function extractBoneNameFromTrack(trackName: string): VRMHumanBoneName | null {
  // Extract the last bone name before the property (e.g., ".quaternion" or ".position")
  const propertyMatch = trackName.match(/^(.+)\.(quaternion|position|scale)$/);
  if (!propertyMatch) return null;
  
  const pathPart = propertyMatch[1];
  const parts = pathPart.split('/');
  const lastPart = parts[parts.length - 1];
  
  // Try to find this in our bone map
  if (VRM_BONE_MAP[lastPart]) {
    return VRM_BONE_MAP[lastPart];
  }
  
  return null;
}

/**
 * Retarget an animation clip to work with a specific VRM model
 * This converts VRMHumanoidRig paths to actual scene node paths
 */
export function retargetAnimationClip(clip: THREE.AnimationClip, vrm: VRM): THREE.AnimationClip {
  const retargetedTracks: THREE.KeyframeTrack[] = [];
  let successCount = 0;
  let failCount = 0;
  const failedTracks: string[] = [];

  console.log(`[retargetAnimationClip] Processing clip "${clip.name}" with ${clip.tracks.length} tracks`);

  clip.tracks.forEach(track => {
    const boneName = extractBoneNameFromTrack(track.name);
    
    if (!boneName) {
      // Track doesn't match VRM bone pattern, keep as-is
      console.log(`[retargetAnimationClip] Keeping track as-is (no bone match): ${track.name}`);
      retargetedTracks.push(track);
      return;
    }

    // Get the actual bone node from VRM humanoid
    const boneNode = vrm.humanoid?.getNormalizedBoneNode(boneName);
    if (!boneNode) {
      failCount++;
      failedTracks.push(`${track.name} (bone not found: ${boneName})`);
      return;
    }

    // Get the actual scene path
    const nodePath = getNodePath(boneNode, vrm.scene);
    if (!nodePath) {
      failCount++;
      failedTracks.push(`${track.name} (no scene path for: ${boneName})`);
      return;
    }

    // Extract the property (.quaternion, .position, etc)
    const propertyMatch = track.name.match(/\.(quaternion|position|scale)$/);
    const property = propertyMatch ? propertyMatch[0] : '.quaternion';

    // Create new track with correct path
    const newTrackName = `${nodePath}${property}`;
    
    let newTrack: THREE.KeyframeTrack;
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      newTrack = new THREE.QuaternionKeyframeTrack(
        newTrackName,
        Array.from(track.times),
        Array.from(track.values)
      );
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      newTrack = new THREE.VectorKeyframeTrack(
        newTrackName,
        Array.from(track.times),
        Array.from(track.values)
      );
    } else {
      newTrack = new THREE.NumberKeyframeTrack(
        newTrackName,
        Array.from(track.times),
        Array.from(track.values)
      );
    }

    retargetedTracks.push(newTrack);
    successCount++;
  });

  console.log(`[retargetAnimationClip] Retargeted ${successCount} tracks, ${failCount} failed for "${clip.name}"`);
  
  if (failedTracks.length > 0) {
    console.warn('[retargetAnimationClip] Failed tracks:', failedTracks);
  }
  
  if (successCount === 0 && clip.tracks.length > 0) {
    console.error('[retargetAnimationClip] WARNING: No tracks were successfully retargeted! Animation may not play.');
  }

  return new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
}

/**
 * Check if serialized animation data is valid
 */
export function isValidAnimationData(data: any): data is SerializedAnimationClip {
  return (
    data &&
    typeof data.name === 'string' &&
    typeof data.duration === 'number' &&
    Array.isArray(data.tracks) &&
    data.tracks.every((track: any) =>
      typeof track.name === 'string' &&
      typeof track.type === 'string' &&
      Array.isArray(track.times) &&
      Array.isArray(track.values)
    )
  );
}

