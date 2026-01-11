import * as THREE from 'three';
import type { BackgroundId } from '../types/reactions';
import { GifTexture } from './GifTexture';

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
  {
    id: 'green-screen',
    label: 'Green Screen',
    color: '#00ff00',
  },
];

// Cache loaded textures
const textureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();

export interface AnimatedBackground {
  texture: THREE.Texture;
  update: (delta: number) => void;
  dispose: () => void;
}

export function getBackgroundDefinition(id: BackgroundId | string): BackgroundDefinition {
  if (id.startsWith('blob:') || id.startsWith('data:')) {
    return {
      id: id as BackgroundId,
      label: 'Custom Background',
      color: '#000000',
      image: id
    };
  }
  return backgroundDefinitions.find((entry) => entry.id === id) ?? backgroundDefinitions[0];
}

export async function applyBackground(scene: THREE.Scene, id: BackgroundId | string): Promise<AnimatedBackground | null> {
  const definition = getBackgroundDefinition(id);
  
  // Try to load image if specified
  if (definition.image) {
    try {
      // Check for Custom Blob URL with Type Hint
      if (definition.image.startsWith('blob:') && definition.image.includes('#type=')) {
        const [url, typeParam] = definition.image.split('#type=');
        
        // Handle GIF
        if (typeParam.includes('gif')) {
           console.log('[Background] Detected GIF:', url);
           const gifTexture = new GifTexture();
           await gifTexture.load(url);
           scene.background = gifTexture.texture;
           
           return {
             texture: gifTexture.texture,
             update: (delta) => gifTexture.update(delta),
             dispose: () => gifTexture.dispose()
           };
        }
        
        // Handle Video
        if (typeParam.includes('video') || typeParam.includes('mp4') || typeParam.includes('webm')) {
           console.log('[Background] Detected Video:', url);
           const video = document.createElement('video');
           video.src = url;
           video.loop = true;
           video.muted = true;
           video.play().catch(e => console.warn('[Background] Video autoplay failed:', e));
           
           const videoTexture = new THREE.VideoTexture(video);
           videoTexture.colorSpace = THREE.SRGBColorSpace;
           scene.background = videoTexture;
           
           return {
             texture: videoTexture,
             update: () => {}, // VideoTexture updates automatically
             dispose: () => {
               video.pause();
               video.src = '';
               videoTexture.dispose();
             }
           };
        }
      }

      // Standard Image Loading
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
      return null;
    } catch (error) {
      console.warn('[Background] Image load failed, using color fallback');
    }
  }
  
  // Fallback to solid color
  scene.background = new THREE.Color(definition.color);
  console.log('[Background] Applied color:', definition.color);
  return null;
}

export const backgroundOptions = backgroundDefinitions;
