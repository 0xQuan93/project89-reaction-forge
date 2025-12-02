import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { VRMHumanBoneName, VRMPose } from '@pixiv/three-vrm';
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

class AvatarManager {
  private loader = new GLTFLoader();
  private vrm?: VRM;
  private currentUrl?: string;
  private tickDispose?: () => void;
  private isAnimated = false;

  constructor() {
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  async load(url: string) {
    console.log('[AvatarManager] Loading VRM from:', url);
    if (this.currentUrl === url && this.vrm) {
      console.log('[AvatarManager] VRM already loaded, reusing');
      return this.vrm;
    }
    const scene = sceneManager.getScene();
    if (!scene) throw new Error('Scene not initialized');

    console.log('[AvatarManager] Fetching GLTF...');
    const gltf = await this.loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('VRM payload missing');
    console.log('[AvatarManager] VRM extracted, optimizing...');
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.removeUnnecessaryJoints(vrm.scene);

    if (this.vrm) {
      console.log('[AvatarManager] Removing previous VRM');
      scene.remove(this.vrm.scene);
      this.tickDispose?.();
    }
    this.vrm = vrm;
    this.currentUrl = url;

    vrm.scene.position.set(0, 0, 0);
    scene.add(vrm.scene);
    console.log('[AvatarManager] VRM added to scene');

    // Initialize animation manager with the new VRM
    animationManager.initialize(vrm);

    this.tickDispose = sceneManager.registerTick((delta) => {
      vrm.update(delta);
      // CRITICAL: Only update animation mixer when explicitly in animated mode
      // This prevents animations from interfering with static poses
      if (this.isAnimated && animationManager.isPlaying()) {
        animationManager.update(delta);
      }
    });

    return vrm;
  }

  async applyRawPose(poseData: any, animationMode: AnimationMode = 'static') {
    if (!this.vrm) {
      console.warn('[AvatarManager] Cannot apply raw pose - VRM not loaded');
      return;
    }
    console.log('[AvatarManager] Applying raw pose data:', poseData);

    const shouldAnimate = animationMode !== 'static';

    // Apply scene rotation if provided
    if (poseData.sceneRotation) {
      const rotation = poseData.sceneRotation;
      this.vrm.scene.rotation.set(
        THREE.MathUtils.degToRad(rotation.x ?? 0),
        THREE.MathUtils.degToRad(rotation.y ?? 0),
        THREE.MathUtils.degToRad(rotation.z ?? 0),
      );
    }

    // Check if we have animation clip data (separate animation JSON)
    if (shouldAnimate && poseData.tracks) {
      // This is an animation clip JSON
      console.log('[AvatarManager] Loading animation clip from JSON');
      
      const { deserializeAnimationClip } = await import('../poses/animationClipSerializer');
      const animationClip = deserializeAnimationClip(poseData);
      
      // Reset humanoid pose system before starting animation
      if (this.vrm.humanoid?.resetNormalizedPose) {
        this.vrm.humanoid.resetNormalizedPose();
      } else {
        this.vrm.humanoid?.resetPose();
      }
      
      this.isAnimated = true;
      const loop = animationMode === 'loop';
      animationManager.playAnimation(animationClip, loop);
    } else if (poseData.vrmPose) {
      // This is a static pose JSON
      console.log('[AvatarManager] Applying static VRM pose');
      
      // Stop any running animations
      this.isAnimated = false;
      animationManager.stopAnimation(true);
      
      // Apply the VRM pose
      this.vrm.humanoid?.setPose(poseData.vrmPose);
    } else {
      console.error('[AvatarManager] Invalid pose data - missing vrmPose or tracks');
    }
  }

  async applyPose(pose: PoseId, animated = false, animationMode: AnimationMode = 'static') {
    if (!this.vrm) {
      console.warn('[AvatarManager] Cannot apply pose - VRM not loaded');
      return;
    }
    console.log('[AvatarManager] Applying pose:', pose, { animated, animationMode });
    
    // Load pose definition with animation clip if needed
    const shouldAnimate = animated || animationMode !== 'static';
    const definition = shouldAnimate
      ? await getPoseDefinitionWithAnimation(pose)
      : getPoseDefinition(pose);
      
    if (!definition) {
      console.error('[AvatarManager] Pose definition not found:', pose);
      return;
    }

    // Apply scene rotation to face camera
    this.applySceneRotation(definition);

    // Check if we have a pre-recorded animation clip (from FBX)
    if (shouldAnimate && definition.animationClip) {
      // Play the pre-recorded FBX animation clip
      console.log('[AvatarManager] Playing FBX animation clip from file');
      
      // Reset humanoid pose system before starting animation
      if (this.vrm.humanoid?.resetNormalizedPose) {
        this.vrm.humanoid.resetNormalizedPose();
      } else {
        this.vrm.humanoid?.resetPose();
      }
      
      this.isAnimated = true;
      const loop = animationMode === 'loop';
      animationManager.playAnimation(definition.animationClip, loop);
    } else if (shouldAnimate) {
      // Create animated version of the pose
      console.log('[AvatarManager] Creating animated pose');
      
      // Reset humanoid pose system before starting animation
      if (this.vrm.humanoid?.resetNormalizedPose) {
        this.vrm.humanoid.resetNormalizedPose();
      } else {
        this.vrm.humanoid?.resetPose();
      }
      
      const vrmPose = buildVRMPose(definition);
      
      // Try to get a custom animated version of this pose
      let animClip = getAnimatedPose(pose, vrmPose, this.vrm);
      
      // If no custom animation, use simple transition
      if (!animClip) {
        console.log('[AvatarManager] No custom animation, using simple transition');
        animClip = poseToAnimationClip(vrmPose, this.vrm, 0.5, pose);
      } else {
        console.log('[AvatarManager] Using custom animated pose');
      }
      
      this.isAnimated = true;
      animationManager.playAnimation(animClip, animationMode === 'loop');
    } else {
      // Apply as static pose
      console.log('[AvatarManager] Applying static pose');
      
      // CRITICAL: Stop animation immediately to prevent interference
      this.isAnimated = false;
      animationManager.stopAnimation(true); // immediate stop
      
      const vrmPose = buildVRMPose(definition);
      console.log('[AvatarManager] VRM pose built, bone count:', Object.keys(vrmPose).length);
      
      // Reset pose system to ensure clean state
      if (this.vrm.humanoid?.resetNormalizedPose) {
        this.vrm.humanoid.resetNormalizedPose();
        this.vrm.humanoid.setNormalizedPose(vrmPose);
      } else {
        this.vrm.humanoid?.resetPose();
        this.vrm.humanoid?.setPose(vrmPose);
      }
      
      // Force immediate updates to propagate bone transforms
      this.vrm.humanoid?.update();
      this.vrm.update(0);
      this.vrm.scene.updateMatrixWorld(true);
      
      console.log('[AvatarManager] Static pose applied, animation mixer stopped');
    }

    console.log('[AvatarManager] Pose applied successfully');
  }

  /**
   * Stop any currently playing animation
   */
  stopAnimation() {
    console.log('[AvatarManager] Stopping animation');
    this.isAnimated = false;
    animationManager.stopAnimation(true); // immediate stop
  }

  /**
   * Check if an animation is currently playing
   */
  isAnimationPlaying(): boolean {
    return this.isAnimated && animationManager.isPlaying();
  }

  /**
   * Get the VRM instance
   */
  getVRM(): VRM | undefined {
    return this.vrm;
  }

  applyExpression(expression: ExpressionId) {
    if (!this.vrm) {
      console.warn('[AvatarManager] Cannot apply expression - VRM not loaded');
      return;
    }
    console.log('[AvatarManager] Applying expression:', expression);
    this.vrm.expressionManager?.setValue('Joy', 0);
    this.vrm.expressionManager?.setValue('Surprised', 0);
    this.vrm.expressionManager?.setValue('Angry', 0);
    expressionMutators[expression]?.(this.vrm);
  }

  private applySceneRotation(definition: PoseDefinition) {
    const rotation = definition.sceneRotation ?? { x: 0, y: 0, z: 0 };
    this.vrm?.scene.rotation.set(
      THREE.MathUtils.degToRad(rotation.x ?? 0),
      THREE.MathUtils.degToRad(rotation.y ?? 0),
      THREE.MathUtils.degToRad(rotation.z ?? 0),
    );
  }
}

function buildVRMPose(definition: PoseDefinition): VRMPose {
  if (definition.vrmPose) {
    // Deep clone and return as-is (position data already stripped during export)
    return JSON.parse(JSON.stringify(definition.vrmPose));
  }

  const pose: VRMPose = {};
  if (!definition.boneRotations) return pose;

  Object.entries(definition.boneRotations).forEach(([boneName, rotation]) => {
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rotation.x ?? 0),
      THREE.MathUtils.degToRad(rotation.y ?? 0),
      THREE.MathUtils.degToRad(rotation.z ?? 0),
      'XYZ',
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    pose[boneName as VRMHumanBoneName] = {
      rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    };
  });

  return pose;
}

export const avatarManager = new AvatarManager();

