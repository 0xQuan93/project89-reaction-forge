
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

const OUTPUT_FILE = path.join(process.cwd(), 'src', 'poses', 'skeleton_synergy.json');

// --- HELPERS ---

function getQuat(values, index) {
  return new THREE.Quaternion(values[index], values[index+1], values[index+2], values[index+3]);
}

function getEuler(q) {
  return new THREE.Euler().setFromQuaternion(q, 'XYZ');
}

// Extract track
function findTrack(tracks, boneSuffix) {
  return tracks.find(t => t.name.endsWith(boneSuffix + '.quaternion') && t.type === 'quaternion');
}

function findPosTrack(tracks, boneSuffix) {
  return tracks.find(t => t.name.endsWith(boneSuffix + '.position') && t.type === 'vector');
}

// Calculate correlation (0 to 1)
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

// --- ANALYSIS ---

const synergy = {
  fingers: {
    indexToMiddle: 0,
    middleToRing: 0,
    ringToLittle: 0,
    thumbToIndex: 0
  },
  legs: {
    hipsY_vs_LegFlexion: 0 // Does moving hips down cause legs to bend? (Grounding)
  },
  samples: 0
};

console.log('--- Starting Extremities Analysis ---');

FILES_TO_ANALYZE.forEach(filename => {
  const filePath = path.join(ANIMATION_DIR, filename);
  if (!fs.existsSync(filePath)) return;

  console.log(`Analyzing ${filename}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  if (!data.tracks) return;

  const duration = data.duration;
  const sampleRate = 10; // 10Hz sampling is enough for correlation
  const numSamples = Math.floor(duration * sampleRate);

  // Helper to sample value at t
  const sampleRot = (track, t, axis = 'z') => {
    if (!track) return 0;
    let idx = 0;
    while(idx < track.times.length - 1 && track.times[idx+1] < t) idx++;
    const t0 = track.times[idx];
    const t1 = track.times[idx+1] || t0;
    const alpha = (t1 === t0) ? 0 : (t - t0) / (t1 - t0);
    
    const q0 = getQuat(track.values, idx * 4);
    const q1 = getQuat(track.values, (idx + 1) * 4);
    const q = q0.slerp(q1, alpha);
    const e = getEuler(q);
    return e[axis]; // Radians
  };

  const samplePos = (track, t, axis = 'y') => {
    if (!track) return 0;
    let idx = 0;
    while(idx < track.times.length - 1 && track.times[idx+1] < t) idx++;
    const t0 = track.times[idx];
    const t1 = track.times[idx+1] || t0;
    const alpha = (t1 === t0) ? 0 : (t - t0) / (t1 - t0);
    
    const v0 = track.values[idx * 3 + (axis==='y'?1:0)]; // Simplified
    const v1 = track.values[(idx+1) * 3 + (axis==='y'?1:0)];
    return v0 + (v1 - v0) * alpha;
  };

  // 1. Finger Synergy (Right Hand)
  // Check Z-axis rotation (Curl)
  const indexTrack = findTrack(data.tracks, 'index_proximalR') || findTrack(data.tracks, 'Index1');
  const middleTrack = findTrack(data.tracks, 'middle_proximalR') || findTrack(data.tracks, 'Middle1');
  const ringTrack = findTrack(data.tracks, 'ring_proximalR') || findTrack(data.tracks, 'Ring1');
  const littleTrack = findTrack(data.tracks, 'little_proximalR') || findTrack(data.tracks, 'Little1');
  const thumbTrack = findTrack(data.tracks, 'thumb_proximalR') || findTrack(data.tracks, 'Thumb1');

  if (indexTrack && middleTrack) {
    const idxVals = [], midVals = [];
    for(let i=0; i<numSamples; i++) {
      const t = i / sampleRate;
      idxVals.push(sampleRot(indexTrack, t, 'z'));
      midVals.push(sampleRot(middleTrack, t, 'z'));
    }
    synergy.fingers.indexToMiddle += calculateCorrelation(idxVals, midVals);
  }

  if (middleTrack && ringTrack) {
    const vals1 = [], vals2 = [];
    for(let i=0; i<numSamples; i++) {
      const t = i / sampleRate;
      vals1.push(sampleRot(middleTrack, t, 'z'));
      vals2.push(sampleRot(ringTrack, t, 'z'));
    }
    synergy.fingers.middleToRing += calculateCorrelation(vals1, vals2);
  }

  if (ringTrack && littleTrack) {
    const vals1 = [], vals2 = [];
    for(let i=0; i<numSamples; i++) {
      const t = i / sampleRate;
      vals1.push(sampleRot(ringTrack, t, 'z'));
      vals2.push(sampleRot(littleTrack, t, 'z'));
    }
    synergy.fingers.ringToLittle += calculateCorrelation(vals1, vals2);
  }

  // 2. Leg Grounding (Hips Y vs Leg Flexion)
  // If Hips go DOWN (-Y), Legs must Flex (Usually -X rotation for Upper Leg in VRM?)
  // Let's check Hips Y Position vs Upper Leg X Rotation
  const hipsPosTrack = findPosTrack(data.tracks, 'hips');
  const legRotTrack = findTrack(data.tracks, 'upper_legR');

  if (hipsPosTrack && legRotTrack) {
    const hipsY = [], legX = [];
    for(let i=0; i<numSamples; i++) {
      const t = i / sampleRate;
      hipsY.push(samplePos(hipsPosTrack, t, 'y'));
      legX.push(sampleRot(legRotTrack, t, 'x'));
    }
    // Correlation: If Hips go Down (Negative), Leg Flexes (Negative?). 
    // Positive correlation means they move in same sign direction.
    // Negative means opposite.
    synergy.legs.hipsY_vs_LegFlexion += calculateCorrelation(hipsY, legX);
  }

  synergy.samples++;
});

// Average
if (synergy.samples > 0) {
  synergy.fingers.indexToMiddle /= synergy.samples;
  synergy.fingers.middleToRing /= synergy.samples;
  synergy.fingers.ringToLittle /= synergy.samples;
  synergy.fingers.thumbToIndex /= synergy.samples;
  synergy.legs.hipsY_vs_LegFlexion /= synergy.samples;
}

console.log('--- Synergy Analysis Results ---');
console.log('Finger Correlations (1.0 = move exactly together):');
console.log(`  Index <-> Middle: ${synergy.fingers.indexToMiddle.toFixed(2)}`);
console.log(`  Middle <-> Ring:  ${synergy.fingers.middleToRing.toFixed(2)}`);
console.log(`  Ring <-> Little:  ${synergy.fingers.ringToLittle.toFixed(2)}`);

console.log('\nLeg Grounding Correlation:');
console.log(`  Hips Y vs Leg Flexion: ${synergy.legs.hipsY_vs_LegFlexion.toFixed(2)}`);
console.log(`  (Note: High positive/negative correlation implies strong IK linkage)`);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(synergy, null, 2));

