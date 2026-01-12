import { DiscordSDK } from '@discord/embedded-app-sdk';
import { getDiscordClientId } from './discord';

let sdkInstance: DiscordSDK | null = null;

export const canUseDiscordSdk = () => {
  if (import.meta.env.VITE_DISCORD_FORCE_SDK === 'true') {
    return true;
  }

  const host = window.location.hostname;
  const embeddedHost = host.includes('discord.com') || host.includes('discordapp.com');
  const nativeBridge = Boolean((window as Window & { DiscordNative?: unknown }).DiscordNative);
  return embeddedHost || nativeBridge;
};

export const getDiscordSdk = async () => {
  if (sdkInstance) return sdkInstance;
  const clientId = getDiscordClientId();
  if (!clientId) {
    throw new Error('Missing VITE_DISCORD_CLIENT_ID in environment.');
  }
  sdkInstance = new DiscordSDK(clientId);
  await sdkInstance.ready();
  return sdkInstance;
};

const trySdkCommand = async (action: (sdk: DiscordSDK) => Promise<void>) => {
  if (!canUseDiscordSdk()) return false;
  try {
    const sdk = await getDiscordSdk();
    await action(sdk);
    return true;
  } catch (error) {
    console.warn('[DiscordSDK] Command failed', error);
    return false;
  }
};

export const openDiscordLink = async (url: string) => {
  return trySdkCommand(async (sdk) => {
    await sdk.commands.openExternalLink({ url });
  });
};

export const setDiscordActivity = async (state: string, details: string) => {
  return trySdkCommand(async (sdk) => {
    await sdk.commands.setActivity({
      state,
      details,
      timestamps: { start: Date.now() },
    } as unknown as Parameters<typeof sdk.commands.setActivity>[0]);
  });
};
