import * as THREE from 'three';
import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { VRMPose } from '@pixiv/three-vrm';
import { sceneManager } from './sceneManager';
import { materialManager } from './materialManager';
import type { PeerId, AvatarState } from '../types/multiplayer';

/** Position offset for multiple avatars (arranged in a line) */
const AVATAR_SPACING = 1.2; // meters between avatars

/** Individual avatar instance data */
interface AvatarInstance {
  vrm: VRM;
  peerId: PeerId;
  isLocal: boolean;
  displayName: string;
  mixer: THREE.AnimationMixer;
  currentAction?: THREE.AnimationAction;
  isAnimated: boolean;
  lastUpdate: number;
  /** Offset position in the scene */
  positionOffset: THREE.Vector3;
}

/**
 * MultiAvatarManager handles multiple VRM avatars in the scene.
 * Extends the original AvatarManager pattern to support multiplayer.
 */
class MultiAvatarManager {
  private loader = new ThreeGLTFLoader();
  private avatars = new Map<PeerId, AvatarInstance>();
  private localPeerId: PeerId | null = null;
  private tickDispose?: () => void;
  private isInteracting = false;
  private isManualPosing = false;

  constructor() {
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  // ==================
  // Local Avatar Management
  // ==================

  /** Set the local peer ID */
  setLocalPeerId(peerId: PeerId) {
    this.localPeerId = peerId;
  }

  /** Get the local avatar's VRM */
  getLocalVRM(): VRM | undefined {
    if (!this.localPeerId) return undefined;
    return this.avatars.get(this.localPeerId)?.vrm;
  }

  /** Get the local avatar instance */
  getLocalAvatar(): AvatarInstance | undefined {
    if (!this.localPeerId) return undefined;
    return this.avatars.get(this.localPeerId);
  }

  /** Check if manual posing is enabled */
  isManualPosingEnabled(): boolean {
    return this.isManualPosing;
  }

  /** Set manual posing mode */
  setManualPosing(enabled: boolean) {
    this.isManualPosing = enabled;
  }

  /** Set interaction state */
  setInteraction(interacting: boolean) {
    this.isInteracting = interacting;
  }

  // ==================
  // Avatar Loading
  // ==================

  /**
   * Load a VRM for a peer
   * @param peerId - The peer's unique ID
   * @param url - URL to the VRM file (blob: URL or remote)
   * @param isLocal - Whether this is the local user's avatar
   * @param displayName - Display name for the avatar
   */
  async loadAvatar(
    peerId: PeerId,
    url: string,
    isLocal: boolean,
    displayName: string
  ): Promise<VRM> {
    const scene = sceneManager.getScene();
    if (!scene) throw new Error('Scene not initialized');

    console.log(`[MultiAvatarManager] Loading avatar for peer: ${peerId} (${isLocal ? 'local' : 'remote'})`);

    // Check if this peer already has an avatar
    const existing = this.avatars.get(peerId);
    if (existing) {
      // Remove existing avatar
      this.removeAvatar(peerId);
    }

    // Load the VRM
    const gltf = await this.loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('Invalid VRM file');

    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.removeUnnecessaryJoints(vrm.scene);

    // Calculate position offset based on avatar count
    const positionOffset = this.calculatePositionOffset(peerId, isLocal);

    // Create avatar instance
    const instance: AvatarInstance = {
      vrm,
      peerId,
      isLocal,
      displayName,
      mixer: new THREE.AnimationMixer(vrm.scene),
      isAnimated: false,
      lastUpdate: Date.now(),
      positionOffset,
    };

    // Position the avatar
    vrm.scene.position.copy(positionOffset);

    // Add to scene
    scene.add(vrm.scene);

    // Store instance
    this.avatars.set(peerId, instance);

    // If local, set as local peer
    if (isLocal) {
      this.localPeerId = peerId;
    }

    // Update all avatar positions for proper layout
    this.updateAllPositions();

    // Frame camera on local avatar
    if (isLocal) {
      sceneManager.frameObject(vrm.scene);
    }

    // Start tick loop if not already running
    this.ensureTickLoop();

    // Apply material settings
    materialManager.onVRMLoaded();

    console.log(`[MultiAvatarManager] Avatar loaded: ${peerId}, total avatars: ${this.avatars.size}`);

    return vrm;
  }

  /**
   * Load a remote avatar from ArrayBuffer (received via WebRTC)
   */
  async loadRemoteAvatarFromBuffer(
    peerId: PeerId,
    buffer: ArrayBuffer,
    displayName: string
  ): Promise<VRM> {
    // Create a blob URL from the buffer
    const blob = new Blob([buffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);

    try {
      const vrm = await this.loadAvatar(peerId, url, false, displayName);
      return vrm;
    } finally {
      // Clean up blob URL after loading
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Register an existing VRM (already in scene) with the multiAvatarManager.
   * Used when migrating from single-player avatarManager to multiplayer.
   * Does NOT add to scene or load - just registers for tracking and sync.
   */
  registerExistingAvatar(
    peerId: PeerId,
    vrm: VRM,
    isLocal: boolean,
    displayName: string
  ) {
    console.log(`[MultiAvatarManager] Registering existing avatar for peer: ${peerId}`);

    // Check if this peer already has an avatar registered
    const existingInstance = this.avatars.get(peerId);
    if (existingInstance) {
      // If it's the same VRM object, skip (no change needed)
      if (existingInstance.vrm === vrm) {
        console.log(`[MultiAvatarManager] Peer ${peerId} already has this exact avatar, skipping`);
        return;
      }
      
      // Different VRM - this is an avatar replacement
      console.log(`[MultiAvatarManager] Peer ${peerId} is replacing their avatar`);
      
      // Stop any running animations on the old avatar
      existingInstance.mixer.stopAllAction();
      
      // Note: We don't remove the old VRM from scene here because avatarManager 
      // already handles that during load() - it removes the old scene object
      // before adding the new one
      
      // Remove old instance from our tracking
      this.avatars.delete(peerId);
    }

    // Create avatar instance without repositioning (it's already in scene)
    const instance: AvatarInstance = {
      vrm,
      peerId,
      isLocal,
      displayName,
      mixer: new THREE.AnimationMixer(vrm.scene),
      isAnimated: false,
      lastUpdate: Date.now(),
      positionOffset: new THREE.Vector3(0, 0, 0), // Keep current position
    };

    // Store instance
    this.avatars.set(peerId, instance);

    // If local, set as local peer
    if (isLocal) {
      this.localPeerId = peerId;
    }

    // Update all avatar positions for proper layout
    this.updateAllPositions();

    // Start tick loop if not already running
    this.ensureTickLoop();

    console.log(`[MultiAvatarManager] Registered existing avatar: ${peerId}, total avatars: ${this.avatars.size}`);
  }

  /**
   * Remove an avatar from the scene
   */
  removeAvatar(peerId: PeerId) {
    const instance = this.avatars.get(peerId);
    if (!instance) return;

    console.log(`[MultiAvatarManager] Removing avatar: ${peerId}`);

    const scene = sceneManager.getScene();
    if (scene) {
      scene.remove(instance.vrm.scene);
    }

    // Clean up mixer
    if (instance.currentAction) {
      instance.currentAction.stop();
    }
    instance.mixer.stopAllAction();

    // Remove from map
    this.avatars.delete(peerId);

    // Recalculate positions for remaining avatars
    this.recalculatePositions();

    // If no avatars left, stop tick loop
    if (this.avatars.size === 0) {
      this.tickDispose?.();
      this.tickDispose = undefined;
    }
  }

  /**
   * Remove all avatars
   */
  removeAllAvatars() {
    const peerIds = Array.from(this.avatars.keys());
    peerIds.forEach(peerId => this.removeAvatar(peerId));
    this.localPeerId = null;
  }

  // ==================
  // Pose Application
  // ==================

  /**
   * Apply a pose to an avatar
   * Note: For remote avatars only - local avatar is controlled by avatarManager
   */
  applyPose(peerId: PeerId, pose: VRMPose, forceLocal = false) {
    const instance = this.avatars.get(peerId);
    if (!instance || !instance.vrm.humanoid) return;

    // Safety check: don't apply external poses to local avatar unless forced
    if (instance.isLocal && !forceLocal) {
      console.warn(`[MultiAvatarManager] Ignoring external pose for local avatar`);
      return;
    }

    instance.vrm.humanoid.setNormalizedPose(pose);
    instance.vrm.update(0);
    instance.lastUpdate = Date.now();
  }

  /**
   * Apply expressions to an avatar
   * Note: For remote avatars only - local avatar expressions are controlled by avatarManager
   */
  applyExpressions(peerId: PeerId, expressions: Record<string, number>, forceLocal = false) {
    const instance = this.avatars.get(peerId);
    if (!instance || !instance.vrm.expressionManager) return;

    // Safety check: don't apply external expressions to local avatar unless forced
    if (instance.isLocal && !forceLocal) {
      console.warn(`[MultiAvatarManager] Ignoring external expressions for local avatar`);
      return;
    }

    Object.entries(expressions).forEach(([name, value]) => {
      instance.vrm.expressionManager?.setValue(name, value);
    });
    instance.vrm.expressionManager.update();
    instance.lastUpdate = Date.now();
  }

  /**
   * Apply scene rotation to an avatar
   * Note: For remote avatars only - local avatar rotation is controlled directly
   */
  applySceneRotation(peerId: PeerId, rotation: { x: number; y: number; z: number }, forceLocal = false) {
    const instance = this.avatars.get(peerId);
    if (!instance) return;

    // Safety check: don't apply external rotation to local avatar unless forced
    if (instance.isLocal && !forceLocal) {
      console.warn(`[MultiAvatarManager] Ignoring external rotation for local avatar`);
      return;
    }

    instance.vrm.scene.rotation.set(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z)
    );
  }

  /**
   * Apply scene position to an avatar (user-controlled X-axis translation)
   * Note: For remote avatars only - local avatar position is controlled directly
   */
  applyScenePosition(peerId: PeerId, position: { x: number; y: number; z: number }, forceLocal = false) {
    const instance = this.avatars.get(peerId);
    if (!instance) return;

    // Safety check: don't apply external position to local avatar unless forced
    if (instance.isLocal && !forceLocal) {
      console.warn(`[MultiAvatarManager] Ignoring external position for local avatar`);
      return;
    }

    // Apply user-controlled position (from gizmo translation)
    instance.vrm.scene.position.set(position.x, position.y, position.z);
    
    // Update the stored offset
    instance.positionOffset.set(position.x, position.y, position.z);
  }

  /**
   * Apply full avatar state (pose + expressions + rotation)
   * Note: For remote avatars only - local avatar is controlled by avatarManager
   */
  applyAvatarState(peerId: PeerId, state: AvatarState, forceLocal = false) {
    const instance = this.avatars.get(peerId);
    if (!instance) return;

    // Safety check: don't apply external state to local avatar unless forced
    if (instance.isLocal && !forceLocal) {
      console.warn(`[MultiAvatarManager] Ignoring external state for local avatar`);
      return;
    }

    this.applyPose(peerId, state.pose, forceLocal);
    this.applyExpressions(peerId, state.expressions, forceLocal);
    this.applySceneRotation(peerId, state.sceneRotation, forceLocal);
    if (state.position) {
      this.applyScenePosition(peerId, state.position, forceLocal);
    }
  }

  /**
   * Get the current state of the local avatar
   */
  getLocalAvatarState(): AvatarState | null {
    const instance = this.getLocalAvatar();
    if (!instance || !instance.vrm.humanoid) return null;

    // Capture current pose
    const pose = this.captureCurrentPose(instance);

    // Capture expressions
    const expressions = this.captureExpressions(instance);

    // Get scene rotation
    const sceneRotation = {
      x: THREE.MathUtils.radToDeg(instance.vrm.scene.rotation.x),
      y: THREE.MathUtils.radToDeg(instance.vrm.scene.rotation.y),
      z: THREE.MathUtils.radToDeg(instance.vrm.scene.rotation.z),
    };

    // Get scene position (user-controlled via gizmo)
    const scenePosition = instance.vrm.scene.position;

    return {
      peerId: instance.peerId,
      displayName: instance.displayName,
      sceneRotation,
      pose,
      expressions,
      position: {
        x: scenePosition.x,
        y: scenePosition.y,
        z: scenePosition.z,
      },
      hasAvatar: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Capture the current pose from a VRM
   */
  private captureCurrentPose(instance: AvatarInstance): VRMPose {
    const pose: VRMPose = {};
    const humanoid = instance.vrm.humanoid;
    if (!humanoid) return pose;

    const boneNames = Object.values(VRMHumanBoneName) as VRMHumanBoneName[];
    boneNames.forEach(name => {
      const node = humanoid.getNormalizedBoneNode(name);
      if (node) {
        const q = node.quaternion;
        pose[name] = {
          rotation: [q.x, q.y, q.z, q.w],
        };
        // Don't sync hips position - different avatars have different proportions
        // and syncing position causes floating/sinking issues
      }
    });

    return pose;
  }

  /**
   * Capture current expressions from a VRM
   */
  private captureExpressions(instance: AvatarInstance): Record<string, number> {
    const expressions: Record<string, number> = {};
    const manager = instance.vrm.expressionManager;
    if (!manager) return expressions;

    // Get all expression names and their values
    const expressionNames = this.getAvailableExpressions(instance.peerId);
    expressionNames.forEach(name => {
      const value = manager.getValue(name);
      if (value !== undefined && value !== null && value > 0) {
        expressions[name] = value;
      }
    });

    return expressions;
  }

  // ==================
  // Animation
  // ==================

  /**
   * Play an animation clip on an avatar
   */
  playAnimationClip(peerId: PeerId, clip: THREE.AnimationClip, loop = true, fade = 0.3) {
    const instance = this.avatars.get(peerId);
    if (!instance) return;

    // Stop current animation with fade
    if (instance.currentAction) {
      instance.currentAction.fadeOut(fade);
    }

    // Create and play new action
    const action = instance.mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(fade);
    action.play();

    instance.currentAction = action;
    instance.isAnimated = true;
  }

  /**
   * Stop animation on an avatar
   */
  stopAnimation(peerId: PeerId, immediate = true) {
    const instance = this.avatars.get(peerId);
    if (!instance) return;

    if (instance.currentAction) {
      if (immediate) {
        instance.currentAction.stop();
        instance.currentAction.reset();
      } else {
        instance.currentAction.fadeOut(0.3);
      }
      instance.currentAction = undefined;
    }

    if (immediate) {
      instance.mixer.stopAllAction();
    }

    instance.isAnimated = false;
  }

  /**
   * Freeze current pose (for switching from animation to manual posing)
   */
  freezeCurrentPose(peerId: PeerId) {
    const instance = this.avatars.get(peerId);
    if (!instance || !instance.vrm.humanoid) return;

    // Capture current transforms
    const boneNames = Object.values(VRMHumanBoneName) as VRMHumanBoneName[];
    const poseData = new Map<VRMHumanBoneName, { q: THREE.Quaternion; p: THREE.Vector3 }>();

    boneNames.forEach(name => {
      const node = instance.vrm.humanoid!.getNormalizedBoneNode(name);
      if (node) {
        poseData.set(name, { q: node.quaternion.clone(), p: node.position.clone() });
      }
    });

    // Stop animation
    this.stopAnimation(peerId, true);

    // Re-apply transforms
    poseData.forEach((data, name) => {
      const node = instance.vrm.humanoid!.getNormalizedBoneNode(name);
      if (node) {
        node.quaternion.copy(data.q);
        if (name === VRMHumanBoneName.Hips) {
          node.position.copy(data.p);
        }
      }
    });

    instance.vrm.humanoid.update();
    instance.vrm.update(0);
  }

  /**
   * Reset an avatar to T-pose
   */
  resetPose(peerId: PeerId) {
    const instance = this.avatars.get(peerId);
    if (!instance) return;

    this.stopAnimation(peerId);
    instance.vrm.humanoid?.resetNormalizedPose();
    instance.vrm.update(0);
  }

  // ==================
  // Utilities
  // ==================

  /**
   * Get available expressions for an avatar
   */
  getAvailableExpressions(peerId: PeerId): string[] {
    const instance = this.avatars.get(peerId);
    if (!instance?.vrm.expressionManager) return [];

    const names: string[] = [];
    const manager = instance.vrm.expressionManager as unknown as {
      expressionMap?: Record<string, unknown>;
      expressions?: { expressionName?: string }[];
    };

    if (manager.expressionMap) {
      Object.keys(manager.expressionMap).forEach(name => names.push(name));
    } else if (manager.expressions) {
      manager.expressions.forEach(expr => {
        if (expr.expressionName) names.push(expr.expressionName);
      });
    }

    return names.sort();
  }

  /**
   * Set expression weight for an avatar
   */
  setExpressionWeight(peerId: PeerId, name: string, weight: number) {
    const instance = this.avatars.get(peerId);
    if (!instance?.vrm.expressionManager) return;

    instance.vrm.expressionManager.setValue(name, weight);
    instance.vrm.expressionManager.update();
  }

  /**
   * Get all avatar instances
   */
  getAllAvatars(): Map<PeerId, AvatarInstance> {
    return this.avatars;
  }

  /**
   * Get avatar count
   */
  getAvatarCount(): number {
    return this.avatars.size;
  }

  /**
   * Check if a peer has an avatar
   */
  hasAvatar(peerId: PeerId): boolean {
    return this.avatars.has(peerId);
  }

  /**
   * Get VRM for a peer
   */
  getVRM(peerId: PeerId): VRM | undefined {
    return this.avatars.get(peerId)?.vrm;
  }

  // ==================
  // Internal
  // ==================

  /**
   * Calculate position offset for an avatar
   */
  private calculatePositionOffset(peerId: PeerId, isLocal: boolean): THREE.Vector3 {
    // Get all avatars including the one being added
    const allAvatars = Array.from(this.avatars.values());
    const totalCount = allAvatars.length + (this.avatars.has(peerId) ? 0 : 1);
    
    if (totalCount === 1) {
      // Single avatar - center
      return new THREE.Vector3(0, 0, 0);
    }
    
    // Multiple avatars - arrange symmetrically around center
    // Local avatar on the left, remote avatars on the right
    if (isLocal) {
      return new THREE.Vector3(-AVATAR_SPACING / 2, 0, 0);
    } else {
      // Remote avatars to the right
      return new THREE.Vector3(AVATAR_SPACING / 2, 0, 0);
    }
  }

  /**
   * Recalculate and apply positions for all avatars
   * Called when avatars are added/removed to maintain proper layout
   * Only sets INITIAL positions - doesn't override user-controlled positions
   */
  private updateAllPositions() {
    const avatarList = Array.from(this.avatars.values());
    const totalCount = avatarList.length;
    
    if (totalCount <= 1) {
      // Single or no avatars - only set initial position if not already positioned
      avatarList.forEach(instance => {
        // Only set position if this is a fresh avatar (position is 0,0,0)
        if (instance.positionOffset.lengthSq() === 0 && instance.vrm.scene.position.lengthSq() === 0) {
          instance.positionOffset.set(0, 0, 0);
          instance.vrm.scene.position.set(0, 0, 0);
        }
      });
      return;
    }
    
    // Multiple avatars - calculate initial positions for NEW avatars only
    // Don't override positions of avatars that have already been positioned
    const sortedAvatars = avatarList.sort((a, b) => a.peerId.localeCompare(b.peerId));
    
    sortedAvatars.forEach((instance, index) => {
      // Only set position for avatars that haven't been positioned yet
      // (positionOffset is 0,0,0 and scene position is also 0,0,0)
      const isUnpositioned = instance.positionOffset.lengthSq() === 0;
      
      if (isUnpositioned) {
        // First avatar (alphabetically by peer ID) goes left, rest go right
        const xOffset = index === 0 ? -AVATAR_SPACING / 2 : AVATAR_SPACING / 2 + (index - 1) * AVATAR_SPACING;
        instance.positionOffset.set(xOffset, 0, 0);
        instance.vrm.scene.position.copy(instance.positionOffset);
        console.log(`[MultiAvatarManager] Set initial position for ${instance.peerId}: x=${xOffset}`);
      }
    });
  }

  /**
   * Recalculate positions after avatar removal
   */
  private recalculatePositions() {
    // Delegate to updateAllPositions for consistent layout
    this.updateAllPositions();
  }

  /**
   * Ensure the tick loop is running
   */
  private ensureTickLoop() {
    if (this.tickDispose) return;

    this.tickDispose = sceneManager.registerTick((delta) => {
      this.avatars.forEach(instance => {
        // Update VRM
        instance.vrm.update(delta);

        // Update animation mixer if animated and not interacting
        if (instance.isAnimated && !(instance.isLocal && this.isInteracting)) {
          instance.mixer.update(delta);
        }
      });
    });
  }

  /**
   * Rebind all avatars to scene (for scene reset)
   */
  rebindToScene() {
    const scene = sceneManager.getScene();
    if (!scene) return;

    this.avatars.forEach(instance => {
      instance.vrm.scene.removeFromParent();
      scene.add(instance.vrm.scene);
    });

    this.ensureTickLoop();
  }
}

export const multiAvatarManager = new MultiAvatarManager();


