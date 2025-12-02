import * as THREE from 'three';

/**
 * Serialize an AnimationClip to JSON format
 * This allows us to save FBX animation data and reload it later
 */
export interface SerializedAnimationClip {
  name: string;
  duration: number;
  tracks: SerializedTrack[];
}

interface SerializedTrack {
  name: string;
  type: 'quaternion' | 'vector' | 'number';
  times: number[];
  values: number[];
}

/**
 * Convert THREE.AnimationClip to JSON-serializable format
 */
export function serializeAnimationClip(clip: THREE.AnimationClip): SerializedAnimationClip {
  const tracks: SerializedTrack[] = [];

  clip.tracks.forEach(track => {
    let type: 'quaternion' | 'vector' | 'number';
    
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      type = 'quaternion';
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      type = 'vector';
    } else if (track instanceof THREE.NumberKeyframeTrack) {
      type = 'number';
    } else {
      console.warn('[serializeAnimationClip] Unknown track type:', track.constructor.name);
      return;
    }

    tracks.push({
      name: track.name,
      type,
      times: Array.from(track.times),
      values: Array.from(track.values),
    });
  });

  return {
    name: clip.name,
    duration: clip.duration,
    tracks,
  };
}

/**
 * Convert serialized format back to THREE.AnimationClip
 */
export function deserializeAnimationClip(data: SerializedAnimationClip): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  data.tracks.forEach(trackData => {
    let track: THREE.KeyframeTrack;

    switch (trackData.type) {
      case 'quaternion':
        track = new THREE.QuaternionKeyframeTrack(
          trackData.name,
          trackData.times,
          trackData.values
        );
        break;
      case 'vector':
        track = new THREE.VectorKeyframeTrack(
          trackData.name,
          trackData.times,
          trackData.values
        );
        break;
      case 'number':
        track = new THREE.NumberKeyframeTrack(
          trackData.name,
          trackData.times,
          trackData.values
        );
        break;
      default:
        console.warn('[deserializeAnimationClip] Unknown track type:', trackData.type);
        return;
    }

    tracks.push(track);
  });

  return new THREE.AnimationClip(data.name, data.duration, tracks);
}

/**
 * Check if serialized animation data is valid
 */
export function isValidAnimationData(data: any): data is SerializedAnimationClip {
  return (
    data &&
    typeof data.name === 'string' &&
    typeof data.duration === 'number' &&
    Array.isArray(data.tracks) &&
    data.tracks.every((track: any) =>
      typeof track.name === 'string' &&
      typeof track.type === 'string' &&
      Array.isArray(track.times) &&
      Array.isArray(track.values)
    )
  );
}

