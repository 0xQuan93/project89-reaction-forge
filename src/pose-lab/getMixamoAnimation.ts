import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { VRMRigMapMixamo, findMixamoNode } from './VRMRigMapMixamo';

const _restRotationInverse = new THREE.Quaternion();
const _parentRestWorldRotation = new THREE.Quaternion();
const _quatA = new THREE.Quaternion();
const _tempVec = new THREE.Vector3();

const shouldFlipMixamoAxes = (vrm: VRM): boolean => {
  const metaVersion = `${vrm.meta?.metaVersion ?? ''}`.trim();
  if (!metaVersion) {
    return true;
  }
  return metaVersion.startsWith('0') || metaVersion.startsWith('1');
};

export function getMixamoAnimation(
  animations: THREE.AnimationClip[],
  mixamoRoot: THREE.Object3D,
  vrm: VRM,
): THREE.AnimationClip | null {
  if (!animations?.length || !mixamoRoot || !vrm?.humanoid) {
    return null;
  }

  const clip =
    THREE.AnimationClip.findByName(animations, 'mixamo.com') ??
    THREE.AnimationClip.findByName(animations, 'Mixamo.com') ??
    animations[0];

  if (!clip) {
    return null;
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const shouldFlipAxes = shouldFlipMixamoAxes(vrm);

  const hipsNode = findMixamoNode(mixamoRoot, 'mixamorigHips') ?? findMixamoNode(mixamoRoot, 'mixamorig:Hips');
  const motionHipsHeight = Math.abs(hipsNode?.position?.y ?? 1);
  const vrmHipsY = vrm.humanoid.getNormalizedBoneNode('hips')?.getWorldPosition(_tempVec).y ?? 0;
  const vrmRootY = vrm.scene.getWorldPosition(_tempVec).y;
  const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
  const hipsPositionScale = motionHipsHeight > 0 ? vrmHipsHeight / motionHipsHeight : 1;

  let convertedTracks = 0;

  clip.tracks.forEach((origTrack) => {
    const track = origTrack.clone();
    const [mixamoBoneName, propertyName] = track.name.split('.');
    if (!mixamoBoneName || !propertyName) return;

    const vrmBoneName = VRMRigMapMixamo[mixamoBoneName];
    if (!vrmBoneName) {
      return;
    }

    const mixamoRigNode = findMixamoNode(mixamoRoot, mixamoBoneName);
    if (!mixamoRigNode) return;

    const normalizedNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName as any);
    if (!normalizedNode) return;

    mixamoRigNode.getWorldQuaternion(_restRotationInverse).invert();
    if (mixamoRigNode.parent) {
      mixamoRigNode.parent.getWorldQuaternion(_parentRestWorldRotation);
    } else {
      _parentRestWorldRotation.identity();
    }

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      for (let i = 0; i < track.values.length; i += 4) {
        const flatQuaternion = track.values.slice(i, i + 4);
        _quatA.fromArray(flatQuaternion);
        _quatA.premultiply(_parentRestWorldRotation).multiply(_restRotationInverse);
        _quatA.toArray(flatQuaternion);
        for (let j = 0; j < flatQuaternion.length; j++) {
          const value = flatQuaternion[j];
          track.values[i + j] = shouldFlipAxes && j % 2 === 0 ? -value : value;
        }
      }

      tracks.push(new THREE.QuaternionKeyframeTrack(`${vrmBoneName}.${propertyName}`, track.times, track.values));
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      const modified = track.values.map((value, index) => {
        const flipped = shouldFlipAxes && index % 3 !== 1 ? -value : value;
        return flipped * hipsPositionScale;
      });
      tracks.push(new THREE.VectorKeyframeTrack(`${vrmBoneName}.${propertyName}`, track.times, modified));
    }

    convertedTracks++;
  });

  if (!tracks.length) {
    console.warn(
      'Mixamo conversion produced 0 tracks',
      JSON.stringify({
        clip: clip.name,
        totalTracks: clip.tracks.length,
        convertedTracks,
      }),
    );
    return null;
  }

  console.info(
    'Mixamo conversion complete',
    JSON.stringify({
      clip: clip.name,
      duration: clip.duration,
      totalTracks: clip.tracks.length,
      convertedTracks,
      sampleTrack: tracks[0]?.name ?? 'none',
    }),
  );

  return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
}
