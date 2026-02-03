import type { BackgroundId } from '../types/reactions';
import type { TimelineSequence } from '../types/timeline';
import type { AnimationMode } from '../types/reactions';
import type { VRMPose } from '@pixiv/three-vrm';
import type { LightSettings } from '../three/lightingManager';
import type { PostProcessingSettings } from '../three/postProcessingManager';
import type { EnvironmentSettings } from '../three/environmentManager';
import type { MaterialSettings } from '../three/materialManager';

export interface ProjectState {
  version: number;
  date: number;
  metadata: {
    name: string;
    description?: string;
  };
  scene: {
    backgroundId: BackgroundId | string;
    customBackgroundData?: string | null;
    customBackgroundType?: string | null;
    
    // Custom HDRI
    customEnvironmentData?: string | null; // Base64
    customEnvironmentType?: string | null; // e.g. 'application/x-hdr'
    
    // 3D Environments
    environments3d?: Array<{
      id: string;
      name: string;
      data?: string; // Base64 of GLB (optional if url provided)
      url?: string; // URL for remote assets
      settings: {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: number;
        visible: boolean;
        castShadow: boolean;
        receiveShadow: boolean;
      };
    }>;
    
    camera: {
      position: { x: number; y: number; z: number };
      target: { x: number; y: number; z: number };
    };

    // Full Scene Settings
    lighting?: LightSettings;
    postProcessing?: PostProcessingSettings;
    environmentSettings?: EnvironmentSettings;
    material?: MaterialSettings;
  };
  timeline: {
    sequence: TimelineSequence;
    duration: number;
  };
  reaction: {
    animationMode: AnimationMode;
    activePresetId: string;
  };
  avatar: {
    url?: string;
    name?: string; // For display if URL is blob/missing
    pose?: VRMPose; // Current bone rotations
    expressions?: Record<string, number>; // Facial expression weights
    transform?: {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number }; // Euler
    };
  };
}

// Current version of the project file format
export const PROJECT_VERSION = 4;
