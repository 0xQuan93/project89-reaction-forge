import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { 
  PeerId, 
  RoomId, 
  PeerMessage, 
  ConnectionState,
  MultiplayerConfig,
} from '../types/multiplayer';
import { DEFAULT_MULTIPLAYER_CONFIG } from '../types/multiplayer';
import { useMultiplayerStore } from '../state/useMultiplayerStore';
import { voiceChatManager } from './voiceChatManager';

type MessageHandler = (peerId: PeerId, message: PeerMessage) => void;
type ConnectionHandler = (peerId: PeerId, state: ConnectionState) => void;
type ErrorHandler = (error: Error) => void;

/**
 * PeerManager handles WebRTC peer-to-peer connections using PeerJS.
 * Manages session creation, joining, and message routing.
 */
class PeerManager {
  private peer: Peer | null = null;
  private connections = new Map<PeerId, DataConnection>();
  private messageHandlers = new Set<MessageHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private config: MultiplayerConfig;
  private reconnectTimers = new Map<PeerId, ReturnType<typeof setTimeout>>();
  private isDestroyed = false;

  constructor(config: Partial<MultiplayerConfig> = {}) {
    this.config = { ...DEFAULT_MULTIPLAYER_CONFIG, ...config };
  }

  // ==================
  // Session Management
  // ==================

  /**
   * Create a new session as host
   * @returns The room ID (which is the host's peer ID)
   */
  async createSession(displayName: string): Promise<RoomId> {
    const store = useMultiplayerStore.getState();
    store.setConnecting(true);
    store.setError(null);

    return new Promise((resolve, reject) => {
      // Generate a unique room ID
      const roomId = this.generateRoomId();
      
      this.peer = new Peer(roomId, {
        debug: 1, // Minimal logging
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        store.setError('Connection timeout');
        this.destroy();
      }, this.config.connectionTimeout);

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('[PeerManager] Session created with ID:', id);

        store.setLocalPeerId(id);
        store.setRoomId(id);
        store.setRole('host');
        store.setConnected(true);
        store.setLocalDisplayName(displayName);

        // Add self to peers list
        store.addPeer(id, {
          displayName,
          connectionState: 'connected',
          hasAvatar: false,
          isLocal: true,
        });

        // Share peer instance with voice chat manager
        voiceChatManager.setPeer(this.peer);

        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[PeerManager] Error:', err);
        store.setError(err.message);
        this.notifyError(err);
        reject(err);
      });

      this.peer.on('disconnected', () => {
        console.warn('[PeerManager] Disconnected from signaling server');
        // Try to reconnect
        if (!this.isDestroyed && this.peer) {
          this.peer.reconnect();
        }
      });
    });
  }

  /**
   * Join an existing session as guest
   * @param roomId - The room ID to join (host's peer ID)
   */
  async joinSession(roomId: RoomId, displayName: string): Promise<void> {
    const store = useMultiplayerStore.getState();
    store.setConnecting(true);
    store.setError(null);

    return new Promise((resolve, reject) => {
      // Create our own peer with a random ID
      const myPeerId = this.generatePeerId();
      
      this.peer = new Peer(myPeerId, {
        debug: 1,
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        store.setError('Connection timeout');
        this.destroy();
      }, this.config.connectionTimeout);

      this.peer.on('open', (id) => {
        console.log('[PeerManager] My peer ID:', id);
        
        store.setLocalPeerId(id);
        store.setRoomId(roomId);
        store.setRole('guest');
        store.setLocalDisplayName(displayName);

        // Add self to peers list
        store.addPeer(id, {
          displayName,
          connectionState: 'connected',
          hasAvatar: false,
          isLocal: true,
        });

        // Share peer instance with voice chat manager
        voiceChatManager.setPeer(this.peer);

        // Connect to the host
        console.log('[PeerManager] Connecting to host:', roomId);
        const conn = this.peer!.connect(roomId, {
          reliable: true,
          serialization: 'json',
        });

        conn.on('open', () => {
          clearTimeout(timeout);
          console.log('[PeerManager] Connected to host');
          
          this.connections.set(roomId, conn);
          store.setConnected(true);
          
          // Add host to peers list
          store.addPeer(roomId, {
            displayName: 'Host', // Will be updated when we receive their info
            connectionState: 'connected',
            hasAvatar: false,
            isLocal: false,
          });

          this.setupConnectionHandlers(conn, roomId);
          this.notifyConnectionChange(roomId, 'connected');

          // Send join message
          this.send(roomId, {
            type: 'peer-join',
            peerId: id,
            displayName,
            timestamp: Date.now(),
          });

          // Request sync from host
          this.send(roomId, {
            type: 'sync-request',
            peerId: id,
            timestamp: Date.now(),
          });

          resolve();
        });

        conn.on('error', (err) => {
          clearTimeout(timeout);
          console.error('[PeerManager] Connection error:', err);
          store.setError('Failed to connect to session');
          reject(err);
        });
      });

      // Handle incoming connections from other peers (mesh network)
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[PeerManager] Peer error:', err);
        store.setError(err.message);
        this.notifyError(err);
        reject(err);
      });
    });
  }

  /**
   * Leave the current session
   */
  leaveSession() {
    const store = useMultiplayerStore.getState();
    const localPeerId = store.localPeerId;

    if (localPeerId) {
      // Notify all peers that we're leaving
      this.broadcast({
        type: 'peer-leave',
        peerId: localPeerId,
        timestamp: Date.now(),
      });
    }

    this.destroy();
    store.resetSession();
  }

  // ==================
  // Messaging
  // ==================

  /**
   * Send a message to a specific peer
   */
  send(peerId: PeerId, message: PeerMessage): boolean {
    const conn = this.connections.get(peerId);
    if (!conn || conn.open === false) {
      console.warn('[PeerManager] Cannot send to peer:', peerId, '- not connected');
      return false;
    }

    try {
      conn.send(message);
      return true;
    } catch (error) {
      console.error('[PeerManager] Send error:', error);
      return false;
    }
  }

  /**
   * Broadcast a message to all connected peers
   */
  broadcast(message: PeerMessage): void {
    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        try {
          conn.send(message);
        } catch (error) {
          console.error('[PeerManager] Broadcast error to', peerId, ':', error);
        }
      }
    });
  }

  /**
   * Broadcast a message to all peers except one
   */
  broadcastExcept(excludePeerId: PeerId, message: PeerMessage): void {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        try {
          conn.send(message);
        } catch (error) {
          console.error('[PeerManager] Broadcast error to', peerId, ':', error);
        }
      }
    });
  }

  // ==================
  // Event Handlers
  // ==================

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Register a connection state handler
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  // ==================
  // Utilities
  // ==================

  /**
   * Get the local peer ID
   */
  getLocalPeerId(): PeerId | null {
    return this.peer?.id ?? null;
  }

  /**
   * Check if connected to any peers
   */
  isConnected(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Get count of connected peers
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get list of connected peer IDs
   */
  getConnectedPeerIds(): PeerId[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Generate the shareable session URL
   */
  getSessionUrl(): string {
    const store = useMultiplayerStore.getState();
    const roomId = store.roomId;
    if (!roomId) return '';

    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    return url.toString();
  }

  /**
   * Check if there's a room ID in the current URL
   */
  static getRoomIdFromUrl(): RoomId | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  }

  /**
   * Clear room ID from URL without page reload
   */
  static clearRoomIdFromUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }

  // ==================
  // Internal
  // ==================

  private handleIncomingConnection(conn: DataConnection) {
    const peerId = conn.peer;
    console.log('[PeerManager] Incoming connection from:', peerId);

    const store = useMultiplayerStore.getState();

    // Check max peers
    if (this.connections.size >= this.config.maxPeers) {
      console.warn('[PeerManager] Max peers reached, rejecting:', peerId);
      conn.close();
      return;
    }

    conn.on('open', () => {
      console.log('[PeerManager] Connection opened with:', peerId);
      
      this.connections.set(peerId, conn);
      
      // Add peer to store (will be updated with display name when we receive join message)
      store.addPeer(peerId, {
        displayName: `Peer-${peerId.slice(-4)}`,
        connectionState: 'connected',
        hasAvatar: false,
        isLocal: false,
      });

      this.setupConnectionHandlers(conn, peerId);
      this.notifyConnectionChange(peerId, 'connected');
    });

    conn.on('error', (err) => {
      console.error('[PeerManager] Connection error with', peerId, ':', err);
      this.notifyConnectionChange(peerId, 'error');
    });
  }

  private setupConnectionHandlers(conn: DataConnection, peerId: PeerId) {
    const store = useMultiplayerStore.getState();

    conn.on('data', (data) => {
      const message = data as PeerMessage;
      this.handleMessage(peerId, message);
    });

    conn.on('close', () => {
      console.log('[PeerManager] Connection closed:', peerId);
      this.connections.delete(peerId);
      store.removePeer(peerId);
      this.notifyConnectionChange(peerId, 'disconnected');
      
      // Notify voice chat manager
      voiceChatManager.handlePeerLeave(peerId);

      // Clear any reconnect timer
      const timer = this.reconnectTimers.get(peerId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(peerId);
      }
    });

    conn.on('error', (err) => {
      console.error('[PeerManager] Connection error:', peerId, err);
      store.updatePeer(peerId, { connectionState: 'error' });
      this.notifyConnectionChange(peerId, 'error');
    });
  }

  private handleMessage(peerId: PeerId, message: PeerMessage) {
    const store = useMultiplayerStore.getState();

    // Handle built-in message types
    switch (message.type) {
      case 'peer-join':
        store.updatePeer(peerId, { displayName: message.displayName });
        // If we're host, notify other peers about the new peer
        if (store.role === 'host') {
          // Tell existing peers about the new peer
          this.broadcastExcept(peerId, {
            type: 'peer-join',
            peerId: message.peerId,
            displayName: message.displayName,
            timestamp: Date.now(),
          });
          
          // Tell the new peer about all existing peers
          store.peers.forEach((peerInfo, existingPeerId) => {
            if (existingPeerId !== peerId && existingPeerId !== store.localPeerId) {
              this.send(peerId, {
                type: 'peer-join',
                peerId: existingPeerId,
                displayName: peerInfo.displayName,
                timestamp: Date.now(),
              });
            }
          });
        }
        break;

      case 'peer-leave':
        store.removePeer(message.peerId);
        break;

      case 'ping':
        this.send(peerId, {
          type: 'pong',
          peerId: store.localPeerId!,
          sentAt: message.sentAt,
          receivedAt: Date.now(),
          timestamp: Date.now(),
        });
        break;

      case 'pong':
        const latency = Date.now() - message.sentAt;
        store.updatePeerLatency(peerId, latency);
        break;
    }

    // Notify all handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(peerId, message);
      } catch (error) {
        console.error('[PeerManager] Message handler error:', error);
      }
    });
  }

  private notifyConnectionChange(peerId: PeerId, state: ConnectionState) {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(peerId, state);
      } catch (error) {
        console.error('[PeerManager] Connection handler error:', error);
      }
    });
  }

  private notifyError(error: Error) {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (e) {
        console.error('[PeerManager] Error handler error:', e);
      }
    });
  }

  private generateRoomId(): RoomId {
    // Generate a memorable room ID: adjective-noun-number
    const adjectives = ['swift', 'cosmic', 'neon', 'cyber', 'quantum', 'neural', 'void', 'azure'];
    const nouns = ['runner', 'ghost', 'phoenix', 'matrix', 'nexus', 'pulse', 'wave', 'forge'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${adj}-${noun}-${num}`;
  }

  private generatePeerId(): PeerId {
    return `peer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Clean up and destroy the peer connection
   */
  destroy() {
    this.isDestroyed = true;

    // Disable voice chat
    voiceChatManager.disable();
    voiceChatManager.setPeer(null);

    // Clear all reconnect timers
    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();

    // Close all connections
    this.connections.forEach(conn => {
      try {
        conn.close();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    this.connections.clear();

    // Destroy peer
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.peer = null;
    }

    // Clear handlers
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
    this.errorHandlers.clear();
  }

  /**
   * Get the underlying Peer instance (for voice chat integration)
   */
  getPeer(): Peer | null {
    return this.peer;
  }
}

// Singleton instance
export const peerManager = new PeerManager();

