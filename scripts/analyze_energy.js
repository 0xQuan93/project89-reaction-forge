
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

const OUTPUT_FILE = path.join(process.cwd(), 'src', 'poses', 'skeleton_energy.json');

// --- HELPERS ---

function getQuat(values, index) {
  return new THREE.Quaternion(values[index], values[index+1], values[index+2], values[index+3]);
}

function getEuler(q) {
  return new THREE.Euler().setFromQuaternion(q, 'XYZ');
}

function findTrack(tracks, boneSuffix) {
  return tracks.find(t => t.name.endsWith(boneSuffix + '.quaternion') && t.type === 'quaternion');
}

// Calculate Average Amplitude (Energy) of a track
// We measure the accumulated angular travel distance per second (Energy Flux)
function calculateEnergy(track) {
  if (!track) return 0;
  
  let totalAngle = 0;
  const numSamples = track.times.length;
  
  for(let i=0; i<numSamples-1; i++) {
    const q1 = getQuat(track.values, i * 4);
    const q2 = getQuat(track.values, (i + 1) * 4);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(q1.dot(q2))));
    totalAngle += angle; // Radians
  }
  
  const duration = track.times[track.times.length-1] - track.times[0];
  if (duration <= 0) return 0;
  
  // Average degrees per second
  return THREE.MathUtils.radToDeg(totalAngle / duration);
}

// --- ANALYSIS ---

const ratios = {
  spineToArm: [], // How much does spine move vs arm?
  headToChest: [], // Head vs Chest
  hipsToSpine: [] // Hips vs Spine
};

console.log('--- Starting Energy Distribution Analysis ---');

FILES_TO_ANALYZE.forEach(filename => {
  const filePath = path.join(ANIMATION_DIR, filename);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  if (!data.tracks) return;

  // Identify Bones
  const spineTrack = findTrack(data.tracks, 'spine');
  const chestTrack = findTrack(data.tracks, 'chest');
  const headTrack = findTrack(data.tracks, 'head');
  const armRTrack = findTrack(data.tracks, 'upper_armR');
  const armLTrack = findTrack(data.tracks, 'upper_armL');
  const hipsTrack = findTrack(data.tracks, 'hips'); // Note: Hips rotation track

  // Calculate Energies (Avg Deg/s)
  const eSpine = calculateEnergy(spineTrack) + calculateEnergy(chestTrack); // Core Energy
  const eArmR = calculateEnergy(armRTrack);
  const eArmL = calculateEnergy(armLTrack);
  const eHead = calculateEnergy(headTrack);
  const eHips = calculateEnergy(hipsTrack);
  
  const eArmMax = Math.max(eArmR, eArmL); // Use the active arm

  console.log(`\nFile: ${filename}`);
  console.log(`  Arm Energy: ${eArmMax.toFixed(1)}°/s`);
  console.log(`  Core Energy: ${eSpine.toFixed(1)}°/s`);
  console.log(`  Head Energy: ${eHead.toFixed(1)}°/s`);

  // Calculate Ratios (Avoid divide by zero)
  if (eArmMax > 10) {
    const r = eSpine / eArmMax;
    ratios.spineToArm.push(r);
    console.log(`  -> Ratio Spine/Arm: ${r.toFixed(3)}`);
  }
  
  if (eSpine > 5) {
    const r = eHead / eSpine; // Head motion relative to core
    ratios.headToChest.push(r);
  }
  
  if (eHips > 5) {
    const r = eSpine / eHips;
    ratios.hipsToSpine.push(r);
  }
});

// Average Ratios
const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b)/arr.length : 0;

const finalRatios = {
  spineToArmRatio: avg(ratios.spineToArm),
  headToChestRatio: avg(ratios.headToChest),
  hipsToSpineRatio: avg(ratios.hipsToSpine)
};

console.log('\n--- Final Coupling Constants ---');
console.log(`Spine Movement = Arm Movement * ${finalRatios.spineToArmRatio.toFixed(3)}`);
console.log(`Head Movement  = Chest Movement * ${finalRatios.headToChestRatio.toFixed(3)}`);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalRatios, null, 2));
console.log(`Energy Map written to: ${OUTPUT_FILE}`);

