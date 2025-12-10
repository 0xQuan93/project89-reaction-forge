import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { avatarManager } from '../three/avatarManager';
import { animationManager } from '../three/animationManager';

export async function exportAsGLB(filename: string) {
  const vrm = avatarManager.getVRM();
  if (!vrm) throw new Error('No avatar loaded');

  const exporter = new GLTFExporter();
  
  // Get current animation clip
  const currentAction = animationManager.getCurrentAction();
  const clip = currentAction ? currentAction.getClip() : undefined;
  
  const animations = clip ? [clip] : [];
  
  console.log('[GLBExporter] Exporting GLB...', { 
    hasAnimation: !!clip, 
    animationName: clip?.name,
    duration: clip?.duration 
  });

  return new Promise<void>((resolve, reject) => {
    exporter.parse(
      vrm.scene,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
        link.click();
        URL.revokeObjectURL(url);
        resolve();
      },
      (error) => {
        console.error('GLB Export failed:', error);
        reject(error);
      },
      {
        binary: true,
        animations: animations,
        onlyVisible: false, // Ensure hidden meshes might be exported if needed, though usually true is safer
        truncateDrawRange: true,
      }
    );
  });
}

