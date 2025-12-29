import * as THREE from 'three';
import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { VRMPose } from '@pixiv/three-vrm';
import type { ExpressionId, PoseId, AnimationMode } from '../types/reactions';
import { sceneManager } from './sceneManager';
import { animationManager } from './animationManager';
import { getPoseDefinition, getPoseDefinitionWithAnimation, type PoseDefinition } from '../poses';
import { poseToAnimationClip } from '../poses/poseToAnimation';
import { getAnimatedPose } from '../poses/animatedPoses';

type ExpressionMutator = (vrm: VRM) => void;

const expressionMutators: Record<ExpressionId, ExpressionMutator> = {
  calm: (vrm) => {
    vrm.expressionManager?.setValue('Joy', 0);
    vrm.expressionManager?.setValue('Surprised', 0);
    vrm.expressionManager?.setValue('Angry', 0);
  },
  joy: (vrm) => {
    vrm.expressionManager?.setValue('Joy', 0.8);
    vrm.expressionManager?.setValue('Surprised', 0);
    vrm.expressionManager?.setValue('Angry', 0);
  },
  surprise: (vrm) => {
    vrm.expressionManager?.setValue('Joy', 0);
    vrm.expressionManager?.setValue('Surprised', 0.9);
    vrm.expressionManager?.setValue('Angry', 0);
  },
};

interface RawPoseData {
  vrmPose?: VRMPose;
  tracks?: THREE.KeyframeTrack[];
  sceneRotation?: { x: number; y: number; z: number };
  expressions?: Record<string, number>;
  name?: string;
  duration?: number;
}

class AvatarManager {
  private loader = new ThreeGLTFLoader();
  private vrm?: VRM;
  private currentUrl?: string;
  private tickDispose?: () => void;
  private isAnimated = false;
  private isInteracting = false; 
  private isManualPosing = false;

  constructor() {
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  isManualPosingEnabled(): boolean { return this.isManualPosing; }
  getCurrentUrl(): string | undefined { return this.currentUrl; }
  setManualPosing(enabled: boolean) { this.isManualPosing = enabled; }
  setInteraction(interacting: boolean) { this.isInteracting = interacting; }

  private startTickLoop() {
    this.tickDispose?.();
    this.tickDispose = sceneManager.registerTick((delta) => {
      if (this.vrm) {
        this.vrm.update(delta);
        if (this.isAnimated && !this.isInteracting) {
          animationManager.update(delta);
        }
      }
    });
  }

  rebindToScene() {
    const scene = sceneManager.getScene();
    if (this.vrm && scene) {
        this.vrm.scene.removeFromParent();
        scene.add(this.vrm.scene);
        this.startTickLoop();
    }
  }

  async load(url: string) {
    if (this.currentUrl === url && this.vrm) {
        // Even if already loaded, we might need to ensure the tick loop is active 
        // if this load is called after a scene reset (though rebindToScene usually handles it).
        // But rebindToScene handles the scene transfer. 
        // If load is called, we assume the caller wants to ensure availability.
        return this.vrm;
    }
    const scene = sceneManager.getScene();
    if (!scene) throw new Error('Scene not initialized');

    const gltf = await this.loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('Invalid VRM file');
    
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.removeUnnecessaryJoints(vrm.scene);

    if (this.vrm) {
      scene.remove(this.vrm.scene);
      this.tickDispose?.();
    }
    this.vrm = vrm;
    this.currentUrl = url;

    vrm.scene.position.set(0, 0, 0);
    scene.add(vrm.scene);
    animationManager.initialize(vrm);
    sceneManager.frameObject(vrm.scene);

    this.startTickLoop();

    return vrm;
  }

  async applyRawPose(poseData: RawPoseData, animationMode: AnimationMode = 'static') {
    if (!this.vrm) return;
    this.isInteracting = false;

    if (poseData.sceneRotation) {
      this.vrm.scene.rotation.set(
        THREE.MathUtils.degToRad(poseData.sceneRotation.x ?? 0),
        THREE.MathUtils.degToRad(poseData.sceneRotation.y ?? 0),
        THREE.MathUtils.degToRad(poseData.sceneRotation.z ?? 0),
      );
    }

    if (animationMode !== 'static' && poseData.tracks) {
      const { deserializeAnimationClip } = await import('../poses/animationClipSerializer');
      this.playAnimationClip(deserializeAnimationClip(poseData as any), animationMode === 'loop');
    } else if (poseData.vrmPose) {
      this.stopAnimation(true);
      this.vrm.humanoid?.setNormalizedPose(poseData.vrmPose);
      if (poseData.expressions && this.vrm.expressionManager) {
        Object.entries(poseData.expressions).forEach(([name, value]) => {
          const standardMap: Record<string, string> = { 'joy': 'Joy', 'happy': 'Joy', 'angry': 'Angry', 'sad': 'Sorrow', 'fun': 'Fun', 'surprised': 'Surprised', 'blink': 'Blink' };
          this.vrm!.expressionManager!.setValue(standardMap[name.toLowerCase()] || name, value as number);
        });
      }
      this.vrm.update(0);
    }
  }

  async applyPose(pose: PoseId, animated = false, animationMode: AnimationMode = 'static') {
    if (!this.vrm) return;
    this.isInteracting = false;
    const shouldAnimate = animated || animationMode !== 'static';
    const def = shouldAnimate ? await getPoseDefinitionWithAnimation(pose) : getPoseDefinition(pose);
    if (!def) return;

    this.vrm.scene.rotation.set(THREE.MathUtils.degToRad(def.sceneRotation?.x ?? 0), THREE.MathUtils.degToRad(def.sceneRotation?.y ?? 0), THREE.MathUtils.degToRad(def.sceneRotation?.z ?? 0));

    if (shouldAnimate && def.animationClip) {
      this.playAnimationClip(def.animationClip, animationMode === 'loop');
    } else if (shouldAnimate) {
      const vrmPose = buildVRMPose(def);
      const clip = getAnimatedPose(pose, vrmPose, this.vrm) || poseToAnimationClip(vrmPose, this.vrm, 0.5, pose);
      this.playAnimationClip(clip, animationMode === 'loop');
    } else {
      this.stopAnimation(true);
      this.vrm.humanoid?.setNormalizedPose(buildVRMPose(def));
      this.vrm.update(0);
    }
  }

  playAnimationClip(clip: THREE.AnimationClip, loop = true, fade = 0.3) {
    if (!this.vrm) return;
    this.isInteracting = false;
    this.isAnimated = true;
    animationManager.playAnimation(clip, loop, fade);
  }

  stopAnimation(immediate = false) {
    this.isAnimated = false;
    animationManager.stopAnimation(immediate);
  }

  freezeCurrentPose() {
    if (!this.vrm || !this.vrm.humanoid) return;
    console.log('[AvatarManager] Freezing pose via direct node capture');

    // 1. Capture direct transforms from the nodes
    const poseData = new Map<VRMHumanBoneName, { q: THREE.Quaternion, p: THREE.Vector3 }>();
    const boneNames = Object.values(VRMHumanBoneName) as VRMHumanBoneName[];
    
    boneNames.forEach(name => {
      const node = this.vrm!.humanoid!.getNormalizedBoneNode(name);
      if (node) {
        poseData.set(name, { q: node.quaternion.clone(), p: node.position.clone() });
      }
    });

    // 2. Stop mixer (resets nodes)
    this.isAnimated = false;
    animationManager.stopAnimation(true);
    
    // 3. Re-apply direct transforms to nodes
    poseData.forEach((data, name) => {
      const node = this.vrm!.humanoid!.getNormalizedBoneNode(name);
      if (node) {
        node.quaternion.copy(data.q);
        if (name === VRMHumanBoneName.Hips) {
            node.position.copy(data.p);
        }
      }
    });
    
    // 4. Update VRM to lock in the direct changes
    this.vrm.humanoid.update();
    this.vrm.update(0);
  }

  pauseAnimation() { if (this.isAnimated) animationManager.pause(); }
  resumeAnimation() { if (this.isAnimated) animationManager.resume(); }
  resetPose() { if (!this.vrm) return; this.stopAnimation(); this.vrm.humanoid?.resetNormalizedPose(); this.vrm.update(0); }
  setAnimationLoop(loop: boolean) { if (this.isAnimated) animationManager.setLoop(loop); }
  setAnimationSpeed(speed: number) { if (this.isAnimated) animationManager.setSpeed(speed); }
  seekAnimation(time: number) { if (this.isAnimated) animationManager.seek(time); }
  isAnimationPlaying(): boolean { return this.isAnimated && animationManager.isPlaying(); }
  getVRM(): VRM | undefined { return this.vrm; }
  
  applyExpression(expression: ExpressionId) {
    if (!this.vrm) return;
    expressionMutators[expression]?.(this.vrm);
    this.vrm.expressionManager?.update();
  }

  getAvailableExpressions(): string[] {
    if (!this.vrm?.expressionManager) return [];
    const names: string[] = [];
    const manager = this.vrm.expressionManager as any;
    if (this.vrm.expressionManager.expressionMap) Object.keys(this.vrm.expressionManager.expressionMap).forEach(name => names.push(name));
    else if (manager.expressions) manager.expressions.forEach((expr: any) => { if (expr.expressionName) names.push(expr.expressionName); });
    return names.sort();
  }

  setExpressionWeight(name: string, weight: number) {
    if (!this.vrm?.expressionManager) return;
    this.vrm.expressionManager.setValue(name, weight);
    this.vrm.expressionManager.update();
  }
}

function buildVRMPose(definition: PoseDefinition): VRMPose {
  if (definition.vrmPose) return JSON.parse(JSON.stringify(definition.vrmPose));
  const pose: VRMPose = {};
  if (!definition.boneRotations) return pose;
  Object.entries(definition.boneRotations).forEach(([boneName, rotation]) => {
    const euler = new THREE.Euler(THREE.MathUtils.degToRad(rotation.x ?? 0), THREE.MathUtils.degToRad(rotation.y ?? 0), THREE.MathUtils.degToRad(rotation.z ?? 0), 'XYZ');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    pose[boneName as VRMHumanBoneName] = { rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] };
  });
  return pose;
}

export const avatarManager = new AvatarManager();
