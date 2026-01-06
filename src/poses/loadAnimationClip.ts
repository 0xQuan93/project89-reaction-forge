import * as THREE from 'three';
import { deserializeAnimationClip, isValidAnimationData, retargetAnimationClip, type SerializedAnimationClip } from './animationClipSerializer';
import type { VRM } from '@pixiv/three-vrm';

// Map pose IDs to motion engine animation types
const POSE_TO_MOTION_TYPE: Record<string, 'wave' | 'idle' | 'breath' | 'point' | 'shrug' | 'nod' | 'shake'> = {
  'simple-wave': 'wave',
  'point': 'point',
  'agent-taunt': 'idle',  // Use idle with energy for taunt
  'agent-dance': 'idle',  // Dance will be handled separately
  'agent-clapping': 'idle',
  'silly-agent': 'idle',
  'victory-celebration': 'idle',
  'typing': 'idle',
};

/**
 * Load an animation clip from a JSON file
 * Returns null if the file doesn't exist or is invalid
 * 
 * @param poseId - The pose ID to load animation for
 * @param vrm - Optional VRM to retarget the animation to. If provided, track names will be converted to actual scene paths.
 */
export async function loadAnimationClip(poseId: string, vrm?: VRM): Promise<THREE.AnimationClip | null> {
  // First try to load from JSON file
  try {
    const animationModule = await import(`./${poseId}-animation.json`);
    const data = animationModule.default;

    if (!isValidAnimationData(data)) {
      console.warn(`[loadAnimationClip] Invalid animation data for: ${poseId}`);
      // Fall through to procedural generation
    } else {
      let clip = deserializeAnimationClip(data as SerializedAnimationClip);
      
      // If VRM is provided, retarget the animation to use actual scene paths
      if (vrm) {
        clip = retargetAnimationClip(clip, vrm);
        
        // Check if retargeting was successful (has valid tracks)
        if (clip.tracks.length === 0) {
          console.warn(`[loadAnimationClip] Retargeting failed for: ${poseId}, falling back to procedural`);
          // Fall through to procedural generation
        } else {
          console.log(`[loadAnimationClip] Loaded animation clip for: ${poseId}`, {
            duration: clip.duration,
            tracks: clip.tracks.length,
            retargeted: true
          });
          return clip;
        }
      } else {
        console.log(`[loadAnimationClip] Loaded animation clip for: ${poseId} (no retargeting)`, {
          duration: clip.duration,
          tracks: clip.tracks.length
        });
        return clip;
      }
    }
  } catch {
    // Animation file doesn't exist - try procedural generation
    console.log(`[loadAnimationClip] No JSON animation file for: ${poseId}, trying procedural generation`);
  }
  
  // Fall back to procedural animation generation
  return generateProceduralAnimation(poseId, vrm);
}

/**
 * Generate a procedural animation for a pose using the MotionEngine
 */
async function generateProceduralAnimation(poseId: string, vrm?: VRM): Promise<THREE.AnimationClip | null> {
  const motionType = POSE_TO_MOTION_TYPE[poseId];
  
  if (!motionType) {
    console.log(`[loadAnimationClip] No procedural animation mapping for: ${poseId}`);
    return null;
  }
  
  try {
    // Dynamically import to avoid circular dependencies
    const { generateAnimation } = await import('./generateAnimations');
    const { retargetAnimationClip: retarget } = await import('./animationClipSerializer');
    
    // Generate the animation
    let clip = generateAnimation(motionType, {
      duration: 2.0,
      fps: 30,
      energy: 1.0,
    });
    
    // Rename the clip to match the pose ID
    clip = new THREE.AnimationClip(
      `${poseId}-procedural`,
      clip.duration,
      clip.tracks
    );
    
    // Retarget if VRM is provided
    if (vrm) {
      clip = retarget(clip, vrm);
    }
    
    console.log(`[loadAnimationClip] Generated procedural animation for: ${poseId}`, {
      duration: clip.duration,
      tracks: clip.tracks.length,
      retargeted: !!vrm
    });
    
    return clip;
  } catch (error) {
    console.error(`[loadAnimationClip] Failed to generate procedural animation for: ${poseId}`, error);
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

