import { create } from 'zustand';

export const DEFAULT_VRM_URL = '/vrm/HarmonVox_519.vrm';

export type AvatarSourceKind = 'none' | 'vrm' | 'live2d';

export type Live2DAsset = {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
};

export type Live2DSource = {
  manifestUrl: string;
  manifestPath: string;
  assets: Live2DAsset[];
};

type AvatarSourceState = {
  avatarType: AvatarSourceKind;
  currentUrl: string | null;
  sourceLabel: string;
  /** Original file data for VRM transfer in multiplayer */
  vrmArrayBuffer: ArrayBuffer | null;
  live2dSource: Live2DSource | null;
  setRemoteUrl: (url: string, label?: string) => void;
  setFileSource: (file: File) => void;
  setLive2dSource: (files: File[], label?: string) => Promise<void>;
  reset: () => void;
};

let objectUrlHandle: string | null = null;
let live2dObjectUrls: string[] = [];

const revokeObjectUrl = () => {
  if (objectUrlHandle) {
    URL.revokeObjectURL(objectUrlHandle);
    objectUrlHandle = null;
  }
};

const revokeLive2dObjectUrls = () => {
  live2dObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  live2dObjectUrls = [];
};

const getMimeType = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.moc3')) return 'application/octet-stream';
  return 'application/octet-stream';
};

const getBasename = (value: string) => value.split('/').pop() ?? value;

const replacePathsInManifest = (value: unknown, map: Record<string, string>): unknown => {
  if (typeof value === 'string') {
    const direct = map[value];
    if (direct) return direct;
    const base = map[getBasename(value)];
    return base ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => replacePathsInManifest(entry, map));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        replacePathsInManifest(entry, map),
      ])
    );
  }

  return value;
};

export const useAvatarSource = create<AvatarSourceState>((set) => ({
  avatarType: 'none',
  currentUrl: null, // Start with no avatar
  sourceLabel: 'No avatar loaded',
  vrmArrayBuffer: null,
  live2dSource: null,
  setRemoteUrl: (url, label = 'Remote VRM') => {
    revokeObjectUrl();
    revokeLive2dObjectUrls();
    // For remote URLs, fetch and store the ArrayBuffer
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(buffer => {
        set({ vrmArrayBuffer: buffer });
      })
      .catch(err => console.warn('[useAvatarSource] Failed to fetch VRM buffer:', err));
    
    set({
      avatarType: 'vrm',
      currentUrl: url,
      sourceLabel: label,
      live2dSource: null,
    });
  },
  setFileSource: (file) => {
    revokeObjectUrl();
    revokeLive2dObjectUrls();
    objectUrlHandle = URL.createObjectURL(file);
    
    // Read and store the ArrayBuffer for multiplayer transfer
    file.arrayBuffer()
      .then(buffer => {
        set({ vrmArrayBuffer: buffer });
      })
      .catch(err => console.warn('[useAvatarSource] Failed to read VRM buffer:', err));
    
    set({
      avatarType: 'vrm',
      currentUrl: objectUrlHandle,
      sourceLabel: file.name || 'Local VRM',
      live2dSource: null,
    });
  },
  setLive2dSource: async (files, label = 'Live2D Avatar') => {
    revokeObjectUrl();
    revokeLive2dObjectUrls();

    const manifestFile = files.find((file) => file.name.toLowerCase().endsWith('.model3.json'));
    if (!manifestFile) {
      throw new Error('Live2D manifest (.model3.json) not found.');
    }

    const assetFiles = files.filter((file) => file !== manifestFile);
    const assetUrlMap: Record<string, string> = {};

    assetFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      live2dObjectUrls.push(url);
      assetUrlMap[file.name] = url;
    });

    const manifestText = await manifestFile.text();
    const manifestJson = JSON.parse(manifestText) as Record<string, unknown>;
    const patchedManifest = replacePathsInManifest(manifestJson, assetUrlMap);
    const manifestBlob = new Blob([JSON.stringify(patchedManifest, null, 2)], {
      type: getMimeType(manifestFile.name),
    });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    live2dObjectUrls.push(manifestUrl);

    const assets = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        mimeType: getMimeType(file.name),
        buffer: await file.arrayBuffer(),
      }))
    );

    set({
      avatarType: 'live2d',
      currentUrl: null,
      sourceLabel: label,
      vrmArrayBuffer: null,
      live2dSource: {
        manifestUrl,
        manifestPath: manifestFile.name,
        assets,
      },
    });
  },
  reset: () => {
    revokeObjectUrl();
    revokeLive2dObjectUrls();
    set({
      avatarType: 'none',
      currentUrl: null,
      sourceLabel: 'No avatar loaded',
      vrmArrayBuffer: null,
      live2dSource: null,
    });
  },
}));
