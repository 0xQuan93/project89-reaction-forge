import { create } from 'zustand';
import {
  buildDiscordOAuthUrl,
  clearDiscordSession,
  fetchDiscordProfile,
  getDiscordClientId,
  loadDiscordSession,
  parseDiscordOAuthHash,
  saveDiscordSession,
  type DiscordProfile,
} from '../services/discord';

export type DiscordConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type DiscordConnectionType = 'oauth' | null;

interface DiscordState {
  status: DiscordConnectionStatus;
  connectionType: DiscordConnectionType;
  accessToken: string | null;
  profile: DiscordProfile | null;
  lastError: string | null;
  hydrate: () => void;
  connect: () => void;
  disconnect: () => void;
  completeOAuth: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useDiscordStore = create<DiscordState>((set, get) => ({
  status: 'disconnected',
  connectionType: null,
  accessToken: null,
  profile: null,
  lastError: null,
  hydrate: () => {
    const session = loadDiscordSession();
    if (!session) return;
    set({
      status: 'connected',
      connectionType: 'oauth',
      accessToken: session.token,
      profile: session.profile,
      lastError: null,
    });
  },
  connect: () => {
    const clientId = getDiscordClientId();
    if (!clientId) {
      set({
        lastError: 'Missing VITE_DISCORD_CLIENT_ID in environment.',
        status: 'error',
      });
      return;
    }

    const url = buildDiscordOAuthUrl();
    if (!url) {
      set({ lastError: 'Unable to build Discord OAuth URL.', status: 'error' });
      return;
    }

    set({ status: 'connecting', lastError: null });
    window.location.assign(url);
  },
  disconnect: () => {
    clearDiscordSession();
    set({
      status: 'disconnected',
      connectionType: null,
      accessToken: null,
      profile: null,
      lastError: null,
    });
  },
  completeOAuth: async () => {
    const hash = parseDiscordOAuthHash(window.location.hash);
    if (!hash) return;

    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

    set({ status: 'connecting', lastError: null });

    try {
      const profile = await fetchDiscordProfile(hash.accessToken);
      saveDiscordSession(hash.accessToken, profile);
      set({
        status: 'connected',
        connectionType: 'oauth',
        accessToken: hash.accessToken,
        profile,
        lastError: null,
      });
    } catch (error) {
      set({
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Failed to connect to Discord.',
      });
    }
  },
  refreshProfile: async () => {
    const { accessToken } = get();
    if (!accessToken) return;

    set({ status: 'connecting', lastError: null });
    try {
      const profile = await fetchDiscordProfile(accessToken);
      saveDiscordSession(accessToken, profile);
      set({ status: 'connected', profile, lastError: null });
    } catch (error) {
      set({
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Failed to refresh Discord profile.',
      });
    }
  },
}));
