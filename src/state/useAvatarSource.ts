import { create } from 'zustand';

export const DEFAULT_VRM_URL = '/vrm/HarmonVox_519.vrm';

type AvatarSourceState = {
  currentUrl: string | null;
  sourceLabel: string;
  setRemoteUrl: (url: string, label?: string) => void;
  setFileSource: (file: File) => void;
  reset: () => void;
};

let objectUrlHandle: string | null = null;

const revokeObjectUrl = () => {
  if (objectUrlHandle) {
    URL.revokeObjectURL(objectUrlHandle);
    objectUrlHandle = null;
  }
};

export const useAvatarSource = create<AvatarSourceState>((set) => ({
  currentUrl: null, // Start with no avatar
  sourceLabel: 'No avatar loaded',
  setRemoteUrl: (url, label = 'Remote VRM') => {
    revokeObjectUrl();
    set({
      currentUrl: url,
      sourceLabel: label,
    });
  },
  setFileSource: (file) => {
    revokeObjectUrl();
    objectUrlHandle = URL.createObjectURL(file);
    set({
      currentUrl: objectUrlHandle,
      sourceLabel: file.name || 'Local VRM',
    });
  },
  reset: () => {
    revokeObjectUrl();
    set({
      currentUrl: null,
      sourceLabel: 'No avatar loaded',
    });
  },
}));

