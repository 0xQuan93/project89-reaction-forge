import * as THREE from 'three';
import { deserializeAnimationClip, isValidAnimationData, type SerializedAnimationClip } from './animationClipSerializer';

/**
 * Load an animation clip from a JSON file
 * Returns null if the file doesn't exist or is invalid
 */
export async function loadAnimationClip(poseId: string): Promise<THREE.AnimationClip | null> {
  try {
    // Try to import the animation file
    const animationModule = await import(`./${poseId}-animation.json`);
    const data = animationModule.default;

    if (!isValidAnimationData(data)) {
      console.warn(`[loadAnimationClip] Invalid animation data for: ${poseId}`);
      return null;
    }

    const clip = deserializeAnimationClip(data as SerializedAnimationClip);
    console.log(`[loadAnimationClip] Loaded animation clip for: ${poseId}`, {
      duration: clip.duration,
      tracks: clip.tracks.length,
    });

    return clip;
  } catch (error) {
    // Animation file doesn't exist - this is OK, not all poses have animations
    console.log(`[loadAnimationClip] No animation file for: ${poseId}`);
    return null;
  }
}

/**
 * Preload animation clips for multiple poses
 * Useful for batch loading at startup
 */
export async function preloadAnimationClips(poseIds: string[]): Promise<Map<string, THREE.AnimationClip>> {
  const clips = new Map<string, THREE.AnimationClip>();

  await Promise.all(
    poseIds.map(async (poseId) => {
      const clip = await loadAnimationClip(poseId);
      if (clip) {
        clips.set(poseId, clip);
      }
    })
  );

  console.log(`[preloadAnimationClips] Loaded ${clips.size} animation clips`);
  return clips;
}

