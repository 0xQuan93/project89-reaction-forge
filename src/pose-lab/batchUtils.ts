import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { type VRM } from '@pixiv/three-vrm';
import { getMixamoAnimation } from './getMixamoAnimation';
import { poseFromClip } from './poseFromClip';
import { convertAnimationToScenePaths } from './convertAnimationToScenePaths';
import type { PoseId } from '../types/reactions';

const DEFAULT_SCENE_ROTATION = { y: 180 };

export const mixamoSources = {
  pointing: '/poses/fbx/Pointing.fbx',
  thumbsUp: '/poses/fbx/Standing Thumbs Up.fbx',
  waking: '/poses/fbx/Waking.fbx',
  cheering: '/poses/fbx/Cheering.fbx',
  clapping: '/poses/fbx/Clapping.fbx',
  happyIdle: '/poses/fbx/Happy Idle.fbx',
  offensiveIdle: '/poses/fbx/Offensive Idle.fbx',
  focus: '/poses/fbx/Focus.fbx',
  ropeClimb: '/poses/fbx/Rope Climb.fbx',
  sillyDancing: '/poses/fbx/Silly Dancing.fbx',
  taunt: '/poses/fbx/Taunt.fbx',
  treadingWater: '/poses/fbx/Treading Water.fbx',
  defeat: '/poses/fbx/Defeat.fbx',
  climbingToTop: '/poses/fbx/Climbing To Top.fbx',
};

export type BatchPoseConfig = {
  id: PoseId;
  label: string;
  source: string;
  fileName: string;
  sceneRotation?: { x?: number; y?: number; z?: number };
};

export const batchConfigs: BatchPoseConfig[] = [
  // Replacements
  { id: 'point', label: 'Point', source: mixamoSources.pointing, fileName: 'Pointing.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'simple-wave', label: 'Wave (Happy Idle)', source: mixamoSources.happyIdle, fileName: 'Happy Idle.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'agent-clapping', label: 'Agent Clapping', source: mixamoSources.clapping, fileName: 'Clapping.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'agent-taunt', label: 'Agent Taunt', source: mixamoSources.taunt, fileName: 'Taunt.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'silly-agent', label: 'Silly Agent', source: mixamoSources.sillyDancing, fileName: 'Silly Dancing.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  
  // New
  { id: 'defeat', label: 'Defeat', source: mixamoSources.defeat, fileName: 'Defeat.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'focus', label: 'Focus', source: mixamoSources.focus, fileName: 'Focus.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'rope-climb', label: 'Rope Climb', source: mixamoSources.ropeClimb, fileName: 'Rope Climb.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'climb-top', label: 'Climb Top', source: mixamoSources.climbingToTop, fileName: 'Climbing To Top.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'thumbs-up', label: 'Thumbs Up', source: mixamoSources.thumbsUp, fileName: 'Standing Thumbs Up.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'offensive-idle', label: 'Offensive Idle', source: mixamoSources.offensiveIdle, fileName: 'Offensive Idle.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'waking', label: 'Waking', source: mixamoSources.waking, fileName: 'Waking.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'treading-water', label: 'Treading Water', source: mixamoSources.treadingWater, fileName: 'Treading Water.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
  { id: 'cheering', label: 'Cheering', source: mixamoSources.cheering, fileName: 'Cheering.fbx', sceneRotation: DEFAULT_SCENE_ROTATION },
];

export const loadMixamoFromBuffer = async (arrayBuffer: ArrayBuffer, fileName: string) => {
  const ext = fileName.toLowerCase().split('.').pop();
  let mixamoRoot: THREE.Object3D;
  let animations: THREE.AnimationClip[] = [];

  if (ext === 'fbx') {
    const loader = new FBXLoader();
    const group = loader.parse(arrayBuffer, '');
    mixamoRoot = group;
    animations = group.animations;
  } else {
    const loader = new GLTFLoader();
    const gltf = await loader.parseAsync(arrayBuffer, '');
    mixamoRoot = gltf.scene || gltf;
    animations = gltf.animations;
  }

  return { mixamoRoot, animations };
};

export const applyMixamoBuffer = async (arrayBuffer: ArrayBuffer, fileName: string, vrm: VRM) => {
    const { mixamoRoot, animations } = await loadMixamoFromBuffer(arrayBuffer, fileName);

    const vrmClip = getMixamoAnimation(animations, mixamoRoot, vrm);
    if (!vrmClip) {
      throw new Error('Failed to convert Mixamo data for this VRM.');
    }

    // Convert animation to use scene node paths (critical for playback in main app)
    const scenePathClip = convertAnimationToScenePaths(vrmClip, vrm);
    console.log('[BatchUtils] Converted animation to scene paths');

    const pose = poseFromClip(vrmClip);
    if (!pose || !Object.keys(pose).length) {
      throw new Error('Mixamo clip did not contain pose data.');
    }

    vrm.humanoid?.setNormalizedPose(pose);
    vrm.update(0);

    return { pose, animationClip: scenePathClip };
};

export const savePoseToDisk = async (
    poseId: PoseId,
    payload: {
      sceneRotation?: { x?: number; y?: number; z?: number };
      vrmPose: any; // VRMPose
      animationClip?: THREE.AnimationClip;
    }
  ) => {
    // Save pose JSON
    const response = await fetch('/__pose-export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ poseId, data: payload }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to save pose');
    }

    // If animation clip exists, save it separately
    if (payload.animationClip) {
      const { serializeAnimationClip } = await import('../poses/animationClipSerializer');
      const serialized = serializeAnimationClip(payload.animationClip);
      
      const animResponse = await fetch('/__pose-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poseId: `${poseId}-animation`,
          data: serialized,
        }),
      });
      if (!animResponse.ok) {
        console.warn('Failed to save animation clip for', poseId);
      }
    }
};
