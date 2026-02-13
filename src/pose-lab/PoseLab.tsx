import { useEffect, useRef, useState } from 'react';
import './pose-lab.css';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm';
import { BatchFBXConverter } from './BatchFBXConverter';
import { DEFAULT_VRM_URL, useAvatarSource } from '../state/useAvatarSource';
import { useSceneSettingsStore } from '../state/useSceneSettingsStore';
import {
  mixamoSources,
  batchConfigs,
  applyMixamoBuffer,
  savePoseToDisk
} from './batchUtils';
import { registerDelegate } from '../bridge/wsBridge';
import { GESTURE_LIBRARY, Easing } from '../data/gestures';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e); // fallback until HDRI loads
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 2.5);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

// ── HDRI Environment ────────────────────────────────────────────────
const HDRI_PRESETS: Record<string, string> = {
  studio: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr',
  outdoor: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_43d_clear_puresky_1k.hdr',
  sunset: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr',
  night: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dikhololo_night_1k.hdr',
  urban: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr',
  'cyber-alley': '/backgrounds/hdr/M3_Anime_hdri-hdr_cyber-city_alleyway_at_midnight_422831616_14844286.hdr',
  'lush-forest': '/backgrounds/hdr/M3_Anime_hdri-hdr_deep_in_a_lush_1051738730_14844291.hdr',
  volcano: '/backgrounds/hdr/M3_Anime_hdri-hdr_inside_an_active_volcano_1527142368_14844295.hdr',
  'deep-sea': '/backgrounds/hdr/M3_Anime_hdri-hdr_underwater_deep_sea_trench_2030061023_14844424.hdr',
  'glass-platform': '/backgrounds/hdr/M3_Anime_hdri-hdr_a_glass_platform_in_81034329_14844536.hdr',
  'hacker-room': '/backgrounds/hdr/M3_Anime_hdri-hdr_interior_of_a_cluttered_661225116_14844563.hdr',
  industrial: '/backgrounds/hdr/M3_Anime_hdri-hdr_inside_a_massive_industrial_1117188263_14844712.hdr',
  'rooftop-garden': '/backgrounds/hdr/M3_Anime_hdri-hdr_ooftop_garden_of_a_419291268_14844925.hdr',
  'shinto-shrine': '/backgrounds/hdr/M3_Anime_hdri-hdr_pathway_to_a_shinto_1505440517_14844939.hdr',
};

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const rgbeLoader = new RGBELoader();

function loadHDRIEnvironment(presetOrUrl: string): void {
  const url = HDRI_PRESETS[presetOrUrl] ?? presetOrUrl;
  if (!url) return;
  console.log('[PoseLab] Loading HDRI:', presetOrUrl, url.slice(0, 80));
  rgbeLoader.load(
    url,
    (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      scene.background = envMap;
      scene.backgroundBlurriness = 0.05;
      texture.dispose();
      console.log('[PoseLab] HDRI applied:', presetOrUrl);
    },
    undefined,
    (err) => {
      console.warn('[PoseLab] HDRI load failed:', presetOrUrl, err);
    }
  );
}

// Load default HDRI
loadHDRIEnvironment('studio');

// ── Lighting: cinematic 3-point with shadows ────────────────────────
const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x444466, 0.38);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
keyLight.position.set(3, 5, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -12;
keyLight.shadow.camera.right = 12;
keyLight.shadow.camera.top = 12;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.radius = 3;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xa0b8ff, 0.82);
fillLight.position.set(-3, 3, 1);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffe0b0, 0.58);
rimLight.position.set(0, 3, -3);
scene.add(rimLight);

// ── Ground plane: invisible shadow-catcher so avatars cast shadows ──────
const groundGeo = new THREE.PlaneGeometry(60, 60);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// OrbitControls (initialized in useEffect)
let controls: OrbitControls | null = null;

// Bridge-managed VRMs (peer_id → VRM)
const bridgeVRMs = new Map<string, VRM>();
// Animation mixers for bridge VRMs (peer_id → mixer)
const bridgeMixers = new Map<string, THREE.AnimationMixer>();
// Current active action per peer (peer_id → action) for crossfade
const bridgeActions = new Map<string, THREE.AnimationAction>();
// Animation clip cache (url → clip) to avoid re-fetching
const animClipCache = new Map<string, THREE.AnimationClip>();
// Current emotion per peer for debounce
const bridgeEmotions = new Map<string, string>();

// ── Home positions: loose semi-circle facing camera ─────────────────
const HOME_POSITIONS: THREE.Vector3[] = [
  new THREE.Vector3(-1.8, 0, -0.3),
  new THREE.Vector3(-0.9, 0,  0.2),
  new THREE.Vector3( 0.0, 0, -0.1),
  new THREE.Vector3( 0.9, 0,  0.3),
  new THREE.Vector3( 1.8, 0, -0.2),
  new THREE.Vector3( 0.0, 0, -0.8),
];
const bridgeHomePositions = new Map<string, THREE.Vector3>();
let nextHomeIndex = 0;

// Room focus zone — when set, camera and shot calculations only consider
// avatars within this zone radius. Set by setCameraRoom bridge message.
let focusZoneCenter: THREE.Vector3 | null = null;
const FOCUS_ZONE_RADIUS = 4.0; // meters — rooms are ~6m apart

/** Return only VRMs within the current focus zone (or all if no zone set) */
function getVisibleVRMs(): Map<string, VRM> {
  if (!focusZoneCenter) return bridgeVRMs;
  const visible = new Map<string, VRM>();
  for (const [pid, vrm] of bridgeVRMs) {
    const dx = vrm.scene.position.x - focusZoneCenter.x;
    const dz = vrm.scene.position.z - focusZoneCenter.z;
    if (Math.sqrt(dx * dx + dz * dz) <= FOCUS_ZONE_RADIUS) {
      visible.set(pid, vrm);
    }
  }
  return visible;
}

const DARK_POST_PRESETS = new Set(['noir', 'retro']);
const SAFE_MULTI_AVATAR_POST_PRESET = 'cinematic';

function resolvePostPresetForScene(preset: string): string {
  const requested = (preset || 'none').trim().toLowerCase();
  if (getVisibleVRMs().size > 1 && DARK_POST_PRESETS.has(requested)) {
    console.log(
      `[PoseLab] Post preset guard: ${requested} -> ${SAFE_MULTI_AVATAR_POST_PRESET} (multi-avatar scene)`
    );
    return SAFE_MULTI_AVATAR_POST_PRESET;
  }
  return requested;
}

// Emotion → Mixamo FBX animation mapping
// Speaker emotion → body animation (purposeful, not random)
const EMOTION_ANIMATIONS: Record<string, string> = {
  happy: '/poses/fbx/Happy Idle.fbx',
  excited: '/poses/fbx/Standing Thumbs Up.fbx',
  sad: '/poses/fbx/Sitting Sad.fbx',
  angry: '/poses/fbx/Offensive Idle.fbx',
  surprised: '/poses/fbx/Waving.fbx',
  thinking: '/poses/fbx/Focus.fbx',
  nervous: '/poses/fbx/Nervously Look Around.fbx',
  tired: '/poses/fbx/Breathing Idle.fbx',
  neutral: '/poses/fbx/Breathing Idle.fbx',
};

// Listener reactions — when someone ELSE is speaking, non-speakers play these
// keyed by the speaker's emotion so listeners react appropriately
const LISTENER_REACTIONS: Record<string, string> = {
  happy: '/poses/fbx/Happy Idle.fbx',
  excited: '/poses/fbx/Clapping.fbx',
  sad: '/poses/fbx/Breathing Idle.fbx',
  angry: '/poses/fbx/Nervously Look Around.fbx',
  surprised: '/poses/fbx/Nervously Look Around.fbx',
  thinking: '/poses/fbx/Focus.fbx',
  nervous: '/poses/fbx/Breathing Idle.fbx',
  tired: '/poses/fbx/Bored.fbx',
  neutral: '/poses/fbx/Neutral Idle.fbx',
};

// Speaker tracking state
let activeSpeakerPeerId: string | null = null;

// Target height for VRM normalization — all avatars scaled to this
const TARGET_VRM_HEIGHT = 1.6;

// Background texture loader with CORS support
const bgTextureLoader = new THREE.TextureLoader();
bgTextureLoader.crossOrigin = 'anonymous';

// Pool of idle animations — calm, natural standing poses (no aggressive/random ones)
const IDLE_POOL = [
  '/poses/fbx/Breathing Idle.fbx',
  '/poses/fbx/Neutral Idle.fbx',
  '/poses/fbx/Happy Idle.fbx',
  '/poses/fbx/Breathing Idle.fbx',
  '/poses/fbx/Neutral Idle.fbx',
  '/poses/fbx/Focus.fbx',
];
let idlePoolIndex = 0;

// Locked ground Y positions per peer — animation root motion can push
// characters off the ground, so we snap them back each frame.
const bridgeGroundY = new Map<string, number>();

/** Strip hips Y position keyframes from an animation clip to prevent floating.
 *  Mixamo animations include root motion that sets an absolute hips height,
 *  which causes characters to float when applied to differently-scaled VRMs. */
function stripRootYMotion(clip: THREE.AnimationClip): void {
  clip.tracks = clip.tracks.filter((track) => {
    // Remove hips position tracks entirely — they cause floating
    // Keep rotation tracks (quaternion) which are fine
    if (track.name.toLowerCase().includes('hips') && track.name.endsWith('.position')) {
      console.log(`[PoseLab] Stripped root motion track: ${track.name}`);
      return false;
    }
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MOVEMENT SYSTEM — Walk between positions
// ═══════════════════════════════════════════════════════════════════════

interface MovementState {
  isMoving: boolean;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  speed: number;          // m/s
  walkAction: THREE.AnimationAction | null;
  previousAction: THREE.AnimationAction | null;
}

const movementStates = new Map<string, MovementState>();
const walkClipCache = new Map<string, THREE.AnimationClip>();  // peerId → retargeted walk clip

const WALK_FBX_URL = '/poses/fbx/Walking.fbx';
const WALK_SPEED = 1.2;  // m/s

/** Get or create a retargeted walking clip for a specific VRM */
async function getWalkClip(peerId: string): Promise<THREE.AnimationClip | null> {
  const cached = walkClipCache.get(peerId);
  if (cached) return cached;

  const vrm = bridgeVRMs.get(peerId);
  if (!vrm) return null;

  try {
    let rawClip = animClipCache.get(WALK_FBX_URL);
    if (!rawClip) {
      const res = await fetch(WALK_FBX_URL);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const result = await applyMixamoBuffer(buf, 'Walking.fbx', vrm);
      rawClip = result.animationClip;
      stripRootYMotion(rawClip);
      animClipCache.set(WALK_FBX_URL, rawClip);
    }
    // Re-retarget for this specific VRM
    const res2 = await fetch(WALK_FBX_URL);
    if (!res2.ok) return null;
    const buf2 = await res2.arrayBuffer();
    const result2 = await applyMixamoBuffer(buf2, 'Walking.fbx', vrm);
    const clip = result2.animationClip;
    stripRootYMotion(clip);
    walkClipCache.set(peerId, clip);
    return clip;
  } catch (err) {
    console.warn(`[PoseLab] Failed to load walk clip for ${peerId}:`, err);
    return null;
  }
}

/** Start moving an avatar toward targetPos */
async function startMovement(peerId: string, targetPos: THREE.Vector3): Promise<void> {
  const vrm = bridgeVRMs.get(peerId);
  if (!vrm) return;

  const startPos = new THREE.Vector3(vrm.scene.position.x, 0, vrm.scene.position.z);
  const dist = startPos.distanceTo(new THREE.Vector3(targetPos.x, 0, targetPos.z));
  if (dist < 0.1) return; // Already there

  // Get walk animation
  const walkClip = await getWalkClip(peerId);
  let walkAction: THREE.AnimationAction | null = null;
  const previousAction = bridgeActions.get(peerId) ?? null;

  if (walkClip) {
    let m = bridgeMixers.get(peerId);
    if (!m) {
      m = new THREE.AnimationMixer(vrm.scene);
      bridgeMixers.set(peerId, m);
    }
    walkAction = m.clipAction(walkClip);
    walkAction.loop = THREE.LoopRepeat;
    walkAction.reset();
    walkAction.play();

    if (previousAction && previousAction !== walkAction) {
      previousAction.fadeOut(0.3);
      walkAction.fadeIn(0.3);
    }
    bridgeActions.set(peerId, walkAction);
  }

  // Rotate to face movement direction
  const dx = targetPos.x - startPos.x;
  const dz = targetPos.z - startPos.z;
  vrm.scene.rotation.y = Math.atan2(dx, dz) + Math.PI;

  const state: MovementState = {
    isMoving: true,
    startPos: startPos.clone(),
    targetPos: new THREE.Vector3(targetPos.x, 0, targetPos.z),
    progress: 0,
    speed: WALK_SPEED,
    walkAction,
    previousAction,
  };
  movementStates.set(peerId, state);
  console.log(`[PoseLab] Movement started: peer=${peerId} dist=${dist.toFixed(2)}m`);
}

/** Per-frame movement update — call from render loop */
function updateMovement(peerId: string, vrm: VRM, delta: number): void {
  const state = movementStates.get(peerId);
  if (!state || !state.isMoving) return;

  const totalDist = state.startPos.distanceTo(state.targetPos);
  if (totalDist < 0.01) {
    state.isMoving = false;
    return;
  }

  state.progress += (state.speed * delta) / totalDist;

  if (state.progress >= 1) {
    // Arrived
    state.progress = 1;
    state.isMoving = false;
    vrm.scene.position.x = state.targetPos.x;
    vrm.scene.position.z = state.targetPos.z;

    // Face camera again
    vrm.scene.rotation.y = Math.PI;

    // Update home position to current location (for room-based simulation)
    bridgeHomePositions.set(peerId, state.targetPos.clone());

    // Crossfade back to idle
    if (state.walkAction) {
      const idleAction = state.previousAction;
      if (idleAction && idleAction !== state.walkAction) {
        state.walkAction.fadeOut(0.3);
        idleAction.reset();
        idleAction.fadeIn(0.3);
        idleAction.play();
        bridgeActions.set(peerId, idleAction);
      } else {
        // Find any idle clip to crossfade to
        const idleUrl = IDLE_POOL[0];
        void crossfadeToUrl(peerId, idleUrl);
      }
    }
    console.log(`[PoseLab] Movement arrived: peer=${peerId}`);
    return;
  }

  // Interpolate position
  const x = state.startPos.x + (state.targetPos.x - state.startPos.x) * state.progress;
  const z = state.startPos.z + (state.targetPos.z - state.startPos.z) * state.progress;
  vrm.scene.position.x = x;
  vrm.scene.position.z = z;

  // Face movement direction
  const dx = state.targetPos.x - state.startPos.x;
  const dz = state.targetPos.z - state.startPos.z;
  vrm.scene.rotation.y = Math.atan2(dx, dz) + Math.PI;
}

// ═══════════════════════════════════════════════════════════════════════
// TURN-TO-FACE SYSTEM — Avatars angle toward the speaker
// ═══════════════════════════════════════════════════════════════════════

const faceTargets = new Map<string, string | null>();  // peerId → targetPeerId
const FACE_ROTATION_SPEED = 3.0;    // rad/s
const MAX_FACE_ANGLE = Math.PI / 6; // 30 degrees from camera-facing

/** Per-frame turn-to-face update */
function updateFaceTarget(peerId: string, vrm: VRM, delta: number): void {
  const state = movementStates.get(peerId);
  if (state?.isMoving) return; // Walking handles its own rotation

  const targetPeerId = faceTargets.get(peerId);
  let desiredY = Math.PI; // Default: face camera

  if (targetPeerId) {
    const targetVrm = bridgeVRMs.get(targetPeerId);
    if (targetVrm) {
      const dx = targetVrm.scene.position.x - vrm.scene.position.x;
      const dz = targetVrm.scene.position.z - vrm.scene.position.z;
      const angleToTarget = Math.atan2(dx, dz) + Math.PI;
      // Clamp to max angle from camera-facing (Math.PI)
      const diff = angleToTarget - Math.PI;
      const clamped = Math.max(-MAX_FACE_ANGLE, Math.min(MAX_FACE_ANGLE, diff));
      desiredY = Math.PI + clamped;
    }
  }

  // Smooth rotation toward desired angle
  let angleDiff = desiredY - vrm.scene.rotation.y;
  // Normalize to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  const maxStep = FACE_ROTATION_SPEED * delta;
  if (Math.abs(angleDiff) > 0.01) {
    vrm.scene.rotation.y += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxStep);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LIFE SYSTEM — Blink, Breathing Sway, Micro-motion
// ═══════════════════════════════════════════════════════════════════════

/** Per-peer blink state */
interface BlinkState {
  nextBlinkAt: number;   // timestamp (seconds) for next blink
  blinkPhase: number;    // 0 = idle, >0 = mid-blink progress (0→1)
}
const blinkStates = new Map<string, BlinkState>();

/** Schedule next blink 2–6s from now (humans blink every 3-4s on average) */
function scheduleNextBlink(state: BlinkState, now: number): void {
  state.nextBlinkAt = now + 2 + Math.random() * 4;
  state.blinkPhase = 0;
}

const BLINK_DURATION = 0.15; // seconds for a full close→open cycle

/** Update blink for one peer — call each frame */
function updateBlink(peerId: string, vrm: import('@pixiv/three-vrm').VRM, now: number, _delta: number): void {
  let state = blinkStates.get(peerId);
  if (!state) {
    state = { nextBlinkAt: now + Math.random() * 3, blinkPhase: 0 };
    blinkStates.set(peerId, state);
  }

  if (!vrm.expressionManager) return;

  if (state.blinkPhase > 0) {
    // Mid-blink: fast close then open (triangle shape)
    state.blinkPhase += _delta / BLINK_DURATION;
    if (state.blinkPhase >= 1) {
      // Blink done
      vrm.expressionManager.setValue('blink', 0);
      scheduleNextBlink(state, now);
    } else {
      // Triangle: 0→1→0 mapped to 0→0.5→1 of phase
      const t = state.blinkPhase;
      const weight = t < 0.5 ? t * 2 : (1 - t) * 2;
      vrm.expressionManager.setValue('blink', weight);
    }
  } else if (now >= state.nextBlinkAt) {
    // Start a blink
    state.blinkPhase = 0.01;
  }
}

/** Subtle procedural breathing sway — layered on top of Mixamo animations.
 *  Applies a gentle sine-based offset to the spine bone. */
function updateBreathingSway(vrm: import('@pixiv/three-vrm').VRM, elapsed: number, peerId: string): void {
  const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
  if (!spine) return;
  // Each peer gets a phase offset so they don't sway in perfect sync
  const phase = (peerId.charCodeAt(0) || 0) * 0.7;
  // Slow breathing rhythm (~0.25 Hz = one breath per 4 seconds)
  const breathCycle = Math.sin((elapsed + phase) * Math.PI * 0.5);
  // Very subtle chest rise: ~1° rotation on X
  spine.rotation.x += breathCycle * 0.01;
  // Tiny lateral sway at a different frequency for organic feel
  const swayCycle = Math.sin((elapsed + phase) * Math.PI * 0.3);
  spine.rotation.z += swayCycle * 0.006;
}

interface PerformanceState {
  rng: number;
  phase: number;
  speakingWeight: number;
  listeningWeight: number;
  nextAckAt: number;
  ackStartAt: number;
  ackEndAt: number;
  ackStrength: number;
  nextGlanceAt: number;
  glanceYaw: number;
}

const performanceStates = new Map<string, PerformanceState>();

function hashPeerSeed(peerId: string): number {
  let h = 2166136261;
  for (let i = 0; i < peerId.length; i++) {
    h ^= peerId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function nextDeterministicRandom(state: PerformanceState): number {
  state.rng = (Math.imul(1664525, state.rng) + 1013904223) >>> 0;
  return state.rng / 0x100000000;
}

function smoothToward(current: number, target: number, speed: number, delta: number): number {
  const t = 1 - Math.exp(-Math.max(0, speed * delta));
  return current + (target - current) * t;
}

function getPerformanceState(peerId: string, now: number): PerformanceState {
  let state = performanceStates.get(peerId);
  if (state) return state;

  const seed = hashPeerSeed(peerId) || 1;
  state = {
    rng: seed,
    phase: ((seed % 8192) / 8192) * Math.PI * 2,
    speakingWeight: 0,
    listeningWeight: 0,
    nextAckAt: now + 2.2 + (seed % 97) / 37,
    ackStartAt: 0,
    ackEndAt: 0,
    ackStrength: 0,
    nextGlanceAt: now + 1.2 + (seed % 113) / 53,
    glanceYaw: 0,
  };
  performanceStates.set(peerId, state);
  return state;
}

/** Layered micro-motion so avatars read as intentional while speaking/listening. */
function updateIntentionality(peerId: string, vrm: VRM, elapsed: number, delta: number): void {
  const state = getPerformanceState(peerId, elapsed);
  const isSpeaker = activeSpeakerPeerId === peerId;
  const isListener = !!activeSpeakerPeerId && activeSpeakerPeerId !== peerId;
  const isMoving = movementStates.get(peerId)?.isMoving ?? false;

  state.speakingWeight = smoothToward(state.speakingWeight, isSpeaker ? 1 : 0, 7.0, delta);
  state.listeningWeight = smoothToward(state.listeningWeight, isListener ? 1 : 0, 4.5, delta);

  if (elapsed >= state.nextGlanceAt) {
    const yawRange = isSpeaker ? 0.08 : 0.13;
    state.glanceYaw = (nextDeterministicRandom(state) * 2 - 1) * yawRange;
    state.nextGlanceAt = elapsed + 1.3 + nextDeterministicRandom(state) * 3.7;
  }

  if (isListener && elapsed >= state.nextAckAt) {
    state.ackStartAt = elapsed;
    state.ackEndAt = elapsed + 0.28 + nextDeterministicRandom(state) * 0.35;
    state.ackStrength = 0.45 + nextDeterministicRandom(state) * 0.5;
    state.nextAckAt = elapsed + 2.8 + nextDeterministicRandom(state) * 4.8;
  }

  let ackPulse = 0;
  if (state.ackEndAt > elapsed) {
    const duration = Math.max(0.001, state.ackEndAt - state.ackStartAt);
    const t = THREE.MathUtils.clamp((elapsed - state.ackStartAt) / duration, 0, 1);
    ackPulse = Math.sin(t * Math.PI) * state.ackStrength * state.listeningWeight;
  }

  const speechBeat = Math.sin(elapsed * (6.1 + state.phase * 0.02) + state.phase * 1.9);
  const phraseBeat = Math.sin(elapsed * (2.3 + state.phase * 0.01) + state.phase * 0.7);
  const idleDrift = Math.sin(elapsed * (0.65 + state.phase * 0.005) + state.phase * 2.1);

  let targetYaw = state.glanceYaw * (0.2 + 0.6 * (1 - state.speakingWeight));
  if (isListener && activeSpeakerPeerId) {
    const speakerVrm = bridgeVRMs.get(activeSpeakerPeerId);
    if (speakerVrm) {
      const dx = speakerVrm.scene.position.x - vrm.scene.position.x;
      targetYaw += THREE.MathUtils.clamp(dx * 0.06, -0.12, 0.12) * state.listeningWeight;
    }
  }
  targetYaw += phraseBeat * 0.035 * state.speakingWeight;

  let targetPitch = idleDrift * 0.01;
  targetPitch += (0.012 + speechBeat * 0.018 + phraseBeat * 0.01) * state.speakingWeight;
  targetPitch += (0.007 + idleDrift * 0.007) * state.listeningWeight + ackPulse * 0.05;

  let targetRoll = Math.sin(elapsed * 0.9 + state.phase * 0.5) * 0.008;
  targetRoll += Math.sin(elapsed * 2.0 + state.phase) * 0.014 * state.speakingWeight;
  targetRoll += ackPulse * 0.025;

  const movementDampen = isMoving ? 0.35 : 1;
  targetYaw *= movementDampen;
  targetPitch *= movementDampen;
  targetRoll *= movementDampen;

  targetYaw = THREE.MathUtils.clamp(targetYaw, -0.16, 0.16);
  targetPitch = THREE.MathUtils.clamp(targetPitch, -0.12, 0.16);
  targetRoll = THREE.MathUtils.clamp(targetRoll, -0.08, 0.08);

  const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
  const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
  const neck = vrm.humanoid?.getNormalizedBoneNode('neck');
  const head = vrm.humanoid?.getNormalizedBoneNode('head');

  if (spine) {
    spine.rotation.y += targetYaw * 0.12;
    spine.rotation.x += targetPitch * 0.08;
    spine.rotation.z += targetRoll * 0.08;
  }
  if (chest) {
    chest.rotation.y += targetYaw * 0.22;
    chest.rotation.x += targetPitch * 0.18;
    chest.rotation.z += targetRoll * 0.16;
  }
  if (neck) {
    neck.rotation.y += targetYaw * 0.55;
    neck.rotation.x += targetPitch * 0.45;
    neck.rotation.z += targetRoll * 0.35;
  }
  if (head) {
    head.rotation.y += targetYaw;
    head.rotation.x += targetPitch;
    head.rotation.z += targetRoll;
  }

  if (vrm.expressionManager) {
    const mouthOpen = Math.max(0, speechBeat * 0.75 + phraseBeat * 0.25) * state.speakingWeight;
    vrm.expressionManager.setValue('aa', mouthOpen * 0.26);
    vrm.expressionManager.setValue('oh', mouthOpen * 0.14);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CINEMATOGRAPHY ENGINE — Camera & Gaffer System
// ═══════════════════════════════════════════════════════════════════════

// ── Helpers ──────────────────────────────────────────────────────────

/** Get VRM bone world positions (head, hips) for a peer */
function getVRMBones(vrm: VRM): { head: THREE.Vector3; hips: THREE.Vector3 } {
  const head = new THREE.Vector3();
  const hips = new THREE.Vector3();
  const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
  const hipsNode = vrm.humanoid?.getNormalizedBoneNode('hips');
  if (headNode) headNode.getWorldPosition(head);
  if (hipsNode) hipsNode.getWorldPosition(hips);
  if (!headNode || !hipsNode) {
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    if (!headNode) head.set(center.x, box.max.y - size.y * 0.05, center.z);
    if (!hipsNode) hips.set(center.x, center.y, center.z);
  }
  return { head, hips };
}

/** Get the scene center X from all loaded avatars */
function getSceneCenterX(): number {
  const visible = getVisibleVRMs();
  let minX = Infinity, maxX = -Infinity;
  for (const [, v] of visible) {
    minX = Math.min(minX, v.scene.position.x);
    maxX = Math.max(maxX, v.scene.position.x);
  }
  return (minX + maxX) / 2;
}

/** Get a peer that is NOT the given peer (for over-shoulder shots, scoped to visible VRMs) */
function getOtherPeerId(peerId: string): string | null {
  const visible = getVisibleVRMs();
  for (const [pid] of visible) {
    if (pid !== peerId) return pid;
  }
  return null;
}

/** Smooth ease-in-out (quintic) — gentler acceleration, long plateau */
function easeInOut(t: number): number {
  return t < 0.5
    ? 16 * t * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

// ── Shot Definitions ────────────────────────────────────────────────

type ShotType =
  | 'two-shot'          // Both characters, full frame
  | 'medium-two'        // Both characters, waist up (tighter)
  | 'closeup'           // Speaker head + shoulders
  | 'medium-single'     // Speaker waist up
  | 'over-shoulder'     // Behind listener looking at speaker
  | 'low-angle'         // Looking up at speaker, dramatic
  | 'dutch'             // Slightly tilted, energetic
  | 'wide'              // Full bodies with breathing room
  // Motion shots (have start + end positions, interpolated over duration)
  | 'dolly-in'          // Slow push from wide to medium on speaker
  | 'slow-orbit'        // Gentle arc around the scene
  | 'pull-back-reveal'; // Pull from speaker closeup to reveal both

interface ShotResult {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

interface MotionShotResult {
  start: ShotResult;
  end: ShotResult;
  duration: number; // seconds
}

/** Calculate a static camera shot */
function calcStaticShot(shotType: ShotType, peerId: string | null): ShotResult | null {
  const fwd = new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3(1, 0, 0);

  // ── Group shots (scoped to visible VRMs in current focus zone) ──
  if (!peerId || shotType === 'two-shot' || shotType === 'medium-two' || shotType === 'wide') {
    const visible = getVisibleVRMs();
    if (visible.size === 0) return null;
    let minX = Infinity, maxX = -Infinity;
    let sumZ = 0;
    for (const [, v] of visible) {
      minX = Math.min(minX, v.scene.position.x);
      maxX = Math.max(maxX, v.scene.position.x);
      sumZ += v.scene.position.z;
    }
    const count = visible.size;
    // Wider body padding for larger groups — characters have 3D volume
    const bodyW = count > 3 ? 0.8 : 0.6;
    const frameW = (maxX - minX) + bodyW * 2;
    const cx = (minX + maxX) / 2;
    const cz = sumZ / count;
    const hFov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);

    // Head-focused Y values derived from avatar height
    const headY = TARGET_VRM_HEIGHT * 0.85;   // ~eye level
    const chestY = TARGET_VRM_HEIGHT * 0.7;    // neck/chest
    const shoulderY = TARGET_VRM_HEIGHT * 0.75; // shoulders

    if (shotType === 'wide') {
      // Establishing shot — full bodies, generous breathing room
      const dist = Math.max(
        frameW / (2 * Math.tan(hFov / 2)),
        TARGET_VRM_HEIGHT / (2 * Math.tan((camera.fov * Math.PI) / 360))
      ) + 0.8;
      return { pos: new THREE.Vector3(cx, chestY, cz + dist), target: new THREE.Vector3(cx, shoulderY, cz) };
    }
    if (shotType === 'medium-two') {
      // Tighter: chest-up framing, camera at head height
      const dist = Math.max(
        frameW / (2 * Math.tan(hFov / 2)),
        (TARGET_VRM_HEIGHT * 0.55) / (2 * Math.tan((camera.fov * Math.PI) / 360))
      ) + 0.4;
      return { pos: new THREE.Vector3(cx, headY, cz + dist), target: new THREE.Vector3(cx, chestY, cz) };
    }
    // Default two-shot: upper-body framing, camera at shoulder height
    const dist = Math.max(
      frameW / (2 * Math.tan(hFov / 2)),
      TARGET_VRM_HEIGHT / (2 * Math.tan((camera.fov * Math.PI) / 360))
    ) + 0.6;
    return { pos: new THREE.Vector3(cx, shoulderY, cz + dist), target: new THREE.Vector3(cx, chestY, cz) };
  }

  // ── Single-character shots ──
  const vrm = bridgeVRMs.get(peerId);
  if (!vrm) return null;
  const { head, hips } = getVRMBones(vrm);

  switch (shotType) {
    case 'closeup': {
      // Face framing — head bone is at eye level, offset up slightly for forehead room
      const target = head.clone().add(new THREE.Vector3(0, 0.06, 0));
      const pos = target.clone().add(fwd.clone().multiplyScalar(1.05)).add(right.clone().multiplyScalar(0.05));
      return { pos, target };
    }
    case 'medium-single': {
      // Waist-up — the bread-and-butter dialogue shot
      const target = hips.clone().lerp(head, 0.55);
      const pos = target.clone().add(fwd.clone().multiplyScalar(1.4));
      return { pos, target };
    }
    case 'over-shoulder': {
      // Favored two-shot: camera on listener's side, speaker in focus
      const otherPid = getOtherPeerId(peerId);
      const listenerVrm = otherPid ? bridgeVRMs.get(otherPid) : null;
      if (!listenerVrm) {
        // Fallback to medium single if no other avatar
        const target = hips.clone().lerp(head, 0.6);
        return { pos: target.clone().add(fwd.clone().multiplyScalar(1.3)), target };
      }
      const listenerBones = getVRMBones(listenerVrm);
      // Position camera pulled back, offset toward listener's side
      // so listener is a foreground silhouette and speaker is framed center
      const sideDir = listenerBones.head.x - head.x; // direction from speaker to listener
      const camPos = new THREE.Vector3(
        listenerBones.head.x + Math.sign(sideDir) * 0.15,  // just past listener's shoulder
        head.y + 0.05,                                      // eye level
        1.5,                                                // pulled back for proper framing
      );
      // Look at speaker's face
      const target = head.clone().add(new THREE.Vector3(0, 0.02, 0));
      return { pos: camPos, target };
    }
    case 'low-angle': {
      // Hero shot: camera at knee level looking up — dramatic/powerful
      const target = hips.clone().lerp(head, 0.6);
      const pos = new THREE.Vector3(
        head.x + 0.1,    // slight offset for asymmetry
        0.25,             // knee height — truly looking up
        head.z + 1.4,     // pulled back for full framing
      );
      return { pos, target };
    }
    case 'dutch': {
      // Dutch angle: normal medium shot but camera will be tilted in animator
      const target = hips.clone().lerp(head, 0.45);
      const pos = target.clone()
        .add(fwd.clone().multiplyScalar(1.3))
        .add(right.clone().multiplyScalar(0.15));
      return { pos, target };
    }
    default:
      return null;
  }
}

/** Calculate a motion shot (returns start + end + duration) */
function calcMotionShot(shotType: ShotType, peerId: string | null): MotionShotResult | null {
  const cx = getSceneCenterX();

  switch (shotType) {
    case 'dolly-in': {
      // Start wide, slowly push to medium on the speaker — long cinematic push
      const start = calcStaticShot('two-shot', null);
      const end = peerId ? calcStaticShot('medium-single', peerId) : calcStaticShot('medium-two', null);
      if (!start || !end) return null;
      return { start, end, duration: 14 };
    }
    case 'slow-orbit': {
      // Gentle arc: start from front, sweep 25° to the right at chest height
      const radius = 2.8;
      const targetY = 1.05;  // chest/shoulder level
      const startAngle = 0;
      const endAngle = Math.PI / 7.2; // ~25°
      return {
        start: {
          pos: new THREE.Vector3(cx + Math.sin(startAngle) * radius, targetY, Math.cos(startAngle) * radius),
          target: new THREE.Vector3(cx, targetY, 0),
        },
        end: {
          pos: new THREE.Vector3(cx + Math.sin(endAngle) * radius, targetY + 0.06, Math.cos(endAngle) * radius),
          target: new THREE.Vector3(cx, targetY, 0),
        },
        duration: 20,
      };
    }
    case 'pull-back-reveal': {
      // Start tight on speaker, slowly pull back to reveal both
      const start = peerId ? calcStaticShot('closeup', peerId) : calcStaticShot('medium-two', null);
      const end = calcStaticShot('two-shot', null);
      if (!start || !end) return null;
      return { start, end, duration: 10 };
    }
    default:
      return null;
  }
}

// ── Shot Director ───────────────────────────────────────────────────
// Decides which shot to use and when to cut.

/** Shots used when a character is speaking */
const SPEAKER_SHOTS: ShotType[] = [
  'medium-single', 'closeup', 'over-shoulder', 'medium-single',
  'low-angle', 'dolly-in', 'medium-single', 'dutch',
];
/** Shots used when nobody is speaking (idle) */
const IDLE_SHOTS: ShotType[] = [
  'two-shot', 'medium-two', 'slow-orbit', 'wide', 'two-shot',
];
const MOTION_SHOT_TYPES = new Set<ShotType>(['dolly-in', 'slow-orbit', 'pull-back-reveal']);
const ALL_SHOT_TYPES = new Set<ShotType>([
  'two-shot',
  'medium-two',
  'closeup',
  'medium-single',
  'over-shoulder',
  'low-angle',
  'dutch',
  'wide',
  'dolly-in',
  'slow-orbit',
  'pull-back-reveal',
]);

function normalizeShotType(shot: string): ShotType | null {
  const normalized = (shot || '').trim().toLowerCase();
  if (!normalized) return null;
  return ALL_SHOT_TYPES.has(normalized as ShotType) ? (normalized as ShotType) : null;
}

let directorSpeakerIdx = 0;
let directorIdleIdx = 0;
let lastShotType: ShotType | null = null;
let lastDirectorCutAt = -Infinity;
let nextAutoDirectorAt = 0;

const SPEAKER_MIN_CUT_INTERVAL = 2.4; // seconds
const IDLE_MIN_CUT_INTERVAL = 4.2;    // seconds

function scheduleNextAutoDirection(now: number, hasSpeaker: boolean): void {
  const base = hasSpeaker ? 6.5 : 10.5;
  const jitter = hasSpeaker ? 3.5 : 4.5;
  nextAutoDirectorAt = now + base + Math.random() * jitter;
}

// ── Camera Animator State ───────────────────────────────────────────

const cam = {
  // Current interpolation targets (for static cut/lerp)
  targetPos: new THREE.Vector3(),
  targetLookAt: new THREE.Vector3(),
  isLerping: false,
  lerpSpeed: 1.2,  // slow cinematic default

  // Motion shot state
  isMotion: false,
  motionStart: { pos: new THREE.Vector3(), target: new THREE.Vector3() },
  motionEnd: { pos: new THREE.Vector3(), target: new THREE.Vector3() },
  motionDuration: 0,
  motionElapsed: 0,

  // Dutch angle
  dutchAngle: 0,       // current tilt in radians
  dutchTarget: 0,      // target tilt
};

/** Transition camera to a static shot (smooth lerp) */
function cutToShot(shot: ShotResult, speed?: number): void {
  cam.targetPos.copy(shot.pos);
  cam.targetLookAt.copy(shot.target);
  cam.isLerping = true;
  cam.isMotion = false;
  cam.lerpSpeed = speed ?? 1.2;
  cam.dutchTarget = 0;
}

/** Start a motion shot (interpolated over duration) */
function startMotionShot(motion: MotionShotResult): void {
  cam.isMotion = true;
  cam.isLerping = false;
  cam.motionStart.pos.copy(motion.start.pos);
  cam.motionStart.target.copy(motion.start.target);
  cam.motionEnd.pos.copy(motion.end.pos);
  cam.motionEnd.target.copy(motion.end.target);
  cam.motionDuration = motion.duration;
  cam.motionElapsed = 0;
  cam.dutchTarget = 0;
  // Snap to start immediately
  camera.position.copy(motion.start.pos);
  if (controls) {
    controls.target.copy(motion.start.target);
    controls.update();
  }
}

/** Apply an externally-directed cinematic shot from the Python orchestrator. */
function applyBridgeDirectedShot(
  shotRaw: string,
  peerId: string | null,
  holdSeconds?: number,
  force = false,
): void {
  const shotType = normalizeShotType(shotRaw);
  if (!shotType) {
    console.warn('[Camera] Ignoring unknown shot:', shotRaw);
    return;
  }

  const now = performance.now() * 0.001;
  const targetPeer = peerId && bridgeVRMs.has(peerId) ? peerId : null;
  const minInterval = targetPeer ? SPEAKER_MIN_CUT_INTERVAL * 0.55 : IDLE_MIN_CUT_INTERVAL * 0.55;
  if (!force && now - lastDirectorCutAt < minInterval) {
    return;
  }

  if (MOTION_SHOT_TYPES.has(shotType)) {
    const motion = calcMotionShot(shotType, targetPeer);
    if (motion) {
      startMotionShot(motion);
      lastShotType = shotType;
      lastDirectorCutAt = now;
      nextAutoDirectorAt = now + Math.max(1.2, holdSeconds ?? 4.0);
      console.log(`[Camera] Bridge motion: ${shotType} → peer=${targetPeer ?? 'none'}`);
      return;
    }
  }

  const shot = calcStaticShot(shotType, targetPeer);
  if (!shot) return;
  const speed =
    shotType === 'closeup' ? 0.72 :
    shotType === 'over-shoulder' ? 0.88 :
    shotType === 'wide' ? 0.75 : 1.0;
  cutToShot(shot, speed);
  cam.dutchTarget = shotType === 'dutch' ? 0.08 : 0;
  lastShotType = shotType;
  lastDirectorCutAt = now;
  nextAutoDirectorAt = now + Math.max(1.2, holdSeconds ?? 3.2);
  console.log(`[Camera] Bridge cut: ${shotType} → peer=${targetPeer ?? 'none'}`);
}

/** The director picks a shot based on context */
function directorPickShot(
  peerId: string | null,
  options: { force?: boolean; now?: number } = {}
): void {
  const now = options.now ?? performance.now() * 0.001;
  const force = options.force ?? false;
  const minInterval = peerId ? SPEAKER_MIN_CUT_INTERVAL : IDLE_MIN_CUT_INTERVAL;
  if (!force && now - lastDirectorCutAt < minInterval) {
    return;
  }

  if (peerId) {
    // Someone is speaking — cycle through speaker shots
    let shotType = SPEAKER_SHOTS[directorSpeakerIdx % SPEAKER_SHOTS.length];
    directorSpeakerIdx++;
    if (shotType === lastShotType && SPEAKER_SHOTS.length > 1) {
      shotType = SPEAKER_SHOTS[directorSpeakerIdx % SPEAKER_SHOTS.length];
      directorSpeakerIdx++;
    }

    if (MOTION_SHOT_TYPES.has(shotType)) {
      const motion = calcMotionShot(shotType, peerId);
      if (motion) {
        startMotionShot(motion);
        lastShotType = shotType;
        lastDirectorCutAt = now;
        scheduleNextAutoDirection(now, true);
        console.log(`[Camera] Motion: ${shotType} → peer=${peerId}`);
        return;
      }
    }

    const shot = calcStaticShot(shotType, peerId);
    if (shot) {
      // Closeup drifts in gently; other single shots moderate
      const speed = shotType === 'closeup' ? 0.7 : shotType === 'over-shoulder' ? 0.9 : 1.0;
      cutToShot(shot, speed);
      if (shotType === 'dutch') cam.dutchTarget = 0.08; // ~5° tilt
      lastShotType = shotType;
      lastDirectorCutAt = now;
      scheduleNextAutoDirection(now, true);
      console.log(`[Camera] Cut: ${shotType} → peer=${peerId}`);
      return;
    }
  } else {
    // Nobody speaking — cycle through idle shots
    const shotType = IDLE_SHOTS[directorIdleIdx % IDLE_SHOTS.length];
    directorIdleIdx++;

    if (MOTION_SHOT_TYPES.has(shotType)) {
      const motion = calcMotionShot(shotType, null);
      if (motion) {
        startMotionShot(motion);
        lastShotType = shotType;
        lastDirectorCutAt = now;
        scheduleNextAutoDirection(now, false);
        console.log(`[Camera] Motion: ${shotType} → idle`);
        return;
      }
    }

    const shot = calcStaticShot(shotType, null);
    if (shot) {
      cutToShot(shot, 0.8); // languid transitions for idle
      lastShotType = shotType;
      lastDirectorCutAt = now;
      scheduleNextAutoDirection(now, false);
      console.log(`[Camera] Cut: ${shotType} → idle`);
      return;
    }
  }

  // No valid shot found in this context — retry later.
  nextAutoDirectorAt = now + 2;
}

function updateDirector(now: number): void {
  if (now >= nextAutoDirectorAt) {
    directorPickShot(activeSpeakerPeerId, { now });
  }
}

/** Update camera each frame (called from render loop) */
function updateCamera(delta: number): void {
  if (cam.isMotion) {
    // Motion shot: interpolate from start to end over duration
    cam.motionElapsed += delta;
    const t = easeInOut(Math.min(1, cam.motionElapsed / cam.motionDuration));
    camera.position.lerpVectors(cam.motionStart.pos, cam.motionEnd.pos, t);
    if (controls) {
      controls.target.lerpVectors(cam.motionStart.target, cam.motionEnd.target, t);
      controls.update();
    }
    if (cam.motionElapsed >= cam.motionDuration) {
      cam.isMotion = false;
      // Hold on the end frame
      cam.targetPos.copy(cam.motionEnd.pos);
      cam.targetLookAt.copy(cam.motionEnd.target);
    }
  } else if (cam.isLerping && controls) {
    // Static shot: smooth lerp toward target
    const t = Math.min(1.0, cam.lerpSpeed * delta);
    camera.position.lerp(cam.targetPos, t);
    controls.target.lerp(cam.targetLookAt, t);
    controls.update();
    if (camera.position.distanceTo(cam.targetPos) < 0.001) {
      cam.isLerping = false;
    }
  }

  // Dutch angle (tilt) — smoothly approach target
  const dutchDelta = (cam.dutchTarget - cam.dutchAngle) * Math.min(1, 1.5 * delta);
  cam.dutchAngle += dutchDelta;
  camera.rotation.z = cam.dutchAngle;
}

// ── Gaffer (Lighting) ───────────────────────────────────────────────
// Key light subtly tracks the active speaker.

const gafferTargetPos = new THREE.Vector3();

function updateGaffer(delta: number): void {
  const now = performance.now() * 0.001;
  const speakerVrm = activeSpeakerPeerId ? bridgeVRMs.get(activeSpeakerPeerId) : null;
  const hasSpeaker = !!speakerVrm;

  const targetX = speakerVrm ? speakerVrm.scene.position.x + 2 : 3;
  gafferTargetPos.set(targetX, 5, hasSpeaker ? 2.8 : 3);
  const blend = Math.min(1, delta * 2.2);
  keyLight.position.lerp(gafferTargetPos, blend);

  const pulse = hasSpeaker ? 1 + Math.sin(now * 2.2) * 0.05 : 1;
  const keyTarget = (hasSpeaker ? 1.55 : 1.35) * pulse;
  const fillTarget = hasSpeaker ? 0.76 : 0.82;
  const rimTarget = hasSpeaker ? 0.68 : 0.58;
  keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, keyTarget, blend);
  fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, fillTarget, blend);
  rimLight.intensity = THREE.MathUtils.lerp(rimLight.intensity, rimTarget, blend);
}

/** Set background from an image URL — handles CORS via fetch+blob fallback */
function setSceneBackground(url: string): void {
  if (!url) return;
  console.log('[PoseLab] Loading background:', url.slice(0, 80));

  // Try direct TextureLoader first (works for same-origin / CORS-enabled CDNs)
  bgTextureLoader.load(
    url,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      scene.background = texture;
      console.log('[PoseLab] Background applied (direct):', url.slice(0, 60));
    },
    undefined,
    (_err) => {
      // Direct load failed (likely CORS) — try fetch+blob workaround
      console.log('[PoseLab] Direct load failed, trying fetch+blob for:', url.slice(0, 60));
      fetch(url, { mode: 'cors' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          bgTextureLoader.load(blobUrl, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            scene.background = texture;
            URL.revokeObjectURL(blobUrl);
            console.log('[PoseLab] Background applied (blob):', url.slice(0, 60));
          });
        })
        .catch((err2) => {
          console.warn('[PoseLab] Background load failed entirely:', url.slice(0, 60), err2);
        });
    }
  );
}

/** Shared VRM loader for bridge avatar_load messages */
async function loadVRMFromUrl(url: string): Promise<VRM> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch VRM (${res.status})`);
  const buf = await res.arrayBuffer();
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buf, '');
  return gltf.userData.vrm as VRM;
}

/** Crossfade body animation for a bridge-managed peer */
async function crossfadeEmotion(peerId: string, emotion: string): Promise<void> {
  const vrm = bridgeVRMs.get(peerId);
  if (!vrm) return;

  const animUrl = EMOTION_ANIMATIONS[emotion] ?? EMOTION_ANIMATIONS.neutral;
  if (!animUrl) return;

  // Check if emotion actually changed
  if (bridgeEmotions.get(peerId) === emotion) return;
  bridgeEmotions.set(peerId, emotion);

  let m = bridgeMixers.get(peerId);
  if (!m) {
    m = new THREE.AnimationMixer(vrm.scene);
    bridgeMixers.set(peerId, m);
  }

  try {
    // Get or fetch animation clip
    let clip = animClipCache.get(animUrl);
    if (!clip) {
      const res = await fetch(animUrl);
      if (!res.ok) {
        console.warn(`[PoseLab] Failed to fetch emotion animation ${animUrl}: ${res.status}`);
        return;
      }
      const buf = await res.arrayBuffer();
      const fileName = animUrl.split('/').pop() || 'animation.fbx';
      const result = await applyMixamoBuffer(buf, fileName, vrm);
      clip = result.animationClip;
      stripRootYMotion(clip);
      animClipCache.set(animUrl, clip);
    }

    // Crossfade from current action to new one
    const oldAction = bridgeActions.get(peerId);
    const newAction = m.clipAction(clip);
    newAction.loop = THREE.LoopRepeat;

    if (oldAction && oldAction !== newAction) {
      newAction.reset();
      newAction.play();
      oldAction.fadeOut(0.3);
      newAction.fadeIn(0.3);
    } else if (!oldAction) {
      newAction.reset();
      newAction.play();
    }
    bridgeActions.set(peerId, newAction);
    console.log(`[PoseLab] Emotion animation: peer=${peerId} emotion=${emotion}`);
  } catch (err) {
    console.warn(`[PoseLab] Failed to crossfade emotion for ${peerId}:`, err);
  }
}

/** Crossfade a peer to a specific animation URL (for listener reactions) */
async function crossfadeToUrl(peerId: string, animUrl: string): Promise<void> {
  const vrm = bridgeVRMs.get(peerId);
  if (!vrm) return;

  // Skip if already playing this animation
  const currentEmotion = bridgeEmotions.get(peerId);
  if (currentEmotion === animUrl) return;
  bridgeEmotions.set(peerId, animUrl);

  let m = bridgeMixers.get(peerId);
  if (!m) {
    m = new THREE.AnimationMixer(vrm.scene);
    bridgeMixers.set(peerId, m);
  }

  try {
    let clip = animClipCache.get(animUrl);
    if (!clip) {
      const res = await fetch(animUrl);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const fileName = animUrl.split('/').pop() || 'animation.fbx';
      const result = await applyMixamoBuffer(buf, fileName, vrm);
      clip = result.animationClip;
      stripRootYMotion(clip);
      animClipCache.set(animUrl, clip);
    }

    const oldAction = bridgeActions.get(peerId);
    const newAction = m.clipAction(clip);
    newAction.loop = THREE.LoopRepeat;

    if (oldAction && oldAction !== newAction) {
      newAction.reset();
      newAction.play();
      oldAction.fadeOut(0.5);
      newAction.fadeIn(0.5);
    } else if (!oldAction) {
      newAction.reset();
      newAction.play();
    }
    bridgeActions.set(peerId, newAction);
  } catch {
    // Silently ignore listener reaction failures
  }
}

/** Snap camera instantly to a two-shot (used on avatar load) */
function snapCameraToTwoShot(): void {
  const shot = calcStaticShot('two-shot', null);
  if (!shot) return;
  camera.position.copy(shot.pos);
  if (controls) {
    controls.target.copy(shot.target);
    controls.update();
  }
  cam.targetPos.copy(shot.pos);
  cam.targetLookAt.copy(shot.target);
  cam.isLerping = false;
  cam.isMotion = false;
  console.log('[Camera] Snap: two-shot');
}

// Register as WS bridge delegate so bridge commands control THIS scene
registerDelegate({
  async loadAvatar(peerId: string, url: string, _displayName: string, position?: { x: number; y: number; z: number }) {
    // Remove old avatar for this peer
    const old = bridgeVRMs.get(peerId);
    if (old) {
      scene.remove(old.scene);
      old.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      bridgeVRMs.delete(peerId);
      const oldMixer = bridgeMixers.get(peerId);
      if (oldMixer) oldMixer.stopAllAction();
      bridgeMixers.delete(peerId);
    }

    const vrm = await loadVRMFromUrl(url);
    bridgeVRMs.set(peerId, vrm);

    // VRM models face -Z by default; camera is at +Z looking toward origin.
    // Rotate 180° around Y so models face the camera.
    vrm.scene.rotation.y = Math.PI;

    // ── Height normalization using humanoid bones ──────────────────
    // Bounding box can include stray geometry (accessories, floor planes),
    // so we use the skeleton's head + foot bones for accurate measurements.
    vrm.scene.updateMatrixWorld(true);

    const headBone = vrm.humanoid?.getNormalizedBoneNode('head');
    const leftFootBone = vrm.humanoid?.getNormalizedBoneNode('leftFoot');
    const rightFootBone = vrm.humanoid?.getNormalizedBoneNode('rightFoot');
    const leftToesBone = vrm.humanoid?.getNormalizedBoneNode('leftToes');
    const rightToesBone = vrm.humanoid?.getNormalizedBoneNode('rightToes');

    let charHeight: number;
    let groundLevel: number;

    if (headBone && (leftFootBone || rightFootBone)) {
      const headPos = new THREE.Vector3();
      headBone.getWorldPosition(headPos);

      // Use foot bones for height measurement
      const footPos = new THREE.Vector3();
      if (leftFootBone && rightFootBone) {
        const lp = new THREE.Vector3();
        const rp = new THREE.Vector3();
        leftFootBone.getWorldPosition(lp);
        rightFootBone.getWorldPosition(rp);
        footPos.copy(lp.y < rp.y ? lp : rp);
      } else {
        (leftFootBone || rightFootBone)!.getWorldPosition(footPos);
      }

      // Head bone is at roughly eye level — add 10% for top of skull
      charHeight = (headPos.y - footPos.y) * 1.1;

      // For ground level, use the LOWEST available bone (toes > feet)
      // Foot bones are at the ankle — toes are closer to the actual sole
      let lowestY = footPos.y;
      for (const toeBone of [leftToesBone, rightToesBone]) {
        if (toeBone) {
          const tp = new THREE.Vector3();
          toeBone.getWorldPosition(tp);
          if (tp.y < lowestY) lowestY = tp.y;
        }
      }
      groundLevel = lowestY;

      // Cross-check with bounding box: if geometry extends below bones, use bbox min
      const bboxCheck = new THREE.Box3().setFromObject(vrm.scene);
      if (bboxCheck.min.y < groundLevel) {
        // Use bbox bottom but only if the difference is reasonable (< 30% of height)
        const delta = groundLevel - bboxCheck.min.y;
        if (delta < charHeight * 0.3) {
          console.log(`[PoseLab] Avatar ${peerId} bbox lower than bones by ${delta.toFixed(3)} — using bbox ground`);
          groundLevel = bboxCheck.min.y;
        }
      }

      console.log(`[PoseLab] Avatar ${peerId} bones: head.y=${headPos.y.toFixed(3)} foot.y=${footPos.y.toFixed(3)} ground.y=${groundLevel.toFixed(3)} charH=${charHeight.toFixed(3)} hasToes=${!!(leftToesBone || rightToesBone)}`);
    } else {
      // Fallback to bounding box if bones not found
      const rawBox = new THREE.Box3().setFromObject(vrm.scene);
      charHeight = rawBox.max.y - rawBox.min.y;
      groundLevel = rawBox.min.y;
      console.log(`[PoseLab] Avatar ${peerId} bbox fallback: minY=${rawBox.min.y.toFixed(3)} maxY=${rawBox.max.y.toFixed(3)}`);
    }

    let appliedScale = 1;
    if (charHeight > 0) {
      appliedScale = TARGET_VRM_HEIGHT / charHeight;
      vrm.scene.scale.setScalar(appliedScale);
    }

    // Align feet to ground plane (y=0)
    vrm.scene.position.y = -(groundLevel * appliedScale);
    bridgeGroundY.set(peerId, vrm.scene.position.y);

    console.log(`[PoseLab] Avatar ${peerId}: charH=${charHeight.toFixed(2)} scale=${appliedScale.toFixed(3)} groundLvl=${groundLevel.toFixed(3)} posY=${vrm.scene.position.y.toFixed(3)}`);

    // Enable shadow casting on all avatar meshes
    vrm.scene.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
      }
    });

    scene.add(vrm.scene);

    // Assign home position: use provided position (from room system) or fall back to semi-circle layout
    let homePos: THREE.Vector3;
    if (position) {
      homePos = new THREE.Vector3(position.x, 0, position.z);
      console.log(`[PoseLab] Using ROOM position for ${peerId}: (${position.x}, ${position.z})`);
    } else {
      homePos = HOME_POSITIONS[nextHomeIndex % HOME_POSITIONS.length];
      nextHomeIndex++;
      console.log(`[PoseLab] Using DEFAULT home position for ${peerId}: (${homePos.x.toFixed(1)}, ${homePos.z.toFixed(1)})`);
    }
    bridgeHomePositions.set(peerId, homePos.clone());
    vrm.scene.position.x = homePos.x;
    vrm.scene.position.z = homePos.z;

    // Snap camera immediately on avatar load (no slow lerp)
    const count = bridgeVRMs.size;
    snapCameraToTwoShot();
    console.log(`[PoseLab] Bridge loaded avatar: peer=${peerId} url=${url} home=(${homePos.x.toFixed(1)},${homePos.z.toFixed(1)}) (${count} total)`);

    // Load idle animation — each avatar gets a different one for variety
    try {
      const idleUrl = IDLE_POOL[idlePoolIndex % IDLE_POOL.length];
      idlePoolIndex++;
      const fileName = idleUrl.split('/').pop() || 'Happy Idle.fbx';
      let clip = animClipCache.get(idleUrl);
      if (!clip) {
        const animRes = await fetch(idleUrl);
        if (animRes.ok) {
          const animBuf = await animRes.arrayBuffer();
          const result = await applyMixamoBuffer(animBuf, fileName, vrm);
          clip = result.animationClip;
          stripRootYMotion(clip);
          animClipCache.set(idleUrl, clip);
        }
      }
      if (clip) {
        const m = new THREE.AnimationMixer(vrm.scene);
        const action = m.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        action.play();
        bridgeMixers.set(peerId, m);
        bridgeActions.set(peerId, action);
        bridgeEmotions.set(peerId, 'neutral');
        console.log(`[PoseLab] Idle animation: peer=${peerId} anim=${fileName}`);
      }
    } catch (err) {
      console.warn(`[PoseLab] Failed to load idle animation for peer=${peerId}:`, err);
    }
  },

  removeAvatar(peerId: string) {
    const vrm = bridgeVRMs.get(peerId);
    if (!vrm) return;
    scene.remove(vrm.scene);
    vrm.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
    bridgeVRMs.delete(peerId);
    const m = bridgeMixers.get(peerId);
    if (m) m.stopAllAction();
    bridgeMixers.delete(peerId);
    bridgeActions.delete(peerId);
    bridgeEmotions.delete(peerId);
    bridgeGroundY.delete(peerId);
    blinkStates.delete(peerId);
    performanceStates.delete(peerId);
    bridgeHomePositions.delete(peerId);
    movementStates.delete(peerId);
    faceTargets.delete(peerId);
    directorPickShot(null, { force: true });
    console.log(`[PoseLab] Bridge removed avatar: peer=${peerId}`);
  },

  getVRM(peerId: string): VRM | null {
    return bridgeVRMs.get(peerId) ?? null;
  },

  setEmotion(peerId: string, emotion: string) {
    // Speaker gets the emotion animation
    void crossfadeEmotion(peerId, emotion);

    // Non-speakers in the same room react to the speaker's emotion
    const reactionUrl = LISTENER_REACTIONS[emotion] ?? LISTENER_REACTIONS.neutral;
    if (reactionUrl) {
      const visible = getVisibleVRMs();
      for (const [pid] of visible) {
        if (pid !== peerId && pid !== activeSpeakerPeerId) {
          void crossfadeToUrl(pid, reactionUrl);
        }
      }
    }
  },

  performGesture(peerId: string, gesture: string, intensity = 1.0) {
    const vrm = bridgeVRMs.get(peerId);
    if (!vrm || !vrm.humanoid) return;
    const stableVrm: VRM = vrm;
    const humanoid = stableVrm.humanoid;

    const gestureData = GESTURE_LIBRARY[gesture];
    if (!gestureData) {
      console.warn(`[PoseLab] Unknown gesture: ${gesture}`);
      return;
    }

    // Collect all bones referenced in the gesture
    const boneNames = new Set<string>();
    gestureData.keyframes.forEach(kf => {
      Object.keys(kf.bones).forEach(b => boneNames.add(b));
    });

    // Capture initial rotations
    const initialRotations = new Map<string, THREE.Quaternion>();
    boneNames.forEach(name => {
      const node = humanoid.getNormalizedBoneNode(name as any);
      if (node) initialRotations.set(name, node.quaternion.clone());
    });

    const startTime = performance.now();
    const durationMs = gestureData.duration * 1000;

    // Animate via requestAnimationFrame
    function animateGesture() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);

      // Find surrounding keyframes
      const keyframes = gestureData.keyframes;
      let kfIdx = 0;
      for (let i = 0; i < keyframes.length - 1; i++) {
        if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
          kfIdx = i;
          break;
        }
        if (i === keyframes.length - 2) kfIdx = i;
      }

      const kfA = keyframes[kfIdx];
      const kfB = keyframes[Math.min(kfIdx + 1, keyframes.length - 1)];
      const segDur = kfB.time - kfA.time;
      const segT = segDur > 0 ? Math.min((progress - kfA.time) / segDur, 1.0) : 1.0;

      // Apply easing
      const easingFn = kfB.easing ? Easing[kfB.easing] : Easing.easeInOut;
      const easedT = typeof easingFn === 'function' ? easingFn(segT) : segT;

      // Interpolate bone rotations
      boneNames.forEach(name => {
        const node = humanoid.getNormalizedBoneNode(name as any);
        if (!node) return;
        const initial = initialRotations.get(name);
        if (!initial) return;

        const boneA = kfA.bones[name as keyof typeof kfA.bones] || { x: 0, y: 0, z: 0 };
        const boneB = kfB.bones[name as keyof typeof kfB.bones] || boneA;

        const euler = new THREE.Euler(
          THREE.MathUtils.degToRad((boneA.x + (boneB.x - boneA.x) * easedT) * intensity),
          THREE.MathUtils.degToRad((boneA.y + (boneB.y - boneA.y) * easedT) * intensity),
          THREE.MathUtils.degToRad((boneA.z + (boneB.z - boneA.z) * easedT) * intensity),
        );
        const targetQuat = new THREE.Quaternion().setFromEuler(euler);
        const finalQuat = initial.clone().multiply(targetQuat);
        node.quaternion.copy(finalQuat);
      });

      stableVrm.scene.updateMatrixWorld(true);

      if (progress < 1.0) {
        requestAnimationFrame(animateGesture);
      }
    }

    requestAnimationFrame(animateGesture);
    console.log(`[PoseLab] Gesture: peer=${peerId} gesture=${gesture} intensity=${intensity}`);
  },

  playAnimation(peerId: string, url: string, loop = true) {
    void crossfadeToUrl(peerId, url);
    // If non-looping requested, schedule stop after a reasonable duration
    if (!loop) {
      setTimeout(() => {
        void crossfadeToUrl(peerId, IDLE_POOL[0]);
      }, 3000);
    }
    console.log(`[PoseLab] Play animation: peer=${peerId} url=${url} loop=${loop}`);
  },

  onSpeaking(peerId: string, active: boolean) {
    if (active) {
      const speakerChanged = activeSpeakerPeerId !== peerId;
      activeSpeakerPeerId = peerId;
      directorPickShot(peerId, { force: speakerChanged });
      // Turn-to-face: only room-mates face the speaker
      const visible = getVisibleVRMs();
      for (const [pid] of visible) {
        if (pid !== peerId) {
          faceTargets.set(pid, peerId);
        }
      }
      // Speaker faces closest visible avatar
      let closestPid: string | null = null;
      let closestDist = Infinity;
      const speakerVrm = bridgeVRMs.get(peerId);
      if (speakerVrm) {
        for (const [pid, v] of visible) {
          if (pid === peerId) continue;
          const d = speakerVrm.scene.position.distanceTo(v.scene.position);
          if (d < closestDist) {
            closestDist = d;
            closestPid = pid;
          }
        }
      }
      faceTargets.set(peerId, closestPid);
    } else if (activeSpeakerPeerId === peerId) {
      activeSpeakerPeerId = null;
      directorPickShot(null, { force: true });
      // Clear all face targets — return to camera-facing
      faceTargets.clear();
      // Return visible room-mate characters to calm idle
      const visible = getVisibleVRMs();
      for (const [pid] of visible) {
        void crossfadeToUrl(pid, IDLE_POOL[0]);
      }
    }
  },

  setBackground(url: string) {
    setSceneBackground(url);
  },

  moveTo(peerId: string, targetPeerId: string | null, position: { x: number; y: number; z: number } | null) {
    if (targetPeerId) {
      const targetVrm = bridgeVRMs.get(targetPeerId);
      if (targetVrm) {
        // Walk toward target but stop 1m short
        const tp = targetVrm.scene.position;
        const sp = bridgeVRMs.get(peerId)?.scene.position;
        if (sp) {
          const dx = tp.x - sp.x;
          const dz = tp.z - sp.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const stopDist = Math.max(0, dist - 1.0);
          const ratio = dist > 0 ? stopDist / dist : 0;
          void startMovement(peerId, new THREE.Vector3(
            sp.x + dx * ratio,
            0,
            sp.z + dz * ratio,
          ));
        }
      }
    } else if (position) {
      void startMovement(peerId, new THREE.Vector3(position.x, 0, position.z));
    }
  },

  goHome(peerId: string) {
    const home = bridgeHomePositions.get(peerId);
    if (home) {
      void startMovement(peerId, home);
    }
  },

  setEnvironment(preset: string) {
    loadHDRIEnvironment(preset);
  },

  setPostProcessing(preset: string) {
    useSceneSettingsStore.getState().setPostPreset(resolvePostPresetForScene(preset));
  },

  setCameraRoom(roomId: string, zoneCenter: { x: number; z: number }, hdri?: string) {
    // Update focus zone — shot calculations will only consider avatars near this zone
    focusZoneCenter = new THREE.Vector3(zoneCenter.x, 0, zoneCenter.z);

    // Smooth camera transition to room zone center — target head height
    const headY = TARGET_VRM_HEIGHT * 0.85;
    const shoulderY = TARGET_VRM_HEIGHT * 0.75;
    const targetPos = new THREE.Vector3(
      zoneCenter.x,
      headY,
      zoneCenter.z + 3.0,
    );
    const targetLookAt = new THREE.Vector3(
      zoneCenter.x,
      shoulderY,
      zoneCenter.z,
    );
    cam.targetPos.copy(targetPos);
    cam.targetLookAt.copy(targetLookAt);
    cam.isLerping = true;
    cam.isMotion = false;
    cam.lerpSpeed = 0.8; // Slow cinematic pan
    cam.dutchTarget = 0;

    // Switch HDRI for room mood
    if (hdri) {
      loadHDRIEnvironment(hdri);
    }
    console.log(`[PoseLab] setCameraRoom: ${roomId} center=(${zoneCenter.x}, ${zoneCenter.z}) hdri=${hdri ?? 'none'}`);
  },

  setCameraShot(shot: string, peerId?: string | null, holdSeconds?: number, force?: boolean) {
    applyBridgeDirectedShot(shot, peerId ?? null, holdSeconds, !!force);
  },
});

// Animation mixer for playback
let mixer: THREE.AnimationMixer | null = null;
let currentAction: THREE.AnimationAction | null = null;

type CaptureModeConfig = {
  enabled: boolean;
  width: number;
  height: number;
};

const _TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const _parsePositiveInt = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const _readCaptureModeConfig = (): CaptureModeConfig => {
  const params = new URLSearchParams(window.location.search);
  const captureRaw = (params.get('capture') || '').trim().toLowerCase();
  const enabled = _TRUE_VALUES.has(captureRaw);
  const defaultW = Math.max(1, window.innerWidth || 960);
  const defaultH = Math.max(1, window.innerHeight || 540);
  const width = (
    _parsePositiveInt(params.get('w')) ||
    _parsePositiveInt(params.get('width')) ||
    defaultW
  );
  const height = (
    _parsePositiveInt(params.get('h')) ||
    _parsePositiveInt(params.get('height')) ||
    defaultH
  );
  return { enabled, width, height };
};

function PoseLab() {
  const captureModeRef = useRef<CaptureModeConfig>(_readCaptureModeConfig());
  const isCaptureMode = captureModeRef.current.enabled;
  const { currentUrl, avatarType, setRemoteUrl } = useAvatarSource();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const animationClipRef = useRef<THREE.AnimationClip | null>(null);
  const [status, setStatus] = useState('🎭 Drag & drop a VRM file to begin');
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [isDraggingVRM, setIsDraggingVRM] = useState(false);
  const [isDraggingFBX, setIsDraggingFBX] = useState(false);
  const [currentAnimationClip, setCurrentAnimationClip] = useState<THREE.AnimationClip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isVRMLoaded, setIsVRMLoaded] = useState(false);
  const clockRef = useRef(new THREE.Clock());
  const isPlayingRef = useRef(false); // Ref for render loop access
  const autoLoadRequestedRef = useRef(false);
  const isLoadingVRMRef = useRef(false);
  const autoAnimationRequestedRef = useRef(false);
  const isLoadingAnimationRef = useRef(false);

  const resolveAutoVRMUrl = (): string => {
    const params = new URLSearchParams(window.location.search);
    const explicit = (
      params.get('vrm') ||
      params.get('vrmUrl') ||
      params.get('vrm_url') ||
      params.get('avatarUrl') ||
      params.get('avatar_url') ||
      ''
    ).trim();
    return explicit || DEFAULT_VRM_URL;
  };

  const resolveAutoAnimationUrl = (): string => {
    const params = new URLSearchParams(window.location.search);
    const explicitRaw = (
      params.get('anim') ||
      params.get('animation') ||
      params.get('animationUrl') ||
      params.get('animation_url') ||
      params.get('fbx') ||
      ''
    ).trim();

    if (explicitRaw) {
      const lower = explicitRaw.toLowerCase();
      if (lower === '0' || lower === 'off' || lower === 'false' || lower === 'none') {
        return '';
      }
      return explicitRaw;
    }

    return mixamoSources.happyIdle;
  };

  const inferAnimationFileName = (url: string): string => {
    try {
      const withoutQuery = url.split('?')[0];
      const rawName = withoutQuery.split('/').pop() || 'animation.fbx';
      const decodedName = decodeURIComponent(rawName);
      if (/\.(fbx|gltf|glb)$/i.test(decodedName)) {
        return decodedName;
      }
      return `${decodedName}.fbx`;
    } catch {
      return 'animation.fbx';
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const captureCfg = captureModeRef.current;
    const canvasWidth = isCaptureMode ? captureCfg.width : 960;
    const canvasHeight = isCaptureMode ? captureCfg.height : 540;

    renderer.setSize(canvasWidth, canvasHeight);
    camera.aspect = canvasWidth / Math.max(1, canvasHeight);
    camera.updateProjectionMatrix();

    canvasRef.current.innerHTML = '';
    canvasRef.current.appendChild(renderer.domElement);
    
    // Initialize OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enablePan = true;
    controls.enableDamping = true;
    controls.minDistance = 0.3;
    controls.maxDistance = 10;
    
    // Start render loop
    const animate = () => {
      const delta = clockRef.current.getDelta();
      controls?.update();

      // Update VRM (local drag-drop loaded)
      if (vrmRef.current) {
        vrmRef.current.update(delta);
      }

      // Update bridge-managed VRMs and their animation mixers
      const elapsed = clockRef.current.elapsedTime;
      const now = elapsed;
      for (const [pid, vrm] of bridgeVRMs) {
        vrm.update(delta);
        const m = bridgeMixers.get(pid);
        if (m) m.update(delta);

        // Movement system: walk interpolation
        updateMovement(pid, vrm, delta);
        // Turn-to-face system: smooth rotation toward speaker
        updateFaceTarget(pid, vrm, delta);

        // Life systems: blink + breathing sway (layered on top of animations)
        updateBlink(pid, vrm, now, delta);
        updateBreathingSway(vrm, elapsed, pid);
        updateIntentionality(pid, vrm, elapsed, delta);

        // Lock ground Y — animation root motion can push models off the ground
        const lockedY = bridgeGroundY.get(pid);
        if (lockedY !== undefined) {
          vrm.scene.position.y = lockedY;
        }
      }

      // Update animation mixer
      if (mixer && isPlayingRef.current) {
        mixer.update(delta);
      }

      // Camera animator + gaffer
      updateDirector(now);
      updateCamera(delta);
      updateGaffer(delta);

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();
    
    return () => {
      controls?.dispose();
    };
  }, [isCaptureMode]);

  // Auto-load avatar from main app
  useEffect(() => {
    if (avatarType === 'vrm' && currentUrl && !vrmRef.current) {
        loadVRM(currentUrl);
    }
  }, [avatarType, currentUrl]);

  const loadVRM = async (source: File | string, _options?: { syncSource?: boolean }) => {
    if (isLoadingVRMRef.current) return;
    isLoadingVRMRef.current = true;
    autoAnimationRequestedRef.current = false;
    setIsVRMLoaded(false);
    setStatus('Loading VRM…');

    try {
      // Dispose of old VRM if exists
      if (vrmRef.current) {
        console.log('[PoseLab] Disposing old VRM');
        scene.remove(vrmRef.current.scene);
        vrmRef.current.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat) => mat.dispose());
            } else {
              obj.material?.dispose();
            }
          }
        });
        vrmRef.current = null;
      }

      let arrayBuffer: ArrayBuffer;
      if (typeof source === 'string') {
        const res = await fetch(source);
        if (!res.ok) {
          throw new Error(`Failed to fetch VRM (${res.status})`);
        }
        arrayBuffer = await res.arrayBuffer();
      } else {
        arrayBuffer = await source.arrayBuffer();
      }

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await loader.parseAsync(arrayBuffer, '');
      const vrm = gltf.userData.vrm as VRM;
      vrmRef.current = vrm;

      // NOTE: Standard VRM faces -Z; camera is at +Z. Most models need a
      // 180° Y-rotation, but custom models (e.g. snarkle) may already face
      // the camera. Controlled via ?flip=1 URL param (default: no flip).
      const params = new URLSearchParams(window.location.search);
      const flipRaw = (params.get('flip') || '0').trim().toLowerCase();
      if (_TRUE_VALUES.has(flipRaw)) {
        vrm.scene.rotation.set(0, THREE.MathUtils.degToRad(180), 0);
      }

      scene.add(vrm.scene);

      // Auto-frame: shift model so its center sits at the scene origin,
      // then position camera to frame it nicely.
      const box = new THREE.Box3().setFromObject(vrm.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // Shift model so bounding-box center is at world origin
      vrm.scene.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360)) + 0.3;
      camera.position.set(0, 0, dist);
      if (controls) {
        controls.target.set(0, 0, 0);
        controls.minDistance = dist * 0.4;
        controls.maxDistance = dist * 4;
        controls.update();
      }

      setIsVRMLoaded(true);
      setStatus('✅ VRM loaded! Now drop an FBX/GLTF animation.');
      renderer.render(scene, camera);
    } catch (error) {
      console.error('[PoseLab] Failed to load VRM:', error);
      setStatus(`❌ Failed to load VRM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isLoadingVRMRef.current = false;
    }
  };

  const loadAnimationFromUrl = async (animationUrl: string) => {
    if (isLoadingAnimationRef.current) return;
    if (!vrmRef.current) return;

    isLoadingAnimationRef.current = true;
    setStatus('Loading animation…');
    try {
      const response = await fetch(animationUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch animation (${response.status})`);
      }

      const buffer = await response.arrayBuffer();
      const fileName = inferAnimationFileName(animationUrl);
      const { animationClip } = await applyMixamoBuffer(buffer, fileName, vrmRef.current);
      animationClipRef.current = animationClip;
      setCurrentAnimationClip(animationClip);
      initializeAnimation(animationClip);
      setStatus(`✅ VRM + animation loaded (${fileName})`);
    } catch (error) {
      console.error('[PoseLab] Failed to auto-load animation:', error);
      setStatus(`⚠️ VRM loaded, animation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isLoadingAnimationRef.current = false;
    }
  };

  // Headless/browser-capture startup path:
  // load a VRM automatically from query params or default public model.
  // Skip when WS bridge is active (?ws= param) — the bridge sends avatar_load messages.
  useEffect(() => {
    if (autoLoadRequestedRef.current) return;
    if (avatarType === 'vrm' && currentUrl) return;
    if (vrmRef.current) return;

    // When WS bridge is active, avatars are managed by the Python orchestrator
    const params = new URLSearchParams(window.location.search);
    if (params.get('ws')) return;

    const autoUrl = resolveAutoVRMUrl();
    if (!autoUrl) return;

    autoLoadRequestedRef.current = true;
    // Load immediately for headless/browser-capture startup and also keep
    // shared avatar source state in sync for the rest of the app.
    void loadVRM(autoUrl);
    setRemoteUrl(autoUrl, 'Auto VRM');
  }, [avatarType, currentUrl, setRemoteUrl]);

  // Headless/browser-capture startup path:
  // auto-load a default animation (or query-provided one) once VRM is ready.
  // Skip when WS bridge is active — bridge avatars use expression presets, not Mixamo.
  useEffect(() => {
    if (!isVRMLoaded) return;
    if (!vrmRef.current) return;
    if (autoAnimationRequestedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('ws')) return;

    const autoAnimUrl = resolveAutoAnimationUrl();
    if (!autoAnimUrl) return;

    autoAnimationRequestedRef.current = true;
    void loadAnimationFromUrl(autoAnimUrl);
  }, [isVRMLoaded]);

  const retarget = async (file: File) => {
    if (!vrmRef.current) {
      setStatus('Load a VRM first.');
      return;
    }

    setStatus('Loading Mixamo pose…');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { animationClip } = await applyMixamoBuffer(arrayBuffer, file.name, vrmRef.current);
      animationClipRef.current = animationClip;
      setCurrentAnimationClip(animationClip);
      
      // Initialize mixer and start playing
      initializeAnimation(animationClip);
      
      setStatus('✅ Animation loaded! Use controls to preview.');
    } catch (error) {
      console.error('Retarget error:', error);
      setStatus(`Retarget failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const initializeAnimation = (clip: THREE.AnimationClip) => {
    const vrm = vrmRef.current;
    if (!vrm) {
      console.error('[PoseLab] Cannot initialize animation: VRM not loaded');
      return;
    }

    console.log('[PoseLab] Initializing animation:', clip.name, 'duration:', clip.duration);

    // Create or reset mixer
    if (mixer) {
      mixer.stopAllAction();
    }
    mixer = new THREE.AnimationMixer(vrm.scene);
    
    // Create action
    currentAction = mixer.clipAction(clip);
    currentAction.loop = isLooping ? THREE.LoopRepeat : THREE.LoopOnce;
    currentAction.clampWhenFinished = true;
    currentAction.play();
    
    console.log('[PoseLab] Animation started, isPlaying:', true);
    
    isPlayingRef.current = true;
    setIsPlaying(true);
  };

  const handlePlayPause = () => {
    if (!currentAction) return;
    
    if (isPlaying) {
      currentAction.paused = true;
      isPlayingRef.current = false;
      setIsPlaying(false);
      setStatus('⏸️ Animation paused');
    } else {
      currentAction.paused = false;
      isPlayingRef.current = true;
      setIsPlaying(true);
      setStatus('▶️ Animation playing');
    }
  };

  const handleStop = () => {
    if (!currentAction) return;
    
    currentAction.stop();
    currentAction.reset();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setStatus('⏹️ Animation stopped');
  };

  const handleRestart = () => {
    if (!currentAction) return;
    
    currentAction.stop();
    currentAction.reset();
    currentAction.play();
    isPlayingRef.current = true;
    setIsPlaying(true);
    setStatus('🔄 Animation restarted');
  };

  const handleToggleLoop = () => {
    const newLooping = !isLooping;
    setIsLooping(newLooping);
    
    if (currentAction) {
      currentAction.loop = newLooping ? THREE.LoopRepeat : THREE.LoopOnce;
    }
    
    setStatus(newLooping ? '🔁 Loop enabled' : '1️⃣ Play once');
  };

  const exportPose = async () => {
    const vrm = vrmRef.current;
    if (!vrm) {
      setStatus('Load a VRM before exporting.');
      return;
    }
    vrm.update(0);
    const pose = vrm.humanoid?.getNormalizedPose?.();
    if (!pose) {
      setStatus('Failed to extract pose.');
      return;
    }
    const payload = {
      sceneRotation: { y: 180 },
      vrmPose: pose,
    };
    
    // Export pose JSON
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pose.json';
    anchor.click();
    URL.revokeObjectURL(url);

    // Export animation clip if available
    if (animationClipRef.current) {
      const { serializeAnimationClip } = await import('../poses/animationClipSerializer');
      const serialized = serializeAnimationClip(animationClipRef.current);
      const animBlob = new Blob([JSON.stringify(serialized, null, 2)], { type: 'application/json' });
      const animUrl = URL.createObjectURL(animBlob);
      const animAnchor = document.createElement('a');
      animAnchor.href = animUrl;
      animAnchor.download = 'pose-animation.json';
      animAnchor.click();
      URL.revokeObjectURL(animUrl);
      setStatus('✅ Exported 2 files! Rename: pose.json → {id}.json, pose-animation.json → {id}-animation.json');
    } else {
      setStatus('Exported pose.json (no animation). Rename to {id}.json');
    }
  };

  const batchExport = async () => {
    if (!vrmRef.current) {
      setStatus('Load a VRM before running batch export.');
      return;
    }
    setIsBatchExporting(true);
    try {
      const DEFAULT_SCENE_ROTATION = { y: 180 };
      for (const config of batchConfigs) {
        setStatus(`Exporting ${config.label}…`);
        const response = await fetch(config.source);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${config.label} (${response.status})`);
        }
        const buffer = await response.arrayBuffer();
        const { pose, animationClip } = await applyMixamoBuffer(buffer, config.fileName, vrmRef.current);
        await savePoseToDisk(config.id, {
          sceneRotation: config.sceneRotation ?? DEFAULT_SCENE_ROTATION,
          vrmPose: pose,
          animationClip, // Include animation clip
        });
      }
      setStatus('Batch export complete! Updated files in src/poses.');
    } catch (error) {
      console.error('Batch export failed', error);
      setStatus(`Batch export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBatchExporting(false);
    }
  };

  const handleVRMDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingVRM(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.vrm')) {
      await loadVRM(file);
    } else {
      setStatus('❌ Please drop a VRM file here.');
    }
  };

  const handleFBXDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFBX(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (/\.(fbx|gltf|glb)$/i.test(file.name)) {
      await retarget(file);
    } else {
      setStatus('Please drop an FBX, GLTF, or GLB file here.');
    }
  };

  if (isCaptureMode) {
    return (
      <div className="pose-lab pose-lab--capture">
        <div ref={canvasRef} className="pose-lab__canvas pose-lab__canvas--capture" />
      </div>
    );
  }

  return (
    <div className="pose-lab">
      <header className="pose-lab__header">
        <h1>🎭 Pose Lab</h1>
        <p className="muted">Retarget Mixamo animations to VRM format</p>
      </header>

      <div className="pose-lab__workflow">
        {/* Step 1: VRM Drop Zone */}
        <div className="pose-lab__step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h3>Load VRM Avatar</h3>
            <div
              className={`drop-zone ${isDraggingVRM ? 'drop-zone--active' : ''} ${isVRMLoaded ? 'drop-zone--loaded' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingVRM(true);
              }}
              onDragLeave={() => setIsDraggingVRM(false)}
              onDrop={handleVRMDrop}
              onClick={() => document.getElementById('vrm-upload')?.click()}
            >
              <div className="drop-zone__icon">📦</div>
              <div className="drop-zone__text">
                {isVRMLoaded ? (
                  <>
                    <strong>✅ VRM Loaded</strong>
                    <span>Drop another to replace</span>
                  </>
                ) : (
                  <>
                    <strong>Drag & Drop VRM File Here</strong>
                    <span>or click to browse</span>
                  </>
                )}
              </div>
              <input
                type="file"
                id="vrm-upload"
                accept=".vrm"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && loadVRM(e.target.files[0], { syncSource: true })}
              />
            </div>
          </div>
        </div>

        {/* Step 2: FBX Drop Zone */}
        <div className="pose-lab__step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h3>Load Mixamo Animation</h3>
            <div
              className={`drop-zone ${isDraggingFBX ? 'drop-zone--active' : ''} ${currentAnimationClip ? 'drop-zone--loaded' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFBX(true);
              }}
              onDragLeave={() => setIsDraggingFBX(false)}
              onDrop={handleFBXDrop}
              onClick={() => document.getElementById('fbx-upload')?.click()}
            >
              <div className="drop-zone__icon">🎬</div>
              <div className="drop-zone__text">
                {currentAnimationClip ? (
                  <>
                    <strong>✅ Animation Loaded</strong>
                    <span>Drop another to replace</span>
                  </>
                ) : (
                  <>
                    <strong>Drag & Drop FBX/GLTF File Here</strong>
                    <span>or click to browse</span>
                  </>
                )}
              </div>
              <input
                type="file"
                id="fbx-upload"
                accept=".fbx,.gltf,.glb"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && retarget(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        {/* Step 3: Preview Canvas */}
        <div className="pose-lab__step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h3>Preview & Export</h3>
            <div ref={canvasRef} className="pose-lab__canvas" />
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div className="status-card">
        <p className="status-message">{status}</p>
      </div>

      {/* Animation Controls */}
      {currentAnimationClip && (
        <div className="pose-lab__animation-controls">
          <h3>🎬 Animation Preview</h3>
          <div className="pose-lab__actions">
            <button type="button" onClick={handlePlayPause}>
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button type="button" onClick={handleStop}>
              ⏹️ Stop
            </button>
            <button type="button" onClick={handleRestart}>
              🔄 Restart
            </button>
            <button 
              type="button" 
              onClick={handleToggleLoop}
              className={isLooping ? 'active' : ''}
            >
              {isLooping ? '🔁 Loop' : '1️⃣ Once'}
            </button>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="pose-lab__actions">
        <button type="button" onClick={exportPose} disabled={!vrmRef.current}>
          💾 Export Pose JSON
        </button>
        <button type="button" onClick={batchExport} disabled={!vrmRef.current || isBatchExporting}>
          {isBatchExporting ? 'Processing...' : '📦 Batch Export All Poses'}
        </button>
      </div>

      {/* Batch FBX Converter */}
      {isVRMLoaded && vrmRef.current && (
        <BatchFBXConverter vrm={vrmRef.current} />
      )}
    </div>
  );
}

export default PoseLab;
