import PubNub from 'pubnub';
import { useLobbyStore } from '../state/useLobbyStore';
import { useMultiplayerStore } from '../state/useMultiplayerStore';

// ⚠️ REPLACE WITH YOUR FREE KEYS FROM PUBNUB.COM
// These are demo keys that may have rate limits or not work for production
const PUBNUB_CONFIG = {
  publishKey: 'pub-c-4d5c8797-1518-498c-851f-63234857034c', // Demo key
  subscribeKey: 'sub-c-13426720-3333-11eb-92c4-82500057053a', // Demo key
  uuid: 'user-' + Math.random().toString(36).substr(2, 9)
};

const GLOBAL_CHANNEL = 'poselab-global-lobby';

class LobbyManager {
  private pubnub: PubNub | null = null;
  private isInitialized = false;

  init() {
    if (this.isInitialized) return;

    // Check for demo keys to avoid 400 Bad Request spam
    if (PUBNUB_CONFIG.publishKey.startsWith('pub-c-4d5c')) {
      console.warn('[LobbyManager] Using demo keys - Lobby features disabled to prevent errors.');
      console.warn('[LobbyManager] Please replace PUBNUB_CONFIG in LobbyManager.ts with your own keys.');
      return;
    }

    try {
      this.pubnub = new PubNub(PUBNUB_CONFIG);
      
      // Subscribe to global channel
      this.pubnub.subscribe({
        channels: [GLOBAL_CHANNEL],
        withPresence: true,
      });

      // Listeners
      this.pubnub.addListener({
        status: (statusEvent: any) => {
          if (statusEvent.category === "PNConnectedCategory") {
             console.log('[LobbyManager] Connected to global lobby');
             this.updatePresence();
          }
        },
        message: (event: any) => {
          if (!event.message) return;
          
          useLobbyStore.getState().addMessage({
            id: event.timetoken,
            sender: event.message.sender || 'Anonymous',
            text: event.message.text || '',
            timestamp: Date.now()
          });
        },
        presence: (event: any) => {
          // Update count on join/leave/timeout
          if (['join', 'leave', 'timeout'].includes(event.action)) {
            this.updatePresence();
          }
        }
      });
      
      this.isInitialized = true;
    } catch (err) {
      console.warn('[LobbyManager] Failed to initialize PubNub (check keys):', err);
    }
  }

  // Fetch live count
  private updatePresence() {
    if (!this.pubnub) return;
    
    this.pubnub.hereNow({
      channels: [GLOBAL_CHANNEL],
      includeUUIDs: false,
      includeState: false
    }, (status: any, response: any) => {
      if (status.error || !response) return;
      
      const channelData = response.channels[GLOBAL_CHANNEL];
      if (channelData) {
        const count = channelData.occupancy;
        useLobbyStore.getState().setOnlineCount(count);
      }
    });
  }

  sendMessage(text: string) {
    if (!this.pubnub || !text.trim()) return;
    
    const { localDisplayName } = useMultiplayerStore.getState();
    const name = localDisplayName || 'User ' + PUBNUB_CONFIG.uuid.slice(-4);
    
    this.pubnub.publish({
      channel: GLOBAL_CHANNEL,
      message: {
        sender: name,
        text: text.trim()
      }
    }, (status: any) => {
      if (status.error) {
        console.warn('[LobbyManager] Failed to send message:', status);
      }
    });
  }
  
  disconnect() {
    if (this.pubnub) {
      this.pubnub.unsubscribeAll();
      this.pubnub = null;
      this.isInitialized = false;
    }
  }
}

export const lobbyManager = new LobbyManager();

