import { useAvatarSource } from '../state/useAvatarSource';

export type AvatarBridge = {
  setAvatarUrl: (url: string, label?: string) => void;
  setAvatarFile: (file: File) => void;
  resetAvatar: () => void;
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
  window.project89Reactor = ensureBridge();
}

