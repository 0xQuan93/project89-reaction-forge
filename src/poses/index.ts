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
  'point': point as PoseDefinition,
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
 */
export async function getPoseDefinitionWithAnimation(id: PoseId): Promise<PoseDefinition | undefined> {
  const definition = poseLibrary[id];
  if (!definition) return undefined;

  // If animation clip is already loaded, return as-is
  if (definition.animationClip) {
    return definition;
  }

  // Try to load animation clip from file
  const { loadAnimationClip } = await import('./loadAnimationClip');
  const animationClip = await loadAnimationClip(id);

  if (animationClip) {
    // Cache the loaded animation clip
    return {
      ...definition,
      animationClip,
      isAnimated: true,
    };
  }

  return definition;
}

