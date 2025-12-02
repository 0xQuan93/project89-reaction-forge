import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { VRMPose, VRMHumanBoneName } from '@pixiv/three-vrm';

/**
 * Convert a VRM pose (static) to an AnimationClip that targets actual scene nodes
 * 
 * CRITICAL: VRM animations must target the actual bone nodes in the scene,
 * not the humanoid bone names. We need the VRM instance to get the node paths.
 */
export function poseToAnimationClip(
  pose: VRMPose,
  vrm: VRM,
  duration = 0.5,
  name = 'pose'
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  // Create keyframe tracks for each bone in the pose
  Object.entries(pose).forEach(([boneName, boneData]) => {
    if (!boneData || !boneData.rotation) return;

    // Get the actual bone node from the VRM humanoid
    const boneNode = vrm.humanoid?.getNormalizedBoneNode(boneName as VRMHumanBoneName);
    if (!boneNode) {
      console.warn(`[poseToAnimation] Bone node not found for: ${boneName}`);
      return;
    }

    // Get the full path to this node in the scene hierarchy
    // This is what THREE.AnimationMixer needs to target
    const nodePath = getNodePath(boneNode, vrm.scene);
    if (!nodePath) {
      console.warn(`[poseToAnimation] Could not get node path for: ${boneName}`);
      return;
    }

    // Create keyframe track targeting the actual scene node
    const times = [0, duration];
    const values = [
      ...boneData.rotation, // Start frame
      ...boneData.rotation, // End frame (same for static pose)
    ];

    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${nodePath}.quaternion`,
        times,
        values
      )
    );
  });

  console.log(`[poseToAnimation] Created animation clip "${name}" with ${tracks.length} tracks`);
  
  return new THREE.AnimationClip(name, duration, tracks);
}

/**
 * Get the hierarchical path to a node from the root
 * Returns format like: "Scene/Armature/Hips"
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
 * Create a looping animation from multiple poses
 * Useful for creating simple animated sequences
 */
export function posesToAnimationClip(
  poses: VRMPose[],
  vrm: VRM,
  frameDuration = 0.5,
  name = 'sequence'
): THREE.AnimationClip {
  if (poses.length === 0) {
    throw new Error('Cannot create animation from empty pose array');
  }

  if (poses.length === 1) {
    return poseToAnimationClip(poses[0], vrm, frameDuration, name);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const boneNames = new Set<VRMHumanBoneName>();

  // Collect all bone names from all poses
  poses.forEach(pose => {
    Object.keys(pose).forEach(boneName => {
      boneNames.add(boneName as VRMHumanBoneName);
    });
  });

  // Create tracks for each bone
  boneNames.forEach(boneName => {
    const boneNode = vrm.humanoid?.getNormalizedBoneNode(boneName);
    if (!boneNode) return;

    const nodePath = getNodePath(boneNode, vrm.scene);
    if (!nodePath) return;

    const rotationTimes: number[] = [];
    const rotationValues: number[] = [];

    poses.forEach((pose, index) => {
      const time = index * frameDuration;
      const boneData = pose[boneName];

      if (boneData?.rotation) {
        rotationTimes.push(time);
        rotationValues.push(...boneData.rotation);
      }
    });

    if (rotationTimes.length > 0) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${nodePath}.quaternion`,
          rotationTimes,
          rotationValues
        )
      );
    }
  });

  const totalDuration = poses.length * frameDuration;
  console.log(`[posesToAnimation] Created sequence "${name}" with ${poses.length} frames, ${tracks.length} tracks, ${totalDuration}s duration`);

  return new THREE.AnimationClip(name, totalDuration, tracks);
}

