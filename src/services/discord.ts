export type DiscordProfile = {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar?: string | null;
};

export const DISCORD_SCOPES = [
  'identify',
  'guilds',
  'guilds.members.read',
  'connections',
  'rpc',
  'rpc.voice.read',
  'rpc.voice.write',
];

const DISCORD_TOKEN_KEY = 'poseLab.discord.token';
const DISCORD_PROFILE_KEY = 'poseLab.discord.profile';

export const getDiscordClientId = () => import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

export const getDiscordRedirectUri = () => {
  const configuredRedirect = import.meta.env.VITE_DISCORD_REDIRECT_URI as string | undefined;
  if (configuredRedirect) {
    return configuredRedirect;
  }

  return window.location.origin + window.location.pathname;
};

export const buildDiscordOAuthUrl = () => {
  const clientId = getDiscordClientId();
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getDiscordRedirectUri(),
    response_type: 'token',
    scope: DISCORD_SCOPES.join(' '),
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
};

export const parseDiscordOAuthHash = (hash: string) => {
  if (!hash || !hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get('access_token');
  const tokenType = params.get('token_type');
  const expiresIn = params.get('expires_in');

  if (!accessToken || !tokenType) return null;

  return {
    accessToken,
    tokenType,
    expiresIn: expiresIn ? Number(expiresIn) : null,
  };
};

export const saveDiscordSession = (token: string, profile: DiscordProfile | null) => {
  sessionStorage.setItem(DISCORD_TOKEN_KEY, token);
  if (profile) {
    sessionStorage.setItem(DISCORD_PROFILE_KEY, JSON.stringify(profile));
  }
};

export const loadDiscordSession = () => {
  const token = sessionStorage.getItem(DISCORD_TOKEN_KEY);
  if (!token) return null;

  const profileRaw = sessionStorage.getItem(DISCORD_PROFILE_KEY);
  const profile = profileRaw ? (JSON.parse(profileRaw) as DiscordProfile) : null;

  return { token, profile };
};

export const clearDiscordSession = () => {
  sessionStorage.removeItem(DISCORD_TOKEN_KEY);
  sessionStorage.removeItem(DISCORD_PROFILE_KEY);
};

export const fetchDiscordProfile = async (accessToken: string) => {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Discord profile');
  }

  return (await response.json()) as DiscordProfile;
};

export const getDiscordAvatarUrl = (profile: DiscordProfile) => {
  if (profile.avatar) {
    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
  }

  const discriminator = profile.discriminator ?? '0';
  const index = Number(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
};
