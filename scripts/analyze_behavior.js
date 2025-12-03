
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';

// Configuration
const ANIMATION_DIR = path.join(process.cwd(), 'src', 'poses');
const FILES_TO_ANALYZE = [
  'agent-clapping-animation.json',
  'agent-dance-animation.json',
  'agent-defeat-animation.json',
  'agent-taunt-animation.json',
  'silly-agent-animation.json'
];

const OUTPUT_FILE = path.join(process.cwd(), 'src', 'poses', 'skeleton_behavior.json');

// --- HELPERS ---

function getQuat(values, index) {
  return new THREE.Quaternion(values[index], values[index+1], values[index+2], values[index+3]);
}

function getEuler(q) {
  return new THREE.Euler().setFromQuaternion(q, 'XYZ');
}

// Extract track for a specific bone name (handling various naming conventions if needed, 
// but analyze_skeleton seemed to normalize to "Normalized_boneName" or similar path suffix)
function findTrack(tracks, boneSuffix) {
  // Look for track ending with boneSuffix + ".quaternion"
  // e.g. "Normalized_head.quaternion" or "Head.quaternion"
  return tracks.find(t => t.name.endsWith(boneSuffix + '.quaternion') && t.type === 'quaternion');
}

// Calculate correlation between two numeric arrays
function calculateCorrelation(arr1, arr2) {
  const n = Math.min(arr1.length, arr2.length);
  if (n === 0) return 0;
  
  let sum1 = 0, sum2 = 0;
  for (let i = 0; i < n; i++) { sum1 += arr1[i]; sum2 += arr2[i]; }
  const mean1 = sum1 / n;
  const mean2 = sum2 / n;
  
  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = arr1[i] - mean1;
    const dy = arr2[i] - mean2;
    num += dx * dy;
    den1 += dx * dx;
    den2 += dy * dy;
  }
  
  if (den1 === 0 || den2 === 0) return 0;
  return num / Math.sqrt(den1 * den2);
}

// Calculate Time Lag where correlation is maximized
function calculatePhaseLag(sourceTrack, targetTrack, times) {
  // We need to sample both tracks at regular intervals
  const duration = times[times.length - 1];
  const sampleRate = 30; // 30Hz resampling
  const numSamples = Math.floor(duration * sampleRate);
  
  const sourceVel = [];
  const targetVel = [];
  
  // Helper to sample track at time t
  const sampleTrack = (track, t) => {
    // Find keyframe index
    let idx = 0;
    while(idx < track.times.length - 1 && track.times[idx+1] < t) idx++;
    // Linear interp (slerp for quat)
    const t0 = track.times[idx];
    const t1 = track.times[idx+1] || t0; // Handle end
    const alpha = (t1 === t0) ? 0 : (t - t0) / (t1 - t0);
    
    const q0 = getQuat(track.values, idx * 4);
    const q1 = getQuat(track.values, (idx + 1) * 4);
    return q0.slerp(q1, alpha);
  };

  let prevQSource = sampleTrack(sourceTrack, 0);
  let prevQTarget = sampleTrack(targetTrack, 0);

  for(let i=1; i<numSamples; i++) {
    const t = i / sampleRate;
    const qSource = sampleTrack(sourceTrack, t);
    const qTarget = sampleTrack(targetTrack, t);
    
    // Angular velocity (approx)
    const velSource = 2 * Math.acos(Math.abs(prevQSource.dot(qSource))) * sampleRate;
    const velTarget = 2 * Math.acos(Math.abs(prevQTarget.dot(qTarget))) * sampleRate;
    
    sourceVel.push(velSource);
    targetVel.push(velTarget);
    
    prevQSource = qSource;
    prevQTarget = qTarget;
  }

  // Cross-correlation to find max lag
  // Check lags from 0 to 0.5s (0 to 15 frames)
  let maxCorr = -1;
  let bestLag = 0;
  
  for(let lagFrames = 0; lagFrames <= 15; lagFrames++) {
    // Shift target array by lagFrames
    const shiftedTarget = targetVel.slice(lagFrames);
    const croppedSource = sourceVel.slice(0, sourceVel.length - lagFrames);
    
    const corr = calculateCorrelation(croppedSource, shiftedTarget);
    if(corr > maxCorr) {
      maxCorr = corr;
      bestLag = lagFrames / sampleRate;
    }
  }
  
  return bestLag; // Seconds that Target Lags behind Source
}

// --- ANALYSIS ---

const behavior = {
  headStabilization: 0, // 0 to 1 (1 = perfectly counter-rotating chest)
  lags: {
    spineToHead: 0,
    shoulderToHand: 0,
    hipsToChest: 0
  },
  samples: 0
};

console.log('--- Starting Behavior Analysis ---');

FILES_TO_ANALYZE.forEach(filename => {
  const filePath = path.join(ANIMATION_DIR, filename);
  if (!fs.existsSync(filePath)) return;

  console.log(`Analyzing behavior of ${filename}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  if (!data.tracks) return;

  // 1. Head Stabilization Analysis
  // Compare Chest rotation vs Head rotation in World Space? 
  // Or Local? In VRM, Head is child of Chest.
  // If Chest rotates +X, Head stabilizing means Head rotates -X locally to keep World X constant.
  // We check correlation of local Chest vs local Head rotations. If Negative Correlation, it's stabilization.
  
  const chestTrack = findTrack(data.tracks, 'chest');
  const headTrack = findTrack(data.tracks, 'head');
  
  if (chestTrack && headTrack) {
    // Resample and check Euler X/Z correlations (Tilt/Pitch)
    // Y (Yaw) might align (look where body turns), so exclude Y for stabilization check.
    
    // ... Sampling logic similar to lag ...
    // For simplicity, just checking Lag for now as requested by user "how physics operate" implies timing/weight.
    // Let's focus on Lags first.
    
    const lagHead = calculatePhaseLag(chestTrack, headTrack, chestTrack.times);
    behavior.lags.spineToHead += lagHead;
  }

  // 2. Arm Chain Lag (Shoulder -> Hand)
  const shoulderTrack = findTrack(data.tracks, 'shoulderR') || findTrack(data.tracks, 'rightShoulder'); // Try both names
  const handTrack = findTrack(data.tracks, 'handR') || findTrack(data.tracks, 'rightHand');
  
  if (shoulderTrack && handTrack) {
    const lagArm = calculatePhaseLag(shoulderTrack, handTrack, shoulderTrack.times);
    behavior.lags.shoulderToHand += lagArm;
  }
  
  // 3. Core Lag (Hips -> Chest)
  const hipsTrack = findTrack(data.tracks, 'hips');
  if (hipsTrack && chestTrack) {
    const lagCore = calculatePhaseLag(hipsTrack, chestTrack, hipsTrack.times);
    behavior.lags.hipsToChest += lagCore;
  }

  behavior.samples++;
});

// Average results
if (behavior.samples > 0) {
  behavior.lags.spineToHead /= behavior.samples;
  behavior.lags.shoulderToHand /= behavior.samples;
  behavior.lags.hipsToChest /= behavior.samples;
}

console.log('--- Behavior Analysis Results ---');
console.log('Phase Lags (Seconds):');
console.log(`  Hips -> Chest: ${behavior.lags.hipsToChest.toFixed(3)}s`);
console.log(`  Chest -> Head: ${behavior.lags.spineToHead.toFixed(3)}s`);
console.log(`  Shoulder -> Hand: ${behavior.lags.shoulderToHand.toFixed(3)}s`);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(behavior, null, 2));
console.log(`Behavior Map written to: ${OUTPUT_FILE}`);

