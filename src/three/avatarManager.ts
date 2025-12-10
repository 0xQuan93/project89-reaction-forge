import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

class AvatarManager {
  private loader = new GLTFLoader();
  private vrm?: VRM;
  private currentUrl?: string;
  private tickDispose?: () => void;
  private isAnimated = false;

  private isManualPosing = false;

  constructor() {
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  isManualPosingEnabled(): boolean {
    return this.isManualPosing;
  }

  setManualPosing(enabled: boolean) {
    this.isManualPosing = enabled;
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
    if (!vrm) {
      console.error('[AvatarManager] VRM payload missing in GLTF');
      throw new Error('Invalid VRM file: Missing VRM data');
    }
    
    // Safety check for skeletal structure
    if (!vrm.humanoid) {
      console.error('[AvatarManager] Malformed VRM: No humanoid definition found');
      throw new Error('Malformed VRM: No humanoid structure found. Please check your model export settings.');
    }

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

    // Log VRM Version for compatibility tracking
    const meta = vrm.meta;
    console.log('[AvatarManager] VRM Version:', meta?.metaVersion || 'Unknown (Likely 0.0)');

    vrm.scene.position.set(0, 0, 0);
    scene.add(vrm.scene);
    console.log('[AvatarManager] VRM added to scene');

    // Initialize animation manager with the new VRM
    animationManager.initialize(vrm);

    this.tickDispose = sceneManager.registerTick((delta) => {
      // Keep vrm.update running to ensure skeletal matrices and spring bones are calculated
      // The "reset" issue was primarily caused by CanvasStage reloading presets, which is now guarded.
      // We do need to handle LookAt potentially fighting head rotation, but for now let's restore core updates.
      
      vrm.update(delta);
      
      // CRITICAL: Only update animation mixer when explicitly in animated mode
      // This prevents animations from interfering with static poses
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
    // console.log('[AvatarManager] Applying raw pose data:', poseData);

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
      console.log('[AvatarManager] Applying static VRM pose. Bone count:', Object.keys(poseData.vrmPose).length);
      
      // Stop any running animations
      this.isAnimated = false;
      animationManager.stopAnimation(true);
      
      // Check if humanoid exists
      if (!this.vrm.humanoid) {
        console.error('[AvatarManager] VRM Humanoid not found');
        return;
      }

      // Reset to T-pose first to ensure clean application
      if (this.vrm.humanoid.resetNormalizedPose) {
        this.vrm.humanoid.resetNormalizedPose();
      } else {
        this.vrm.humanoid.resetPose();
      }
      
      // Apply the VRM pose
      try {
        this.vrm.humanoid.setPose(poseData.vrmPose);
        console.log('[AvatarManager] VRM Pose applied via setPose');
        
        // Manual fallback/enforcement: Apply directly to bone nodes
        // This ensures that even if setPose decides to ignore something, we force it
        // Check if getNormalizedBoneNode exists on the humanoid object (VRM 0.0 vs 1.0)
        if (this.vrm.humanoid && typeof this.vrm.humanoid.getNormalizedBoneNode === 'function') {
          Object.entries(poseData.vrmPose).forEach(([boneName, data]: [string, any]) => {
            const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName as VRMHumanBoneName);
            if (node && data.rotation) {
              node.quaternion.set(data.rotation[0], data.rotation[1], data.rotation[2], data.rotation[3]);
            }
            if (node && data.position && boneName === 'hips') {
              // Only hips usually support position in normalized pose
              node.position.set(data.position[0], data.position[1], data.position[2]);
            }
          });
          console.log('[AvatarManager] VRM Pose forced on bone nodes');
        }
      } catch (e) {
        console.error('[AvatarManager] Failed to set VRM pose:', e);
      }

      // Apply expressions/blendshapes if provided
      if (poseData.expressions && this.vrm.expressionManager) {
        console.log('[AvatarManager] Applying expressions:', poseData.expressions);
        
        // Reset expression manager to neutral
        // Check if setValue exists (it should, but safety first)
        if (this.vrm.expressionManager && typeof this.vrm.expressionManager.setValue === 'function') {
           // We can't iterate all possible keys easily in VRM 0.0 without accessing the full preset map,
           // but we can try to reset common ones.
           // Better approach: just overwrite.
        }

        Object.entries(poseData.expressions).forEach(([name, value]) => {
          const val = value as number;
          
          // 1. Try Standard VRM Expressions (case-insensitive match)
          // The library usually expects capitalized preset names like 'Joy', 'Angry', 'Blink'
          // Or the specific VRM 1.0 ExpressionMap keys.
          
          // Map common lowercase prompt outputs to VRM Standard presets
          const standardMap: Record<string, string> = {
            'joy': 'Joy', 'happy': 'Joy',
            'angry': 'Angry',
            'sad': 'Sorrow', 'sorrow': 'Sorrow',
            'fun': 'Fun', 'relaxed': 'Fun',
            'surprised': 'Surprised', 'surprise': 'Surprised',
            'blink': 'Blink',
            'neutral': 'Neutral'
          };
          
          const vrmName = standardMap[name.toLowerCase()] || name;
          
          try {
             this.vrm!.expressionManager!.setValue(vrmName, val);
          } catch (e) {
             console.warn(`[AvatarManager] Failed to set expression "${vrmName}":`, e);
          }
        });
      }
      
      // Force immediate updates to propagate bone transforms
      this.vrm.humanoid.update();
      this.vrm.update(0);
      this.vrm.scene.updateMatrixWorld(true);
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
   * Pause animation (e.g. for manual posing)
   */
  pauseAnimation() {
    if (this.isAnimated) {
      animationManager.pause();
    }
  }

  /**
   * Resume animation
   */
  resumeAnimation() {
    if (this.isAnimated) {
      animationManager.resume();
    }
  }

  /**
   * Reset the avatar to its default pose (T-pose or A-pose)
   */
  resetPose() {
    if (!this.vrm) return;
    
    console.log('[AvatarManager] Resetting pose');
    this.stopAnimation();
    
    if (this.vrm.humanoid?.resetNormalizedPose) {
      this.vrm.humanoid.resetNormalizedPose();
    } else {
      this.vrm.humanoid?.resetPose();
    }
    
    // Reset all expressions
    if (this.vrm.expressionManager) {
      const exprs = this.getAvailableExpressions();
      exprs.forEach(name => this.vrm!.expressionManager!.setValue(name, 0));
      this.vrm.expressionManager.update();
    }
    
    // Force update
    this.vrm.humanoid?.update();
    this.vrm.update(0);
    this.vrm.scene.updateMatrixWorld(true);
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
   * Smoothly transition to an animation clip from the CURRENT pose (even if manual/static).
   * This creates a 1-frame clip of the current state and crossfades from it.
   */
  playAnimationClipWithTransition(clip: THREE.AnimationClip, loop = true, fade = 0.5) {
    if (!this.vrm || !this.vrm.humanoid) return;
    
    console.log('[AvatarManager] Smart Transition to:', clip.name);
    
    // 1. Capture current pose into a transition clip
    const transitionTracks: THREE.KeyframeTrack[] = [];
    const boneNames = Object.values(VRMHumanBoneName) as VRMHumanBoneName[];
    
    boneNames.forEach((boneName) => {
      const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
      if (node) {
        // Create full path name usually expected by the mixer?
        // Actually the mixer is on vrm.scene. 
        // If the incoming clip uses "hips.position", we should match that style?
        // But our clips are usually converted to scene paths (e.g. "Armature/Hips.position").
        // We need to match the track names of the INCOMING clip or just target the nodes directly.
        // It's safer to use the node.name based on hierarchy.
        
        // However, converting animation to scene paths uses `getNodePath`.
        // Let's assume we can target the node by its name if it's unique, or full path.
        // The easiest way to get a compatible track name is to look at the node's name structure or reuse the logic.
        
        // Let's use a simpler approach: Just use the node.name assuming uniqueness or simple hierarchy 
        // OR rely on the fact that we are fading TO a clip that has full paths.
        // We need the FROM clip to target the same objects.
        
        // Wait! The easiest way is to use `animationManager` to crossFade.
        // But we need a "from" action.
        // If we make a clip, we can play it.
        
        // Let's try to get the path relative to vrm.scene
        const getPath = (object: THREE.Object3D) => {
            const path = [object.name];
            let parent = object.parent;
            while (parent && parent !== this.vrm!.scene) {
                path.unshift(parent.name);
                parent = parent.parent;
            }
            return path.join('/');
        };
        
        const path = getPath(node);
        
        // Rotation
        const q = node.quaternion;
        const rotTrack = new THREE.QuaternionKeyframeTrack(
            `${path}.quaternion`,
            [0, 0.1], // 2 keyframes to define a static state over time
            [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]
        );
        transitionTracks.push(rotTrack);
        
        // Position (hips only usually)
        if (boneName === 'hips') {
            const p = node.position;
            const posTrack = new THREE.VectorKeyframeTrack(
                `${path}.position`,
                [0, 0.1],
                [p.x, p.y, p.z, p.x, p.y, p.z]
            );
            transitionTracks.push(posTrack);
        }
      }
    });
    
    const transitionClip = new THREE.AnimationClip('Transition_Pose', 0.1, transitionTracks);
    
    // 2. Play transition clip immediately (no fade, overwrite everything)
    // We treat this as the "base" layer
    this.isAnimated = true;
    
    // We need to access AnimationManager internals or add a method there.
    // Let's extend AnimationManager slightly or use it publicly.
    // Actually, `animationManager.playAnimation` stops everything.
    // We want to play transition, THEN fade to new.
    
    // Hack: We can just use the internal mixer if we expose it, or add a method.
    // Let's assume we can just modify `playAnimationClip` to do the logic.
    // But `animationManager` manages the single `currentAction`.
    // We need TWO actions to crossfade.
    
    // Let's delegate this complex logic to `animationManager.crossFadeTo(clip, duration)`
    // But first let's just commit this method stub and update AnimationManager.
    animationManager.playTransitionAndFade(transitionClip, clip, loop, fade);
  }

  /**
   * Play an animation clip directly (for Pose Lab)
   * @param clip - The THREE.AnimationClip to play
   * @param loop - Whether to loop the animation (default: true)
   * @param fade - Fade in duration in seconds (default: 0.3)
   */
  playAnimationClip(clip: THREE.AnimationClip, loop = true, fade = 0.3) {
    if (!this.vrm) {
      console.warn('[AvatarManager] Cannot play animation - VRM not loaded');
      return;
    }

    // If we are coming from a manual pose state (frozen or just static),
    // we should use the smart transition to avoid snapping.
    // If an animation is already playing, we can just let `animationManager` handle the fade (it usually fades out the old one).
    if (!this.isAnimationPlaying()) {
         this.playAnimationClipWithTransition(clip, loop, fade);
         return;
    }

    console.log('[AvatarManager] Playing animation clip:', clip.name, { loop });

    // NOTE: We do NOT reset the pose here. 
    // This allows the timeline to apply on top of the current state,
    // and prevents "snapping" to T-pose if the clip doesn't cover all bones immediately.

    // Set animated state and play animation
    this.isAnimated = true;
    animationManager.playAnimation(clip, loop, fade);
  }


  /**
   * Set animation loop mode
   */
  setAnimationLoop(loop: boolean) {
    if (this.isAnimated && animationManager.isPlaying()) {
      animationManager.setLoop(loop);
    }
  }

  /**
   * Set animation playback speed
   */
  setAnimationSpeed(speed: number) {
    if (this.isAnimated && animationManager.isPlaying()) {
      animationManager.setSpeed(speed);
    }
  }

  /**
   * Seek to a specific time in the current animation
   */
  seekAnimation(time: number) {
    if (this.isAnimated) {
      animationManager.seek(time);
    }
  }

  /**
   * Check if an animation is currently playing
   */
  isAnimationPlaying(): boolean {
    return this.isAnimated && animationManager.isPlaying();
  }

  /**
   * Captures the current pose and stops animation, keeping the avatar in its current state.
   * Useful when switching to manual editing from an animation.
   */
  freezeCurrentPose() {
    if (!this.vrm || !this.vrm.humanoid) return;
    console.log('[AvatarManager] Freezing current pose');

    // 1. Capture current bone transforms
    const poseData: Record<string, { rotation: THREE.Quaternion, position: THREE.Vector3 }> = {};
    
    // Iterate all possible humanoid bones
    // We cast to any because Object.values on enum can return strings that TS might strictly type
    const boneNames = Object.values(VRMHumanBoneName) as VRMHumanBoneName[];
    
    boneNames.forEach((boneName) => {
      const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
      if (node) {
        poseData[boneName] = {
          rotation: node.quaternion.clone(),
          position: node.position.clone()
        };
      }
    });

    // 2. Stop Animation (which resets bones to rest pose)
    this.stopAnimation();

    // 3. Re-apply captured transforms
    boneNames.forEach((boneName) => {
      const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
      if (node && poseData[boneName]) {
        node.quaternion.copy(poseData[boneName].rotation);
        node.position.copy(poseData[boneName].position); // Restore position for ALL bones
      }
    });
    
    // Force update
    this.vrm.humanoid.update();
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
    this.vrm.expressionManager?.update(); // Ensure updates if loop is paused
  }

  /**
   * Get list of available expressions from the loaded VRM
   */
  getAvailableExpressions(): string[] {
    if (!this.vrm?.expressionManager) return [];
    
    // @pixiv/three-vrm handles expressions as an array of objects
    // We can extract names from there
    const names: string[] = [];
    
    // Access internal expressions array if available
    // Note: TypeScript might complain if types aren't perfect, so we cast to any for safety
    const manager = this.vrm.expressionManager as any;
    
    if (manager.expressions) {
      manager.expressions.forEach((expr: any) => {
        if (expr.expressionName) {
          names.push(expr.expressionName);
        }
      });
    } else if (manager._expressionMap) {
      // Fallback for older versions
      Object.keys(manager._expressionMap).forEach(name => names.push(name));
    }
    
    return names.sort();
  }

  /**
   * Set weight for a specific expression
   */
  setExpressionWeight(name: string, weight: number) {
    if (!this.vrm?.expressionManager) return;
    this.vrm.expressionManager.setValue(name, weight);
    this.vrm.expressionManager.update(); // Ensure potential blends are calculated
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

