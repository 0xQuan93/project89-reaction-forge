import { useAvatarSource } from '../state/useAvatarSource';
import { avatarController, type GestureType, type EmotionState } from '../ai/AvatarController';
import { sceneManager } from '../three/sceneManager';

export type AvatarBridge = {
  setAvatarUrl: (url: string, label?: string) => void;
  setAvatarFile: (file: File) => void;
  resetAvatar: () => void;
  control: {
    speak: (text: string, audioUrl?: string) => void;
    emote: (emotion: string, duration?: number) => void;
    gesture: (name: string, intensity?: number) => void;
    setBackground: (id: string) => void;
  };
};

const ensureBridge = (): AvatarBridge => {
  const state = useAvatarSource.getState();
  return {
    setAvatarUrl: (url, label) => state.setRemoteUrl(url, label),
    setAvatarFile: (file) => state.setFileSource(file),
    resetAvatar: () => state.reset(),
    control: {
      speak: (text, _audioUrl) => {
        // Basic TTS fallback for now
        // TODO: Integrate with LipSyncPlayer when audioUrl is provided
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
      },
      emote: (emotion, duration) => {
        avatarController.setEmotion(emotion as EmotionState, duration);
      },
      gesture: (name, intensity) => {
        avatarController.performGesture(name as GestureType, intensity);
      },
      setBackground: (id) => {
        sceneManager.setBackground(id);
      }
    }
  };
};

export function setupAvatarBridge() {
  if (typeof window === 'undefined') return;
  window.project89Reactor = ensureBridge();
}
