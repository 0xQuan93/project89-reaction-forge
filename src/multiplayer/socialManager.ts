/**
 * SocialManager - Handles social features in multiplayer sessions
 * 
 * Features:
 * - In-session text chat
 * - Avatar reactions/emotes
 * - Presence indicators
 * - Synchronized group photo capture
 */

import type { 
  PeerId, 
  PeerMessage, 
  ChatMessage, 
  ReactionMessage, 
  ReactionType,
  PresenceMessage,
  PresenceState,
  GroupPhotoMessage,
  CountdownMessage,
} from '../types/multiplayer';
import { peerManager } from './peerManager';
import { useMultiplayerStore } from '../state/useMultiplayerStore';
import { sceneManager } from '../three/sceneManager';
import { avatarController } from '../ai/AvatarController';

/** Chat message for display */
export interface DisplayChatMessage {
  id: string;
  peerId: PeerId;
  displayName: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

/** Reaction for display */
export interface DisplayReaction {
  id: string;
  peerId: PeerId;
  displayName: string;
  reaction: ReactionType;
  timestamp: number;
}

type ChatListener = (message: DisplayChatMessage) => void;
type ReactionListener = (reaction: DisplayReaction) => void;
type PresenceListener = (peerId: PeerId, state: PresenceState) => void;
type CountdownListener = (count: number, photoId: string) => void;
type PhotoCapturedListener = (photoId: string, dataUrl: string) => void;

/** Maps reactions to avatar gestures */
const REACTION_TO_GESTURE: Record<ReactionType, string> = {
  wave: 'wave',
  thumbsUp: 'thumbsUp',
  nod: 'nod',
  celebrate: 'celebrate',
};

/** Maps reactions to expressions */
const REACTION_TO_EXPRESSION: Record<ReactionType, string> = {
  wave: 'happy',
  thumbsUp: 'happy',
  nod: 'happy',
  celebrate: 'happy',
};

class SocialManager {
  private chatListeners = new Set<ChatListener>();
  private reactionListeners = new Set<ReactionListener>();
  private presenceListeners = new Set<PresenceListener>();
  private countdownListeners = new Set<CountdownListener>();
  private photoCapturedListeners = new Set<PhotoCapturedListener>();
  
  private chatHistory: DisplayChatMessage[] = [];
  private recentReactions: DisplayReaction[] = [];
  private isInitialized = false;
  
  // Group photo state
  private _pendingPhotoId: string | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  
  /** Check if a group photo is in progress */
  get isPhotoInProgress(): boolean {
    return this._pendingPhotoId !== null;
  }
  
  // Presence state
  private localPresence: PresenceState = 'active';
  private afkTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly AFK_TIMEOUT = 60000; // 1 minute of inactivity

  /**
   * Initialize the social manager
   */
  initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[SocialManager] Initializing');

    // Listen for peer messages
    peerManager.onMessage((peerId, message) => {
      this.handleMessage(peerId, message);
    });

    // Track user activity for AFK detection
    this.setupActivityTracking();
  }

  /**
   * Stop the social manager
   */
  stop() {
    this.isInitialized = false;
    this.chatHistory = [];
    this.recentReactions = [];
    this._pendingPhotoId = null;
    
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    
    if (this.afkTimeout) {
      clearTimeout(this.afkTimeout);
      this.afkTimeout = null;
    }

    console.log('[SocialManager] Stopped');
  }

  // ==================
  // Chat
  // ==================

  /**
   * Send a chat message to all peers
   */
  sendChat(text: string) {
    const store = useMultiplayerStore.getState();
    if (!store.localPeerId || !text.trim()) return;

    const message: ChatMessage = {
      type: 'chat',
      peerId: store.localPeerId,
      displayName: store.localDisplayName || 'Anonymous',
      text: text.trim(),
      timestamp: Date.now(),
    };

    // Broadcast to all peers
    peerManager.broadcast(message);

    // Add to local history
    const displayMessage: DisplayChatMessage = {
      id: `${message.peerId}-${message.timestamp}`,
      peerId: message.peerId,
      displayName: message.displayName,
      text: message.text,
      timestamp: message.timestamp,
      isLocal: true,
    };

    this.chatHistory.push(displayMessage);
    this.notifyChatListeners(displayMessage);

    // Reset AFK
    this.resetAFK();
  }

  /**
   * Get chat history
   */
  getChatHistory(): DisplayChatMessage[] {
    return [...this.chatHistory];
  }

  /**
   * Clear chat history
   */
  clearChatHistory() {
    this.chatHistory = [];
  }

  /**
   * Listen for chat messages
   */
  onChat(listener: ChatListener): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  // ==================
  // Reactions
  // ==================

  /**
   * Send a reaction (triggers avatar animation for all peers)
   */
  sendReaction(reaction: ReactionType) {
    const store = useMultiplayerStore.getState();
    if (!store.localPeerId) return;

    const message: ReactionMessage = {
      type: 'reaction',
      peerId: store.localPeerId,
      displayName: store.localDisplayName || 'Anonymous',
      reaction,
      timestamp: Date.now(),
    };

    // Broadcast to all peers
    peerManager.broadcast(message);

    // Trigger local avatar animation
    this.triggerReactionAnimation(reaction);

    // Add to recent reactions
    const displayReaction: DisplayReaction = {
      id: `${message.peerId}-${message.timestamp}`,
      peerId: message.peerId,
      displayName: message.displayName,
      reaction,
      timestamp: message.timestamp,
    };

    this.recentReactions.push(displayReaction);
    this.notifyReactionListeners(displayReaction);

    // Clean up old reactions (keep last 20)
    if (this.recentReactions.length > 20) {
      this.recentReactions = this.recentReactions.slice(-20);
    }

    // Reset AFK
    this.resetAFK();
  }

  /**
   * Get reaction emoji
   */
  static getReactionEmoji(reaction: ReactionType): string {
    const emojis: Record<ReactionType, string> = {
      wave: '👋',
      thumbsUp: '👍',
      nod: ' nodding_head::skin-tone-3',
      celebrate: '🎉',
    };
    return emojis[reaction] || '✨';
  }

  /**
   * Listen for reactions
   */
  onReaction(listener: ReactionListener): () => void {
    this.reactionListeners.add(listener);
    return () => this.reactionListeners.delete(listener);
  }

  // ==================
  // Presence
  // ==================

  /**
   * Set local presence state
   */
  setPresence(state: PresenceState) {
    if (this.localPresence === state) return;
    
    this.localPresence = state;
    this.broadcastPresence(state);
  }

  /**
   * Get local presence
   */
  getPresence(): PresenceState {
    return this.localPresence;
  }

  /**
   * Listen for presence changes
   */
  onPresence(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  /**
   * Notify typing state (call when user is typing in chat)
   */
  notifyTyping(isTyping: boolean) {
    this.setPresence(isTyping ? 'typing' : 'active');
  }

  // ==================
  // Group Photo
  // ==================

  /**
   * Request a group photo (starts countdown for all peers)
   */
  requestGroupPhoto() {
    const store = useMultiplayerStore.getState();
    if (!store.localPeerId) return;

    const photoId = `photo-${Date.now()}`;
    this._pendingPhotoId = photoId;

    const message: GroupPhotoMessage = {
      type: 'group-photo',
      peerId: store.localPeerId,
      action: 'request',
      photoId,
      timestamp: Date.now(),
    };

    // Broadcast to all peers
    peerManager.broadcast(message);

    // Start countdown locally
    this.startCountdown(photoId);
  }

  /**
   * Listen for countdown updates
   */
  onCountdown(listener: CountdownListener): () => void {
    this.countdownListeners.add(listener);
    return () => this.countdownListeners.delete(listener);
  }

  /**
   * Listen for photo captured
   */
  onPhotoCaptured(listener: PhotoCapturedListener): () => void {
    this.photoCapturedListeners.add(listener);
    return () => this.photoCapturedListeners.delete(listener);
  }

  // ==================
  // Internal
  // ==================

  private handleMessage(peerId: PeerId, message: PeerMessage) {
    const store = useMultiplayerStore.getState();

    switch (message.type) {
      case 'chat':
        this.handleChatMessage(peerId, message as ChatMessage);
        break;

      case 'reaction':
        this.handleReactionMessage(peerId, message as ReactionMessage);
        break;

      case 'presence':
        this.handlePresenceMessage(peerId, message as PresenceMessage);
        break;

      case 'group-photo':
        this.handleGroupPhotoMessage(peerId, message as GroupPhotoMessage);
        break;

      case 'countdown':
        this.handleCountdownMessage(message as CountdownMessage);
        break;
    }

    // Update peer last activity
    store.updatePeer(peerId, { lastActivity: Date.now() });
  }

  private handleChatMessage(peerId: PeerId, message: ChatMessage) {
    const displayMessage: DisplayChatMessage = {
      id: `${peerId}-${message.timestamp}`,
      peerId,
      displayName: message.displayName,
      text: message.text,
      timestamp: message.timestamp,
      isLocal: false,
    };

    this.chatHistory.push(displayMessage);
    this.notifyChatListeners(displayMessage);
  }

  private handleReactionMessage(peerId: PeerId, message: ReactionMessage) {
    const displayReaction: DisplayReaction = {
      id: `${peerId}-${message.timestamp}`,
      peerId,
      displayName: message.displayName,
      reaction: message.reaction,
      timestamp: message.timestamp,
    };

    this.recentReactions.push(displayReaction);
    this.notifyReactionListeners(displayReaction);

    // Trigger animation on the remote avatar
    // Note: multiAvatarManager would handle this if we implement per-avatar reactions
    // For now, we just show the reaction UI
  }

  private handlePresenceMessage(peerId: PeerId, message: PresenceMessage) {
    const store = useMultiplayerStore.getState();
    store.updatePeer(peerId, { presence: message.state });
    this.notifyPresenceListeners(peerId, message.state);
  }

  private handleGroupPhotoMessage(_peerId: PeerId, message: GroupPhotoMessage) {
    switch (message.action) {
      case 'request':
        // Someone requested a group photo - start our countdown
        this._pendingPhotoId = message.photoId;
        this.startCountdown(message.photoId);
        break;

      case 'capture':
        // Time to capture!
        this.captureGroupPhoto(message.photoId);
        break;

      case 'complete':
        // Photo captured by someone else
        this._pendingPhotoId = null;
        break;
    }
  }

  private handleCountdownMessage(message: CountdownMessage) {
    this.notifyCountdownListeners(message.count, message.photoId);
    
    if (message.count === 0) {
      this.captureGroupPhoto(message.photoId);
    }
  }

  private triggerReactionAnimation(reaction: ReactionType) {
    const gesture = REACTION_TO_GESTURE[reaction];
    const expression = REACTION_TO_EXPRESSION[reaction];

    if (gesture && avatarController) {
      try {
        avatarController.performGesture(gesture as any);
      } catch (e) {
        console.warn('[SocialManager] Could not trigger gesture:', e);
      }
    }

    if (expression && avatarController) {
      try {
        avatarController.setEmotion(expression as any);
      } catch (e) {
        console.warn('[SocialManager] Could not set expression:', e);
      }
    }
  }

  private broadcastPresence(state: PresenceState) {
    const store = useMultiplayerStore.getState();
    if (!store.localPeerId) return;

    const message: PresenceMessage = {
      type: 'presence',
      peerId: store.localPeerId,
      state,
      timestamp: Date.now(),
    };

    peerManager.broadcast(message);
  }

  private startCountdown(photoId: string) {
    let count = 3;
    
    // Notify locally
    this.notifyCountdownListeners(count, photoId);

    // Broadcast countdown
    const store = useMultiplayerStore.getState();
    
    this.countdownTimer = setInterval(() => {
      count--;
      
      // Broadcast countdown to all peers
      if (store.localPeerId) {
        const message: CountdownMessage = {
          type: 'countdown',
          peerId: store.localPeerId,
          count,
          photoId,
          timestamp: Date.now(),
        };
        peerManager.broadcast(message);
      }

      this.notifyCountdownListeners(count, photoId);

      if (count === 0) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.captureGroupPhoto(photoId);
      }
    }, 1000);
  }

  private async captureGroupPhoto(photoId: string) {
    // Capture the scene
    const dataUrl = await sceneManager.captureSnapshot({
      includeLogo: true,
      transparentBackground: false,
    });

    this._pendingPhotoId = null;
    
    if (dataUrl) {
      this.notifyPhotoCapturedListeners(photoId, dataUrl);
      console.log('[SocialManager] Group photo captured:', photoId);
    } else {
      console.error('[SocialManager] Failed to capture group photo');
    }
  }

  private setupActivityTracking() {
    const resetActivity = () => {
      if (this.localPresence === 'afk') {
        this.setPresence('active');
      }
      this.resetAFK();
    };

    // Track mouse/keyboard activity
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', resetActivity, { passive: true });
      window.addEventListener('keydown', resetActivity, { passive: true });
      window.addEventListener('click', resetActivity, { passive: true });
      window.addEventListener('touchstart', resetActivity, { passive: true });
    }
  }

  private resetAFK() {
    if (this.afkTimeout) {
      clearTimeout(this.afkTimeout);
    }

    this.afkTimeout = setTimeout(() => {
      if (this.localPresence === 'active') {
        this.setPresence('afk');
      }
    }, this.AFK_TIMEOUT);
  }

  private notifyChatListeners(message: DisplayChatMessage) {
    this.chatListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[SocialManager] Chat listener error:', error);
      }
    });
  }

  private notifyReactionListeners(reaction: DisplayReaction) {
    this.reactionListeners.forEach(listener => {
      try {
        listener(reaction);
      } catch (error) {
        console.error('[SocialManager] Reaction listener error:', error);
      }
    });
  }

  private notifyPresenceListeners(peerId: PeerId, state: PresenceState) {
    this.presenceListeners.forEach(listener => {
      try {
        listener(peerId, state);
      } catch (error) {
        console.error('[SocialManager] Presence listener error:', error);
      }
    });
  }

  private notifyCountdownListeners(count: number, photoId: string) {
    this.countdownListeners.forEach(listener => {
      try {
        listener(count, photoId);
      } catch (error) {
        console.error('[SocialManager] Countdown listener error:', error);
      }
    });
  }

  private notifyPhotoCapturedListeners(photoId: string, dataUrl: string) {
    this.photoCapturedListeners.forEach(listener => {
      try {
        listener(photoId, dataUrl);
      } catch (error) {
        console.error('[SocialManager] Photo listener error:', error);
      }
    });
  }
}

// Singleton instance
export const socialManager = new SocialManager();
