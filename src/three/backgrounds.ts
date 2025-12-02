import * as THREE from 'three';
import type { BackgroundId } from '../types/reactions';

type BackgroundDefinition = {
  id: BackgroundId;
  label: string;
  color: THREE.ColorRepresentation;
  image?: string; // Optional: path to background image
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
  };
};

const backgroundDefinitions: BackgroundDefinition[] = [
  {
    id: 'midnight-circuit',
    label: 'Midnight Circuit',
    color: '#05060c',
    image: '/backgrounds/midnight-circuit.svg',
  },
  {
    id: 'protocol-sunset',
    label: 'Protocol Sunset',
    color: '#ff6f61',
    image: '/backgrounds/protocol-sunset.svg',
  },
  {
    id: 'green-loom-matrix',
    label: 'Green Loom Matrix',
    color: '#0b3d2e',
    image: '/backgrounds/green-loom-matrix.svg',
  },
  {
    id: 'neural-grid',
    label: 'Neural Grid',
    color: '#1a1a2e',
    image: '/backgrounds/neural-grid.svg',
  },
  {
    id: 'cyber-waves',
    label: 'Cyber Waves',
    color: '#0d1b2a',
    image: '/backgrounds/cyber-waves.svg',
  },
  {
    id: 'signal-breach',
    label: 'Signal Breach',
    color: '#1a0a0a',
    image: '/backgrounds/signal-breach.svg',
  },
  {
    id: 'quantum-field',
    label: 'Quantum Field',
    color: '#2d1b4e',
    image: '/backgrounds/quantum-field.svg',
  },
  {
    id: 'protocol-dawn',
    label: 'Protocol Dawn',
    color: '#1a2332',
    image: '/backgrounds/protocol-dawn.svg',
  },
];

// Cache loaded textures
const textureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();

export function getBackgroundDefinition(id: BackgroundId): BackgroundDefinition {
  return backgroundDefinitions.find((entry) => entry.id === id) ?? backgroundDefinitions[0];
}

export async function applyBackground(scene: THREE.Scene, id: BackgroundId) {
  const definition = getBackgroundDefinition(id);
  
  // Try to load image if specified
  if (definition.image) {
    try {
      let texture = textureCache.get(definition.image);
      
      if (!texture) {
        console.log('[Background] Loading image:', definition.image);
        texture = await new Promise<THREE.Texture>((resolve, reject) => {
          textureLoader.load(
            definition.image!,
            (loadedTexture) => {
              loadedTexture.colorSpace = THREE.SRGBColorSpace;
              resolve(loadedTexture);
            },
            undefined,
            (error) => {
              console.warn('[Background] Failed to load image:', definition.image, error);
              reject(error);
            }
          );
        });
        textureCache.set(definition.image, texture);
      }
      
      scene.background = texture;
      console.log('[Background] Applied image:', definition.image);
      return;
    } catch (error) {
      console.warn('[Background] Image load failed, using color fallback');
    }
  }
  
  // Fallback to solid color
  scene.background = new THREE.Color(definition.color);
  console.log('[Background] Applied color:', definition.color);
}

export const backgroundOptions = backgroundDefinitions;

