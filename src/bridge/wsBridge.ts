/**
 * WebSocket bridge — receives control messages from the Python PoseLabBridge
 * and dispatches them to a registered delegate (PoseLab scene or MultiAvatarManager).
 *
 * Activated when the URL contains a `?ws=ws://host:port` parameter.
 */

import type { VRM } from '@pixiv/three-vrm';
import { EXPRESSION_PRESETS, type EmotionState } from '../data/gestures';

/** Mouth blend-shape candidates, tried in order (matches voiceLipSync.ts) */
const MOUTH_CANDIDATES = ['Aa', 'aa', 'a', 'mouthOpen', 'jawOpen', 'A'];

/** Reconnect delay after an unexpected close (ms) */
const RECONNECT_DELAY = 2000;

/** Bridge protocol version */
const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

interface EmotionMsg {
  type: 'emotion';
  peer_id: string;
  emotion: string;
}

interface GestureMsg {
  type: 'gesture';
  peer_id: string;
  gesture: string;
  intensity?: number;
}

interface MouthMsg {
  type: 'mouth';
  peer_id: string;
  value: number;
}

interface AvatarLoadMsg {
  type: 'avatar_load';
  peer_id: string;
  vrm_url: string;
  display_name?: string;
  is_local?: boolean;
  position?: { x: number; y: number; z: number };
}

interface AvatarRemoveMsg {
  type: 'avatar_remove';
  peer_id: string;
}

interface SpeakingMsg {
  type: 'speaking';
  peer_id: string;
  active: boolean;
}

interface SetBackgroundMsg {
  type: 'set_background';
  url: string;
}

interface MoveToMsg {
  type: 'move_to';
  peer_id: string;
  target_peer_id?: string;
  position?: { x: number; y: number; z: number };
}

interface GoHomeMsg {
  type: 'go_home';
  peer_id: string;
}

interface SetEnvironmentMsg {
  type: 'set_environment';
  preset: string;
}

interface SetPostProcessingMsg {
  type: 'set_post_processing';
  preset: string;
}

interface SetCameraRoomMsg {
  type: 'set_camera_room';
  room_id: string;
  zone_center: { x: number; z: number };
  hdri?: string;
}

interface SetCameraShotMsg {
  type: 'set_camera_shot';
  shot: string;
  peer_id?: string;
  hold_seconds?: number;
  force?: boolean;
}

interface PlayAnimationMsg {
  type: 'play_animation';
  peer_id: string;
  url: string;
  loop?: boolean;
}

type BridgeMessage =
  | EmotionMsg
  | GestureMsg
  | MouthMsg
  | AvatarLoadMsg
  | AvatarRemoveMsg
  | SpeakingMsg
  | SetBackgroundMsg
  | MoveToMsg
  | GoHomeMsg
  | SetEnvironmentMsg
  | SetPostProcessingMsg
  | SetCameraRoomMsg
  | SetCameraShotMsg
  | PlayAnimationMsg;

// ---------------------------------------------------------------------------
// Delegate interface — PoseLab.tsx registers these callbacks
// ---------------------------------------------------------------------------

export interface WSBridgeDelegate {
  loadAvatar: (peerId: string, url: string, displayName: string, position?: { x: number; y: number; z: number }) => Promise<void>;
  removeAvatar?: (peerId: string) => void;
  /** Return the VRM for a given peer (used for expression/gesture control) */
  getVRM: (peerId: string) => VRM | null;
  /** Called when emotion changes — delegate can crossfade body animation */
  setEmotion?: (peerId: string, emotion: string) => void;
  /** Called to perform a procedural gesture animation on an avatar */
  performGesture?: (peerId: string, gesture: string, intensity?: number) => void;
  /** Called to play an FBX animation by URL on an avatar */
  playAnimation?: (peerId: string, url: string, loop?: boolean) => void;
  /** Called when a peer starts/stops speaking — delegate can move camera */
  onSpeaking?: (peerId: string, active: boolean) => void;
  /** Called to set scene background from an image URL */
  setBackground?: (url: string) => void;
  /** Move a peer to a target peer's position or an absolute position */
  moveTo?: (peerId: string, targetPeerId: string | null, position: { x: number; y: number; z: number } | null) => void;
  /** Send a peer back to their home position */
  goHome?: (peerId: string) => void;
  /** Switch HDRI environment preset */
  setEnvironment?: (preset: string) => void;
  /** Switch post-processing preset */
  setPostProcessing?: (preset: string) => void;
  /** Focus camera on a room zone and optionally switch HDRI */
  setCameraRoom?: (roomId: string, zoneCenter: { x: number; z: number }, hdri?: string) => void;
  /** Force a specific cinematic shot with optional hold time */
  setCameraShot?: (shot: string, peerId?: string | null, holdSeconds?: number, force?: boolean) => void;
}

let delegate: WSBridgeDelegate | null = null;

/** Register a delegate that receives bridge commands. */
export function registerDelegate(d: WSBridgeDelegate): void {
  delegate = d;
  console.log('[wsBridge] Delegate registered');

  // Replay any queued avatar_load messages
  for (const msg of pendingLoads) {
    handleMessage(msg);
  }
  pendingLoads.length = 0;
}

const pendingLoads: AvatarLoadMsg[] = [];

// ---------------------------------------------------------------------------
// VRM expression helpers (work directly on VRM, no multiAvatarManager)
// ---------------------------------------------------------------------------

/** Cache: peer_id → resolved mouth blend-shape name */
const resolvedMouth = new Map<string, string | null>();

function getAvailableExpressions(vrm: VRM): string[] {
  if (!vrm.expressionManager) return [];
  const names: string[] = [];
  const manager = vrm.expressionManager as unknown as {
    expressionMap?: Record<string, unknown>;
    expressions?: { expressionName?: string }[];
  };
  if (manager.expressionMap) {
    Object.keys(manager.expressionMap).forEach((n) => names.push(n));
  } else if (manager.expressions) {
    manager.expressions.forEach((expr) => {
      if (expr.expressionName) names.push(expr.expressionName);
    });
  }
  return names;
}

function setExpressionWeight(vrm: VRM, name: string, weight: number): void {
  if (!vrm.expressionManager) return;
  vrm.expressionManager.setValue(name, weight);
  vrm.expressionManager.update();
}

function setEmotion(vrm: VRM, emotion: string): void {
  if (!vrm.expressionManager) return;
  const expressions = EXPRESSION_PRESETS[emotion as EmotionState];
  if (!expressions) return;
  Object.entries(expressions).forEach(([name, value]) => {
    vrm.expressionManager!.setValue(name, value);
  });
  vrm.expressionManager.update();
}

function setMouthOpen(peerId: string, vrm: VRM, value: number): void {
  let name = resolvedMouth.get(peerId);
  if (name === undefined) {
    const available = new Set(getAvailableExpressions(vrm));
    name = MOUTH_CANDIDATES.find((c) => available.has(c)) ?? null;
    resolvedMouth.set(peerId, name);
    if (name) {
      console.log(`[wsBridge] Resolved mouth shape for ${peerId}: ${name}`);
    } else {
      console.warn(`[wsBridge] No mouth blend-shape found for ${peerId}`);
    }
  }
  if (name) {
    setExpressionWeight(vrm, name, value);
  }
}

// ---------------------------------------------------------------------------
// Message dispatcher
// ---------------------------------------------------------------------------

async function handleMessage(msg: BridgeMessage): Promise<void> {
  switch (msg.type) {
    case 'avatar_load': {
      if (!delegate) {
        // Queue until delegate is registered
        pendingLoads.push(msg);
        console.log(`[wsBridge] Queuing avatar_load (no delegate yet): ${msg.peer_id}`);
        return;
      }
      const { peer_id, vrm_url, display_name = '', position } = msg;
      console.log(`[wsBridge] Loading avatar: peer=${peer_id} url=${vrm_url} pos=${position ? `(${position.x},${position.z})` : 'default'}`);
      try {
        await delegate.loadAvatar(peer_id, vrm_url, display_name, position);
        resolvedMouth.delete(peer_id);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ready', peer_id }));
        }
      } catch (err) {
        console.error(`[wsBridge] Failed to load avatar ${peer_id}:`, err);
      }
      break;
    }

    case 'avatar_remove': {
      if (delegate?.removeAvatar) {
        delegate.removeAvatar(msg.peer_id);
      }
      resolvedMouth.delete(msg.peer_id);
      console.log(`[wsBridge] Removed avatar: peer=${msg.peer_id}`);
      break;
    }

    case 'emotion': {
      const vrm = delegate?.getVRM(msg.peer_id);
      if (vrm) setEmotion(vrm, msg.emotion);
      if (delegate?.setEmotion) delegate.setEmotion(msg.peer_id, msg.emotion);
      break;
    }

    case 'gesture': {
      if (delegate?.performGesture) {
        delegate.performGesture(msg.peer_id, msg.gesture, msg.intensity);
      }
      console.log(`[wsBridge] Gesture: peer=${msg.peer_id} gesture=${msg.gesture}`);
      break;
    }

    case 'play_animation': {
      if (delegate?.playAnimation) {
        delegate.playAnimation(msg.peer_id, msg.url, msg.loop);
      }
      break;
    }

    case 'mouth': {
      const vrm = delegate?.getVRM(msg.peer_id);
      if (vrm) setMouthOpen(msg.peer_id, vrm, msg.value);
      break;
    }

    case 'speaking': {
      if (delegate?.onSpeaking) {
        delegate.onSpeaking(msg.peer_id, msg.active);
      }
      break;
    }

    case 'set_background': {
      if (delegate?.setBackground) {
        delegate.setBackground(msg.url);
      }
      break;
    }

    case 'move_to': {
      if (delegate?.moveTo) {
        delegate.moveTo(msg.peer_id, msg.target_peer_id ?? null, msg.position ?? null);
      }
      break;
    }

    case 'go_home': {
      if (delegate?.goHome) {
        delegate.goHome(msg.peer_id);
      }
      break;
    }

    case 'set_environment': {
      if (delegate?.setEnvironment) {
        delegate.setEnvironment(msg.preset);
      }
      break;
    }

    case 'set_post_processing': {
      if (delegate?.setPostProcessing) {
        delegate.setPostProcessing(msg.preset);
      }
      break;
    }

    case 'set_camera_room': {
      if (delegate?.setCameraRoom) {
        delegate.setCameraRoom(msg.room_id, msg.zone_center, msg.hdri);
      }
      break;
    }

    case 'set_camera_shot': {
      if (delegate?.setCameraShot) {
        delegate.setCameraShot(msg.shot, msg.peer_id ?? null, msg.hold_seconds, msg.force);
      }
      break;
    }

    default:
      console.warn('[wsBridge] Unknown message type:', (msg as { type: string }).type);
  }
}

// ---------------------------------------------------------------------------
// WebSocket connection
// ---------------------------------------------------------------------------

let ws: WebSocket | null = null;
let shouldReconnect = true;

function connect(url: string): void {
  console.log(`[wsBridge] Connecting to ${url}...`);
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[wsBridge] Connected');
    ws!.send(JSON.stringify({ type: 'hello', version: PROTOCOL_VERSION }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as BridgeMessage;
      handleMessage(msg);
    } catch (err) {
      console.error('[wsBridge] Failed to parse message:', err);
    }
  };

  ws.onclose = () => {
    console.log('[wsBridge] Disconnected');
    ws = null;
    if (shouldReconnect) {
      setTimeout(() => connect(url), RECONNECT_DELAY);
    }
  };

  ws.onerror = (err) => {
    console.error('[wsBridge] Error:', err);
    ws?.close();
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WSBridge {
  close: () => void;
  isConnected: () => boolean;
}

/**
 * Set up the WebSocket bridge if a `?ws=` URL parameter is present.
 * Call once at startup (idempotent — subsequent calls are no-ops).
 */
export function setupWSBridge(): WSBridge | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const wsUrl = params.get('ws');
  if (!wsUrl) return null;

  console.log(`[wsBridge] WS bridge URL detected: ${wsUrl}`);
  shouldReconnect = true;
  connect(wsUrl);

  const bridge: WSBridge = {
    close: () => {
      shouldReconnect = false;
      ws?.close();
    },
    isConnected: () => ws !== null && ws.readyState === WebSocket.OPEN,
  };

  return bridge;
}
