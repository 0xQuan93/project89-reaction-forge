import { useAvatarSource } from '../state/useAvatarSource';
import { setupWSBridge, type WSBridge } from './wsBridge';

export type AvatarBridge = {
  setAvatarUrl: (url: string, label?: string) => void;
  setAvatarFile: (file: File) => void;
  resetAvatar: () => void;
  wsBridge?: WSBridge | null;
};

const ensureBridge = (): AvatarBridge => {
  const state = useAvatarSource.getState();
  return {
    setAvatarUrl: (url, label) => state.setRemoteUrl(url, label),
    setAvatarFile: (file) => state.setFileSource(file),
    resetAvatar: () => state.reset(),
  };
};

export function setupAvatarBridge() {
  if (typeof window === 'undefined') return;
  const bridge = ensureBridge();
  // Auto-connect WS bridge when ?ws= param is present (no-op otherwise)
  bridge.wsBridge = setupWSBridge();
  window.project89Reactor = bridge;
}

