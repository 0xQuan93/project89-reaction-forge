import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { VRMRigMapMixamo } from './VRMRigMapMixamo';

async function retargetAnimation(vrmBuffer: ArrayBuffer, animationBuffer: ArrayBuffer, animationFileName: string) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(vrmBuffer, '');
  const vrm = gltf.userData.vrm;

  let clip: THREE.AnimationClip;
  if (animationFileName.toLowerCase().endsWith('.fbx')) {
    const fbxLoader = new FBXLoader();
    const fbx = fbxLoader.parse(animationBuffer, '');
    clip = fbx.animations[0];
  } else {
    const animGltf = await new GLTFLoader().parseAsync(animationBuffer, '');
    clip = animGltf.animations[0];
  }

  const rigMap = VRMRigMapMixamo(vrm.humanoid);
  const { retargetedClip } = VRMUtils.retargetAnimationClip(vrm.humanoid, clip, rigMap);
  
  return retargetedClip;
}

self.onmessage = async (event) => {
  try {
    const { vrmBuffer, animationBuffer, animationFileName } = event.data;
    const retargetedClip = await retargetAnimation(vrmBuffer, animationBuffer, animationFileName);
    self.postMessage({ success: true, animationClip: retargetedClip.toJSON() });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
