import { useEffect, useMemo, useState } from 'react';
import {
  getDiscordAvatarUrl,
  getDiscordClientId,
  type DiscordProfile,
} from '../../services/discord';
import { canUseDiscordSdk, openDiscordLink, setDiscordActivity } from '../../services/discordSdk';
import { useDiscordStore } from '../../state/useDiscordStore';
import { useMultiplayerStore } from '../../state/useMultiplayerStore';
import { useToastStore } from '../../state/useToastStore';
import {
  DiscordLogo,
  MonitorPlay,
  VideoCamera,
  ChatsCircle,
  Trophy,
  Broadcast,
  ShieldCheck,
} from '@phosphor-icons/react';

const OBS_PROFILES = ['VTuber Live', 'Community Call', 'Scene Capture', 'Green Screen'];

const getDisplayName = (profile: DiscordProfile | null) => {
  if (!profile) return 'Not connected';
  return profile.global_name || profile.username;
};

export function DiscordTab() {
  const hydrate = useDiscordStore((state) => state.hydrate);
  const completeOAuth = useDiscordStore((state) => state.completeOAuth);
  const connect = useDiscordStore((state) => state.connect);
  const disconnect = useDiscordStore((state) => state.disconnect);
  const refreshProfile = useDiscordStore((state) => state.refreshProfile);
  const { status, profile, lastError, connectionType } = useDiscordStore((state) => ({
    status: state.status,
    profile: state.profile,
    lastError: state.lastError,
    connectionType: state.connectionType,
  }));
  const { isConnected, roomId, role, peers } = useMultiplayerStore((state) => ({
    isConnected: state.isConnected,
    roomId: state.roomId,
    role: state.role,
    peers: state.peers,
  }));
  const { addToast } = useToastStore();
  const [selectedObsProfile, setSelectedObsProfile] = useState(OBS_PROFILES[0]);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    hydrate();
    void completeOAuth();
  }, [hydrate, completeOAuth]);

  useEffect(() => {
    setSdkReady(canUseDiscordSdk());
  }, []);

  const isConfigured = Boolean(getDiscordClientId());
  const connectionLabel = useMemo(() => {
    if (status === 'connecting') return 'Connecting…';
    if (status === 'connected') return 'Connected';
    if (status === 'error') return 'Needs attention';
    return 'Disconnected';
  }, [status]);

  const multiplayerStatus = useMemo(() => {
    if (!isConnected) {
      return { label: 'Not in session', details: 'Multiplayer offline' };
    }
    const participants = peers.size + 1;
    const roomLabel = roomId ? `Room ${roomId}` : 'Private room';
    const roleLabel = role ? `${role} role` : 'Role pending';
    return {
      label: `${participants} participant${participants === 1 ? '' : 's'}`,
      details: `${roomLabel} • ${roleLabel}`,
    };
  }, [isConnected, peers, roomId, role]);

  const handleVirtualCam = () => {
    addToast(`OBS Virtual Camera requested for profile: ${selectedObsProfile}`, 'info');
  };

  const handleOpenDiscordDMs = async () => {
    const opened = await openDiscordLink('https://discord.com/channels/@me');
    if (!opened) {
      window.open('https://discord.com/channels/@me', '_blank', 'noopener,noreferrer');
    }
  };

  const handleStartCall = async () => {
    const opened = await openDiscordLink('https://discord.com/channels/@me');
    if (!opened) {
      addToast('Open a voice/video call in Discord to keep Pose Lab running alongside.', 'info');
      return;
    }
    addToast('Discord is opening your voice/video call view.', 'success');
  };

  const handleEnableStreaming = async () => {
    const updated = await setDiscordActivity(
      'Streaming with Pose Lab',
      `OBS Profile: ${selectedObsProfile}${isConnected ? ` • ${multiplayerStatus.label}` : ''}`,
    );
    if (!updated) {
      addToast('Streaming tools are ready once Discord and OBS are connected.', 'success');
      return;
    }
    addToast('Discord activity updated for streaming.', 'success');
  };

  const handleShareMultiplayer = async () => {
    if (!isConnected) {
      addToast('Join a multiplayer session to share activity.', 'info');
      return;
    }
    const updated = await setDiscordActivity('Pose Lab Multiplayer', multiplayerStatus.details);
    if (!updated) {
      addToast('Discord SDK is required to share multiplayer activity.', 'warning');
      return;
    }
    addToast('Discord activity updated for multiplayer session.', 'success');
  };

  const handleSyncBadges = () => {
    addToast('Syncing Discord roles and achievements…', 'info');
    void refreshProfile();
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Discord Connection</h3>
        <div className="discord-card">
          <div className="discord-card__header">
            <div className="discord-card__identity">
              {profile ? (
                <img
                  className="discord-avatar"
                  src={getDiscordAvatarUrl(profile)}
                  alt={profile.username}
                />
              ) : (
                <div className="discord-avatar discord-avatar--placeholder">
                  <DiscordLogo size={24} weight="duotone" />
                </div>
              )}
              <div>
                <p className="discord-title">{getDisplayName(profile)}</p>
                <p className="muted small">Status: {connectionLabel}</p>
              </div>
            </div>
            <span className={`discord-status discord-status--${status}`}>{connectionLabel}</span>
          </div>

          {lastError && <p className="discord-error">{lastError}</p>}

          <p className="muted">
            Pose Lab uses Discord as the source of truth for identity, social features, and progression—no local
            database required.
          </p>
          <p className="muted small">
            SDK status: {sdkReady ? 'Available for embedded Discord clients.' : 'OAuth fallback for web/desktop.'}
          </p>
          {connectionType && <p className="muted small">Connected via: OAuth</p>}

          <div className="discord-actions">
            <button
              className="discord-button primary"
              onClick={connect}
              disabled={!isConfigured || status === 'connecting'}
            >
              Connect Discord
            </button>
            <button
              className="discord-button"
              onClick={disconnect}
              disabled={status !== 'connected'}
            >
              Disconnect
            </button>
            <button
              className="discord-button"
              onClick={() => void refreshProfile()}
              disabled={status !== 'connected'}
            >
              Refresh Profile
            </button>
          </div>

          {!isConfigured && (
            <p className="muted small">
              Add <code>VITE_DISCORD_CLIENT_ID</code> to enable OAuth.
            </p>
          )}
        </div>
      </div>

      <div className="tab-section">
        <h3>Streaming + VTubing</h3>
        <div className="discord-card">
          <div className="discord-card__row">
            <label className="discord-label" htmlFor="obs-profile">
              OBS Profile
            </label>
            <select
              id="obs-profile"
              value={selectedObsProfile}
              onChange={(event) => setSelectedObsProfile(event.target.value)}
            >
              {OBS_PROFILES.map((profileName) => (
                <option key={profileName} value={profileName}>
                  {profileName}
                </option>
              ))}
            </select>
          </div>
          <div className="discord-actions">
            <button className="discord-button" onClick={handleVirtualCam}>
              <MonitorPlay size={16} weight="duotone" />
              Enable Virtual Cam
            </button>
            <button className="discord-button" onClick={handleEnableStreaming}>
              <Broadcast size={16} weight="duotone" />
              Start Stream Tools
            </button>
            <button className="discord-button" onClick={handleShareMultiplayer}>
              <Broadcast size={16} weight="duotone" />
              Share Multiplayer Status
            </button>
          </div>
          <p className="muted small">
            OBS profiles and virtual camera routing stay in-app. Discord picks up the virtual cam as your video
            source.
          </p>
          <p className="muted small">
            Multiplayer: {multiplayerStatus.label} ({multiplayerStatus.details})
          </p>
        </div>
      </div>

      <div className="tab-section">
        <h3>Voice, Video, Messaging</h3>
        <div className="discord-grid">
          <div className="discord-card">
            <div className="discord-card__row">
              <VideoCamera size={20} weight="duotone" />
              <div>
                <p className="discord-title">Voice + Video Rooms</p>
                <p className="muted small">Join Discord calls while keeping Pose Lab visible.</p>
              </div>
            </div>
            <button className="discord-button" onClick={handleStartCall}>
              Start Voice/Video Session
            </button>
          </div>
          <div className="discord-card">
            <div className="discord-card__row">
              <ChatsCircle size={20} weight="duotone" />
              <div>
                <p className="discord-title">Messaging</p>
                <p className="muted small">Open your DMs or guild chats in Discord.</p>
              </div>
            </div>
            <button className="discord-button" onClick={handleOpenDiscordDMs}>
              Open Discord Messages
            </button>
          </div>
        </div>
      </div>

      <div className="tab-section">
        <h3>Badges + Progression</h3>
        <div className="discord-card">
          <div className="discord-card__row">
            <Trophy size={20} weight="duotone" />
            <div>
              <p className="discord-title">Discord-Synced Achievements</p>
              <p className="muted small">Roles, boosts, and activity status drive your Pose Lab progression.</p>
            </div>
          </div>

          <div className="discord-progress">
            <div>
              <p className="discord-title">Creator Level</p>
              <div className="discord-progress__bar">
                <span style={{ width: profile ? '65%' : '20%' }} />
              </div>
              <p className="muted small">{profile ? 'Level 3 of 5 synced from Discord roles.' : 'Connect to sync your progress.'}</p>
            </div>
            <div>
              <p className="discord-title">Community Badges</p>
              <div className="discord-pill-list">
                <span className="discord-pill">Streamer</span>
                <span className="discord-pill">Event Host</span>
                <span className="discord-pill">Early Access</span>
              </div>
            </div>
          </div>

          <button className="discord-button" onClick={handleSyncBadges}>
            <ShieldCheck size={16} weight="duotone" />
            Sync Roles + Badges
          </button>
        </div>
      </div>
    </div>
  );
}
