import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

/**
 * Convert a VRM animation clip (with bone names) to use actual scene node paths
 * This is critical for the animation to work when loaded in the main app
 * 
 * Input tracks:  "hips.quaternion", "spine.quaternion", etc.
 * Output tracks: "Armature/Hips.quaternion", "Armature/Hips/Spine.quaternion", etc.
 */
export function convertAnimationToScenePaths(
  clip: THREE.AnimationClip,
  vrm: VRM
): THREE.AnimationClip {
  const convertedTracks: THREE.KeyframeTrack[] = [];

  clip.tracks.forEach(track => {
    // Parse the track name: "boneName.property"
    const parts = track.name.split('.');
    if (parts.length < 2) {
      console.warn('[convertAnimationToScenePaths] Invalid track name:', track.name);
      return;
    }

    const boneName = parts[0] as VRMHumanBoneName;
    const property = parts.slice(1).join('.'); // Handle nested properties

    // Get the actual bone node from VRM
    const boneNode = vrm.humanoid?.getNormalizedBoneNode(boneName);
    if (!boneNode) {
      console.warn('[convertAnimationToScenePaths] Bone node not found:', boneName);
      return;
    }

    // Get the full scene path to this node
    const nodePath = getNodePath(boneNode, vrm.scene);
    if (!nodePath) {
      console.warn('[convertAnimationToScenePaths] Could not get node path for:', boneName);
      return;
    }

    // Create new track with scene path
    const newTrackName = `${nodePath}.${property}`;
    let newTrack: THREE.KeyframeTrack;

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      newTrack = new THREE.QuaternionKeyframeTrack(
        newTrackName,
        track.times.slice(),
        track.values.slice()
      );
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      newTrack = new THREE.VectorKeyframeTrack(
        newTrackName,
        track.times.slice(),
        track.values.slice()
      );
    } else if (track instanceof THREE.NumberKeyframeTrack) {
      newTrack = new THREE.NumberKeyframeTrack(
        newTrackName,
        track.times.slice(),
        track.values.slice()
      );
    } else {
      console.warn('[convertAnimationToScenePaths] Unknown track type:', track.constructor.name);
      return;
    }

    convertedTracks.push(newTrack);
  });

  console.log('[convertAnimationToScenePaths] Converted tracks:', {
    original: clip.tracks.length,
    converted: convertedTracks.length,
    sampleOriginal: clip.tracks[0]?.name,
    sampleConverted: convertedTracks[0]?.name,
  });

  // Validate conversion
  if (convertedTracks.length === 0) {
    console.error('[convertAnimationToScenePaths] No tracks were converted!');
    throw new Error('Animation conversion failed - no tracks converted');
  }

  if (convertedTracks.length < clip.tracks.length * 0.5) {
    console.warn('[convertAnimationToScenePaths] Less than 50% of tracks converted', {
      original: clip.tracks.length,
      converted: convertedTracks.length,
    });
  }

  // Verify tracks have scene paths (contain "/")
  const hasScenePaths = convertedTracks.every(track => track.name.includes('/'));
  if (!hasScenePaths) {
    console.error('[convertAnimationToScenePaths] Some tracks do not have scene paths!');
    convertedTracks.forEach(track => {
      if (!track.name.includes('/')) {
        console.error('  Invalid track:', track.name);
      }
    });
    throw new Error('Animation conversion failed - tracks missing scene paths');
  }

  console.log('[convertAnimationToScenePaths] ✅ Validation passed');

  return new THREE.AnimationClip(clip.name, clip.duration, convertedTracks);
}

/**
 * Get the hierarchical path to a node from the root
 * Returns format like: "Armature/Hips" or "Armature/Hips/Spine"
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

