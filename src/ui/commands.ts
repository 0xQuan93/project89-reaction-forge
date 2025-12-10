import type { Action } from "kbar";
import { useToast } from "./Toast";
import { sceneManager } from "../three/sceneManager";
import { avatarManager } from "../three/avatarManager";
import { animationManager } from "../three/animationManager";
import { interactionManager } from "../three/interactionManager";

// Helper to access store outside of component
const getToast = () => useToast.getState();

export const commands: Action[] = [
  { 
      id: "export-png", 
      name: "Export PNG", 
      shortcut: ["p"], 
      keywords: "save image screenshot",
      perform: () => {
          const link = document.createElement('a');
          link.href = sceneManager.getCanvas()?.toDataURL('image/png') || '';
          link.download = `PoseLab_Capture_${Date.now()}.png`;
          link.click();
          getToast().addToast('📸 PNG Saved', 'success');
      } 
  },
  { 
      id: "camera-front", 
      name: "Camera: Front", 
      shortcut: ["1"], 
      keywords: "view front",
      perform: () => {
          sceneManager.setCameraPreset('front');
          getToast().addToast('Camera: Front', 'info');
      } 
  },
  { 
      id: "gizmo-rotate", 
      name: "Gizmo: Rotate", 
      shortcut: ["2"], 
      keywords: "rotate tool",
      perform: () => {
         if (interactionManager.enabled) {
             interactionManager.toggle(false);
             getToast().addToast('Tool: Rotate Off', 'info');
         } else {
             interactionManager.toggle(true);
             interactionManager.setGizmoMode('rotate');
             getToast().addToast('Tool: Rotate On', 'info');
         }
      } 
  },
  {
      id: "reset-pose",
      name: "Reset Pose",
      shortcut: ["r"],
      keywords: "tpose clear",
      perform: () => {
          avatarManager.resetPose();
          getToast().addToast('Pose Reset', 'info');
      }
  },
  {
      id: "stop-anim",
      name: "Stop Animation",
      shortcut: ["space"],
      keywords: "pause halt",
      perform: () => {
          animationManager.stopAnimation();
          getToast().addToast('Animation Stopped', 'info');
      }
  }
];
