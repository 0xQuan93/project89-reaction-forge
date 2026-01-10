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
import { materialManager } from './materialManager';

// Import type only to avoid circular dependency at runtime
// The actual store access happens after all modules are initialized
import type { useSceneSettingsStore as SceneSettingsStoreType } from '../state/useSceneSettingsStore';

// Lazy getter to avoid circular dependency with useSceneSettingsStore
// (useSceneSettingsStore -> materialManager -> avatarManager -> useSceneSettingsStore)
let _sceneSettingsStore: typeof SceneSettingsStoreType | null = null;
const getSceneSettingsStore = (): typeof SceneSettingsStoreType | null => {
  if (!_sceneSettingsStore) {
    // Dynamically import to break circular dependency - this runs after initial module load
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = (window as any).__sceneSettingsStoreModule;
      if (module) {
        _sceneSettingsStore = module.useSceneSettingsStore;
      }
    } catch {
      // Store not yet available
    }
  }
  return _sceneSettingsStore;
};

// Register the store module globally after it's loaded (called from useSceneSettingsStore.ts)
export const registerSceneSettingsStore = (store: typeof SceneSettingsStoreType) => {
  _sceneSettingsStore = store;
  (window as any).__sceneSettingsStoreModule = { useSceneSettingsStore: store };
};

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

// Type for VRM expression with name property
interface VRMExpressionWithName {
  expressionName?: string;
}

// Extended expression manager with expressions array
interface ExtendedExpressionManager {
  expressionMap?: Record<string, unknown>;
  expressions?: VRMExpressionWithName[];
}

class AvatarManager {
  private loader = new ThreeGLTFLoader();
  private vrm?: VRM;
  private currentUrl?: string;
  private tickDispose?: () => void;
  private isAnimated = false;
  private isInteracting = false; 
  private isManualPosing = false;
  private defaultHipsPosition: THREE.Vector3 = new THREE.Vector3(0, 1.0, 0);

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
        // ALWAYS update the animation mixer if an animation is playing
        // The isInteracting flag should only pause, not block entirely
        if (this.isAnimated) {
          if (!this.isInteracting) {
            animationManager.update(delta);
          }
          // If interacting but animated, we still want the mixer to be ready
          // just not updating (paused state)
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
    // Combine skeletons for better performance (replaces deprecated removeUnnecessaryJoints)
    VRMUtils.combineSkeletons(vrm.scene);

    if (this.vrm) {
      scene.remove(this.vrm.scene);
      this.tickDispose?.();
    }
    this.vrm = vrm;
    this.currentUrl = url;

    vrm.scene.position.set(0, 0, 0);
    // Rotate 180° on Y so the avatar faces the camera (VRMs export facing +Z, camera looks at -Z)
    vrm.scene.rotation.set(0, Math.PI, 0);
    scene.add(vrm.scene);
    animationManager.initialize(vrm);
    sceneManager.frameObject(vrm.scene);

    // Capture the default hips position (usually around Y=0.8-1.0)
    // This serves as the anchor point for all transitions to prevent drift
    const hipsNode = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
    if (hipsNode) {
      this.defaultHipsPosition.copy(hipsNode.position);
      console.log('[AvatarManager] Captured default hips position:', this.defaultHipsPosition);
    }

    this.startTickLoop();
    
    // Apply material settings to the newly loaded VRM
    materialManager.onVRMLoaded();
    
    // Reset rotation lock when loading a new avatar so the first pose applies correctly
    // The user can re-lock rotation after using the gizmo
    getSceneSettingsStore()?.getState().setRotationLocked(false);

    return vrm;
  }

  async applyRawPose(poseData: RawPoseData, animationMode: AnimationMode = 'static', smoothTransition = true) {
    if (!this.vrm) {
      console.warn('[AvatarManager] applyRawPose called but no VRM loaded');
      return;
    }
    this.isInteracting = false;

    // Only apply scene rotation if not locked
    const { rotationLocked } = getSceneSettingsStore()?.getState() ?? { rotationLocked: false };
    if (poseData.sceneRotation && !rotationLocked) {
      this.vrm.scene.rotation.set(
        THREE.MathUtils.degToRad(poseData.sceneRotation.x ?? 0),
        THREE.MathUtils.degToRad(poseData.sceneRotation.y ?? 0),
        THREE.MathUtils.degToRad(poseData.sceneRotation.z ?? 0),
      );
    }

    if (animationMode !== 'static' && poseData.tracks) {
      const { deserializeAnimationClip } = await import('../poses/animationClipSerializer');
      // Cast through unknown to handle the structural mismatch between RawPoseData and SerializedAnimationClip
      this.playAnimationClip(deserializeAnimationClip(poseData as unknown as Parameters<typeof deserializeAnimationClip>[0]), animationMode === 'loop');
    } else if (poseData.vrmPose) {
      // Validate and log the pose data
      const boneCount = Object.keys(poseData.vrmPose).length;
      console.log(`[AvatarManager] Applying raw pose with ${boneCount} bones, smooth=${smoothTransition}`);
      
      if (boneCount === 0) {
        console.warn('[AvatarManager] Empty vrmPose received - skipping');
        return;
      }
      
      // Apply expressions if provided
      if (poseData.expressions && this.vrm.expressionManager) {
        Object.entries(poseData.expressions).forEach(([name, value]) => {
          const standardMap: Record<string, string> = { 'joy': 'Joy', 'happy': 'Joy', 'angry': 'Angry', 'sad': 'Sorrow', 'fun': 'Fun', 'surprised': 'Surprised', 'blink': 'Blink' };
          this.vrm!.expressionManager!.setValue(standardMap[name.toLowerCase()] || name, value as number);
        });
      }
      
      // Use smooth transition for preset-style changes, immediate for mocap/real-time
      if (smoothTransition) {
        this.transitionToPose(poseData.vrmPose, 0.4, () => {
          console.log('[AvatarManager] ✅ Raw pose transition complete');
        });
      } else {
        // Immediate application (for mocap, real-time updates)
        this.stopAnimation(true);
        this.vrm.humanoid?.resetNormalizedPose();
        this.vrm.update(0);
        this.vrm.humanoid?.setNormalizedPose(poseData.vrmPose);
        
        // Explicitly set hips to default position if not specified in poseData
        const hipsNode = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
        if (hipsNode && !poseData.vrmPose[VRMHumanBoneName.Hips]?.position) {
          hipsNode.position.copy(this.defaultHipsPosition);
        }
        
        this.vrm.humanoid?.update();
        this.vrm.update(0);
        console.log('[AvatarManager] ✅ Raw pose applied immediately');
      }
    } else {
      console.warn('[AvatarManager] applyRawPose called with no vrmPose or tracks');
    }
  }

  async applyPose(pose: PoseId, animated = false, animationMode: AnimationMode = 'static') {
    if (!this.vrm) {
      console.warn('[AvatarManager] applyPose called but no VRM loaded');
      return;
    }
    this.isInteracting = false;
    
    // Determine if we should animate
    // If animated=true but animationMode='static', default to 'loop' to prevent freezing
    const effectiveAnimationMode = animated && animationMode === 'static' ? 'loop' : animationMode;
    const shouldAnimate = animated || effectiveAnimationMode !== 'static';
    const shouldLoop = effectiveAnimationMode === 'loop';
    
    console.log(`[AvatarManager] applyPose: ${pose}, animated=${animated}, mode=${effectiveAnimationMode}, loop=${shouldLoop}`);
    
    // Pass VRM to getPoseDefinitionWithAnimation so it can retarget the animation tracks
    const def = shouldAnimate ? await getPoseDefinitionWithAnimation(pose, this.vrm) : getPoseDefinition(pose);
    if (!def) {
      console.warn(`[AvatarManager] Pose definition not found for: ${pose}`);
      return;
    }

    // Only apply scene rotation if not locked (user hasn't manually rotated)
    const { rotationLocked } = getSceneSettingsStore()?.getState() ?? { rotationLocked: false };
    if (!rotationLocked) {
      this.vrm.scene.rotation.set(
        THREE.MathUtils.degToRad(def.sceneRotation?.x ?? 0), 
        THREE.MathUtils.degToRad(def.sceneRotation?.y ?? 0), 
        THREE.MathUtils.degToRad(def.sceneRotation?.z ?? 0)
      );
    }

    if (shouldAnimate && def.animationClip) {
      console.log(`[AvatarManager] Playing animation clip for: ${pose}`);
      this.playAnimationClip(def.animationClip, shouldLoop);
    } else if (shouldAnimate) {
      console.log(`[AvatarManager] Generating animation from pose: ${pose}`);
      const vrmPose = buildVRMPose(def);
      const clip = getAnimatedPose(pose, vrmPose, this.vrm) || poseToAnimationClip(vrmPose, this.vrm, 0.5, pose);
      this.playAnimationClip(clip, shouldLoop);
    } else {
      console.log(`[AvatarManager] Applying static pose with transition: ${pose}`);
      const vrmPose = buildVRMPose(def);
      
      // Use smooth transition instead of immediate snap
      this.transitionToPose(vrmPose, 0.4, () => {
        console.log(`[AvatarManager] ✅ Static pose transition complete: ${pose}`);
      });
    }
  }

  playAnimationClip(clip: THREE.AnimationClip, loop = true, fade = 0.3) {
    if (!this.vrm) {
      console.warn('[AvatarManager] playAnimationClip called but no VRM loaded');
      return;
    }
    console.log(`[AvatarManager] playAnimationClip: ${clip.name}, loop=${loop}, tracks=${clip.tracks.length}`);
    this.isInteracting = false;
    this.isAnimated = true;
    animationManager.playAnimation(clip, loop, fade);
  }

  stopAnimation(immediate = false) {
    this.isAnimated = false;
    animationManager.stopAnimation(immediate);
  }

  /**
   * Capture the current pose from all bones as a VRMPose
   */
  captureCurrentPose(): VRMPose {
    const pose: VRMPose = {};
    if (!this.vrm?.humanoid) return pose;

    const boneNames = Object.values(VRMHumanBoneName) as VRMHumanBoneName[];
    boneNames.forEach(name => {
      const node = this.vrm!.humanoid!.getNormalizedBoneNode(name);
      if (node) {
        pose[name] = {
          rotation: [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w]
        };
        // Include position for hips
        if (name === VRMHumanBoneName.Hips) {
          pose[name]!.position = [node.position.x, node.position.y, node.position.z];
        }
      }
    });
    return pose;
  }

  /**
   * Create a transition animation clip from current pose to target pose
   * Maintains consistent hips positioning to prevent avatar from moving off-screen
   */
  createTransitionClip(targetPose: VRMPose, duration = 0.4): THREE.AnimationClip {
    const tracks: THREE.KeyframeTrack[] = [];
    const currentPose = this.captureCurrentPose();
    const times = [0, duration];

    const boneNames = Object.values(VRMHumanBoneName) as VRMHumanBoneName[];
    boneNames.forEach(boneName => {
      const node = this.vrm?.humanoid?.getNormalizedBoneNode(boneName);
      if (!node) return;

      const trackName = `${node.name}.quaternion`;
      
      // Get current rotation (or identity if not set)
      const currentRot = currentPose[boneName]?.rotation || [0, 0, 0, 1];
      // Get target rotation (or current if target doesn't specify this bone)
      const targetRot = targetPose[boneName]?.rotation || currentRot;

      // Only create track if there's a meaningful difference
      const qCurrent = new THREE.Quaternion(currentRot[0], currentRot[1], currentRot[2], currentRot[3]);
      const qTarget = new THREE.Quaternion(targetRot[0], targetRot[1], targetRot[2], targetRot[3]);
      
      if (qCurrent.angleTo(qTarget) > 0.001) {
        tracks.push(new THREE.QuaternionKeyframeTrack(
          trackName,
          times,
          [...currentRot, ...targetRot]
        ));
      }
    });

    // Always maintain hips position - keep avatar grounded
    // This prevents the avatar from floating or sinking during transitions
    const hipsNode = this.vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
    if (hipsNode) {
      const currentPos = currentPose[VRMHumanBoneName.Hips]?.position || [0, hipsNode.position.y, 0];
      // If target has position, use it; otherwise return to default position
      const targetPos = targetPose[VRMHumanBoneName.Hips]?.position || [
        this.defaultHipsPosition.x,
        this.defaultHipsPosition.y,
        this.defaultHipsPosition.z
      ];
      
      // Always animate position to ensure we return to center if we drifted
      tracks.push(new THREE.VectorKeyframeTrack(
        `${hipsNode.name}.position`,
        times,
        [...currentPos, ...targetPos]
      ));
    }

    return new THREE.AnimationClip('pose-transition', duration, tracks);
  }

  /**
   * Smoothly transition to a static pose with animation
   * Preserves hips position to keep avatar in viewport
   */
  transitionToPose(targetPose: VRMPose, duration = 0.4, onComplete?: () => void) {
    if (!this.vrm) return;

    // We don't need to capture/restore manually anymore because createTransitionClip
    // now actively targets the default position. This is more robust.

    const transitionClip = this.createTransitionClip(targetPose, duration);
    
    // Play the transition once
    this.isAnimated = true;
    animationManager.playTransition(transitionClip, () => {
      // When transition completes, apply the final pose statically
      this.isAnimated = false;
      this.vrm?.humanoid?.setNormalizedPose(targetPose);
      
      // Explicitly set hips to target (or default) to prevent any float error
      const hipsNode = this.vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
      if (hipsNode && !targetPose[VRMHumanBoneName.Hips]?.position) {
        hipsNode.position.copy(this.defaultHipsPosition);
      }
      
      this.vrm?.humanoid?.update();
      this.vrm?.update(0);
      onComplete?.();
    });
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
  clear() {
    const scene = sceneManager.getScene();
    if (this.vrm && scene) {
      scene.remove(this.vrm.scene);
    }
    this.tickDispose?.();
    this.tickDispose = undefined;
    this.vrm = undefined;
    this.currentUrl = undefined;
    this.isAnimated = false;
    animationManager.stopAnimation(true);
  }
  
  applyExpression(expression: ExpressionId) {
    if (!this.vrm) return;
    expressionMutators[expression]?.(this.vrm);
    this.vrm.expressionManager?.update();
  }

  getAvailableExpressions(): string[] {
    if (!this.vrm?.expressionManager) return [];
    const names: string[] = [];
    const manager = this.vrm.expressionManager as unknown as ExtendedExpressionManager;
    if (manager.expressionMap) {
      Object.keys(manager.expressionMap).forEach(name => names.push(name));
    } else if (manager.expressions) {
      manager.expressions.forEach((expr) => { 
        if (expr.expressionName) names.push(expr.expressionName); 
      });
    }
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
