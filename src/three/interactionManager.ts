import * as THREE from 'three';
import { TransformControls } from 'three-stdlib';
import { VRMHumanBoneName } from '@pixiv/three-vrm';
import { sceneManager } from './sceneManager';
import { avatarManager } from './avatarManager';

const CONTROL_BONES: VRMHumanBoneName[] = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
];

class InteractionManager {
  private transformControls?: TransformControls;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private boneHelpers: THREE.Mesh[] = [];
  private isEnabled = false;
  private boundOnPointerDown: (event: PointerEvent) => void;

  constructor() {
    this.boundOnPointerDown = this.onPointerDown.bind(this);
  }

  init() {
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    const renderer = sceneManager.getRenderer();
    
    if (!scene || !camera || !renderer) {
      console.warn('[InteractionManager] Scene not ready for initialization');
      return;
    }

    this.transformControls = new TransformControls(camera, renderer.domElement);
    // @ts-ignore
    this.transformControls.addEventListener('dragging-changed', (event: any) => {
      const controls = sceneManager.getControls();
      if (controls) controls.enabled = !event.value;
      
      // Auto-pause animation while dragging to prevent fighting
      if (event.value) {
         avatarManager.pauseAnimation();
      } else {
         // Optional: resume or stay paused? 
         // For precise posing, we probably want to stay paused so the user sees their change.
         // If we resume, the animation frame will instantly overwrite the user's pose.
         // So we do NOT resume automatically.
         // avatarManager.resumeAnimation();
      }
    });
    
    // Set to rotate mode by default as that's what we mostly do with bones
    this.transformControls.setMode('rotate');
    this.transformControls.setSpace('local'); // Local rotation is more intuitive for limbs
    
    scene.add(this.transformControls);
  }

  setGizmoMode(mode: 'translate' | 'rotate') {
    if (this.transformControls) {
      this.transformControls.setMode(mode);
    }
  }
  
  setGizmoSpace(space: 'local' | 'world') {
    if (this.transformControls) {
      this.transformControls.setSpace(space);
    }
  }

  get enabled() {
    return this.isEnabled;
  }

  toggle(enable: boolean) {
    if (this.isEnabled === enable) return;
    
    // Lazy initialization
    if (enable && !this.transformControls) {
      this.init();
      if (!this.transformControls) {
        console.warn('[InteractionManager] Failed to initialize (scene not ready?)');
        return;
      }
    }
    
    this.isEnabled = enable;
    const renderer = sceneManager.getRenderer();
    
    if (enable) {
      this.createBoneHelpers();
      renderer?.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
      console.log('[InteractionManager] Enabled - Bone helpers created');
    } else {
      this.removeBoneHelpers();
      this.transformControls?.detach();
      renderer?.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
      console.log('[InteractionManager] Disabled');
    }
  }

  private createBoneHelpers() {
    const vrm = avatarManager.getVRM();
    if (!vrm || !vrm.humanoid) return;

    // Material for the bone joints (semi-transparent cyan)
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffd6,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
    });

    const geometry = new THREE.SphereGeometry(0.04, 8, 8); // Small spheres

    CONTROL_BONES.forEach((boneName) => {
      const node = vrm.humanoid?.getNormalizedBoneNode(boneName);
      if (node) {
        const helper = new THREE.Mesh(geometry, material);
        helper.userData = { isBoneHelper: true, boneName: boneName, boneNode: node };
        
        // We attach the helper directly to the bone node so it moves with it
        node.add(helper);
        this.boneHelpers.push(helper);
      }
    });
    
    // Ensure helpers render on top
    // Note: Since they are inside the scene graph, render order might be tricky.
    // Disabling depth test usually works for overlays.
  }

  private removeBoneHelpers() {
    this.boneHelpers.forEach((helper) => {
      if (helper.parent) {
        helper.parent.remove(helper);
      }
      if (helper.geometry) helper.geometry.dispose();
    });
    this.boneHelpers = [];
  }

  private onPointerDown(event: PointerEvent) {
    if (!this.isEnabled || !this.transformControls) return;

    // Don't select if we are clicking on the gizmo itself
    // TransformControls handles its own interaction, so we check if it's NOT dragging/hovered?
    // Actually, TransformControls consumes the event if it's interacting.
    // But we need to check if we hit a helper.
    
    const canvas = sceneManager.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const camera = sceneManager.getCamera();
    if (!camera) return;

    this.raycaster.setFromCamera(this.mouse, camera);

    // Raycast against bone helpers
    const intersects = this.raycaster.intersectObjects(this.boneHelpers, false);

    if (intersects.length > 0) {
      // Hit a bone helper
      const hit = intersects[0].object;
      const boneNode = hit.userData.boneNode;
      const boneName = hit.userData.boneName;
      
      if (boneNode) {
        console.log(`[InteractionManager] Selected bone: ${boneName}`);
        this.transformControls.attach(boneNode);
        
        // Highlight selected helper
        this.boneHelpers.forEach(h => (h.material as THREE.MeshBasicMaterial).color.setHex(0x00ffd6));
        (hit as THREE.Mesh).material = new THREE.MeshBasicMaterial({
            color: 0xff0055, // Magenta for selected
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });
      }
    } else {
      // Clicked empty space? Deselect?
      // Only deselect if we didn't click the gizmo. 
      // But raycasting the gizmo is hard from here.
      // Usually TransformControls intercepts events. 
      // If we are here, maybe we missed everything.
      // Let's not auto-deselect for now to be safe, or check if we are dragging.
      // Better: click on background deselects.
      
      // Checking if we are hovering the gizmo is tricky without accessing its internal raycaster.
      // We'll leave it for now. Users can click another bone to switch.
    }
  }
  
  update() {
    // Called every frame if needed
  }
  
  dispose() {
    this.toggle(false);
    if (this.transformControls) {
      this.transformControls.dispose();
      this.transformControls.removeFromParent();
    }
  }
}

export const interactionManager = new InteractionManager();

