import * as THREE from 'three';
import dawnRunner from './dawn-runner.json';
import sunsetCall from './sunset-call.json';
import cipherWhisper from './cipher-whisper.json';
import nebulaDrift from './nebula-drift.json';
import signalReverie from './signal-reverie.json';
import agentTaunt from './agent-taunt.json';
import agentDance from './agent-dance.json';
import agentClapping from './agent-clapping.json';
import sillyAgent from './silly-agent.json';
import simpleWave from './simple-wave.json';
import point from './point.json';
import defeat from './defeat.json';
import focus from './focus.json';
import ropeClimb from './rope-climb.json';
import climbTop from './climb-top.json';
import thumbsUp from './thumbs-up.json';
import offensiveIdle from './offensive-idle.json';
import waking from './waking.json';
import treadingWater from './treading-water.json';
import cheering from './cheering.json';
import type { PoseId } from '../types/reactions';
import type { VRMPose } from '@pixiv/three-vrm';

type EulerDegrees = {
  x?: number;
  y?: number;
  z?: number;
};

export type PoseDefinition = {
  sceneRotation?: EulerDegrees;
  vrmPose?: VRMPose;
  boneRotations?: Record<string, EulerDegrees>;
  // Optional: animation clip for animated poses
  animationClip?: THREE.AnimationClip;
  // Optional: is this an animated pose?
  isAnimated?: boolean;
};

const poseLibrary: Record<PoseId, PoseDefinition> = {
  'dawn-runner': dawnRunner as unknown as PoseDefinition,
  'sunset-call': sunsetCall as unknown as PoseDefinition,
  'cipher-whisper': cipherWhisper as unknown as PoseDefinition,
  'nebula-drift': nebulaDrift as unknown as PoseDefinition,
  'signal-reverie': signalReverie as unknown as PoseDefinition,
  'agent-taunt': agentTaunt as unknown as PoseDefinition,
  'agent-dance': agentDance as unknown as PoseDefinition,
  'agent-clapping': agentClapping as unknown as PoseDefinition,
  'silly-agent': sillyAgent as unknown as PoseDefinition,
  'simple-wave': simpleWave as unknown as PoseDefinition,
  'point': point as unknown as PoseDefinition,
  'defeat': defeat as unknown as PoseDefinition,
  'focus': focus as unknown as PoseDefinition,
  'rope-climb': ropeClimb as unknown as PoseDefinition,
  'climb-top': climbTop as unknown as PoseDefinition,
  'thumbs-up': thumbsUp as unknown as PoseDefinition,
  'offensive-idle': offensiveIdle as unknown as PoseDefinition,
  'waking': waking as unknown as PoseDefinition,
  'treading-water': treadingWater as unknown as PoseDefinition,
  'cheering': cheering as unknown as PoseDefinition,
};

/**
 * Get pose definition, optionally loading animation clip
 */
export function getPoseDefinition(id: PoseId): PoseDefinition | undefined {
  return poseLibrary[id];
}

/**
 * Get pose definition with animation clip loaded (async)
 * Use this when you need the full animation data
 * 
 * @param id - The pose ID to get
 * @param vrm - Optional VRM to retarget the animation to. Required for proper playback.
 */
export async function getPoseDefinitionWithAnimation(id: PoseId, vrm?: import('@pixiv/three-vrm').VRM): Promise<PoseDefinition | undefined> {
  const definition = poseLibrary[id];
  if (!definition) return undefined;

  // If animation clip is already loaded AND we don't have a VRM to retarget to, return as-is
  // Note: We should ideally always retarget, but for backwards compatibility we allow cached clips
  if (definition.animationClip && !vrm) {
    return definition;
  }

  // Try to load animation clip from file
  const { loadAnimationClip } = await import('./loadAnimationClip');
  const animationClip = await loadAnimationClip(id, vrm);

  if (animationClip) {
    // Return with the loaded (and potentially retargeted) animation clip
    // Note: We don't cache retargeted clips since they're VRM-specific
    return {
      ...definition,
      animationClip,
      isAnimated: true,
    };
  }

  return definition;
}

