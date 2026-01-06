import * as THREE from 'three';
import dawnRunner from './dawn-runner.json';
import sunsetCall from './sunset-call.json';
import cipherWhisper from './cipher-whisper.json';
import nebulaDrift from './nebula-drift.json';
import signalReverie from './signal-reverie.json';
import typing from './typing.json';
import agentTaunt from './agent-taunt.json';
import agentDance from './agent-dance.json';
import agentClapping from './agent-clapping.json';
import sillyAgent from './silly-agent.json';
import victoryCelebration from './victory-celebration.json';
import simpleWave from './simple-wave.json';
import point from './point.json';
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
  'dawn-runner': dawnRunner as PoseDefinition,
  'sunset-call': sunsetCall as PoseDefinition,
  'cipher-whisper': cipherWhisper as PoseDefinition,
  'nebula-drift': nebulaDrift as PoseDefinition,
  'signal-reverie': signalReverie as PoseDefinition,
  'typing': typing as PoseDefinition,
  'agent-taunt': agentTaunt as PoseDefinition,
  'agent-dance': agentDance as PoseDefinition,
  'agent-clapping': agentClapping as PoseDefinition,
  'silly-agent': sillyAgent as PoseDefinition,
  'victory-celebration': victoryCelebration as PoseDefinition,
  'simple-wave': simpleWave as PoseDefinition,
  'point': point as unknown as PoseDefinition,
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

