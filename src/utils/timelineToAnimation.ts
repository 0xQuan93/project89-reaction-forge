import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import type { TimelineSequence } from '../types/timeline';

/**
 * Converts a TimelineSequence into a THREE.AnimationClip
 * capable of being played by the AnimationManager on the given VRM.
 */
export function timelineToAnimationClip(sequence: TimelineSequence, vrm: VRM): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  
  // 1. Identify all participating bones
  // We map Node Name -> { times: [], values: [] }
  const rotationTracks = new Map<string, { times: number[], values: number[] }>();
  const positionTracks = new Map<string, { times: number[], values: number[] }>();

  // Helper to get track data or create it
  const getRotationTrack = (nodeName: string) => {
    if (!rotationTracks.has(nodeName)) {
      rotationTracks.set(nodeName, { times: [], values: [] });
    }
    return rotationTracks.get(nodeName)!;
  };

  const getPositionTrack = (nodeName: string) => {
    if (!positionTracks.has(nodeName)) {
      positionTracks.set(nodeName, { times: [], values: [] });
    }
    return positionTracks.get(nodeName)!;
  };

  // 2. Iterate through keyframes and gather data
  // Sort keyframes by time just in case
  const sortedKeyframes = [...sequence.keyframes].sort((a, b) => a.time - b.time);

  sortedKeyframes.forEach((kf) => {
    if (!kf.pose) return;

    Object.entries(kf.pose).forEach(([boneName, transform]) => {
      // Resolve VRM bone name to actual Object3D node
      // We accept generic VRMHumanBoneName strings here
      const node = vrm.humanoid?.getNormalizedBoneNode(boneName as any);
      
      if (!node) return;

      // Handle Rotation
      if (transform.rotation) {
        const trackData = getRotationTrack(node.name);
        trackData.times.push(kf.time);
        // VRM Pose rotation is [x, y, z, w]
        trackData.values.push(...transform.rotation);
      }

      // Handle Position (mostly for Hips)
      if (transform.position) {
        const trackData = getPositionTrack(node.name);
        trackData.times.push(kf.time);
        // VRM Pose position is [x, y, z]
        trackData.values.push(...transform.position);
      }
    });
  });

  // 3. Create KeyframeTracks
  rotationTracks.forEach((data, nodeName) => {
    if (data.times.length > 0) {
      // Create Quaternion track
      // Name format: "NodeName.quaternion"
      tracks.push(new THREE.QuaternionKeyframeTrack(
        `${nodeName}.quaternion`,
        data.times,
        data.values
      ));
    }
  });

  positionTracks.forEach((data, nodeName) => {
    if (data.times.length > 0) {
      // Create Vector track
      // Name format: "NodeName.position"
      tracks.push(new THREE.VectorKeyframeTrack(
        `${nodeName}.position`,
        data.times,
        data.values
      ));
    }
  });

  // 4. Build AnimationClip
  const clip = new THREE.AnimationClip(
    'TimelineAnimation',
    sequence.duration,
    tracks
  );

  return clip;
}

