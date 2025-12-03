
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';

// Configuration
const ANIMATION_DIR = path.join(process.cwd(), 'src', 'poses');
// Only analyze the "Real" mocap files, not our synthetic ones
const FILES_TO_ANALYZE = [
  'agent-clapping-animation.json',
  'agent-dance-animation.json',
  'agent-defeat-animation.json',
  'agent-taunt-animation.json',
  'silly-agent-animation.json'
];

const OUTPUT_FILE = path.join(process.cwd(), 'src', 'poses', 'skeleton_dynamics.json');

// Helper to get Euler from Quat Array
function getEuler(qArray) {
  const q = new THREE.Quaternion(qArray[0], qArray[1], qArray[2], qArray[3]);
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return new THREE.Vector3(e.x, e.y, e.z); // Radians
}

const boneDynamics = {};

console.log('--- Starting Dynamics Analysis ---');

FILES_TO_ANALYZE.forEach(filename => {
  const filePath = path.join(ANIMATION_DIR, filename);
  if (!fs.existsSync(filePath)) return;

  console.log(`Analyzing physics of ${filename}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  
  if (!data.tracks) return;

  const duration = data.duration;

  data.tracks.forEach(track => {
    if (track.type !== 'quaternion') return;
    
    const parts = track.name.split('/');
    const boneName = parts[parts.length - 1].replace('.quaternion', '').replace('Normalized_', '');
    
    if (!boneDynamics[boneName]) {
      boneDynamics[boneName] = {
        maxVelocity: 0, // rad/sec
        avgVelocity: 0,
        samples: 0,
        accumulatedVelocity: 0
      };
    }

    const times = track.times;
    const values = track.values;

    // Calculate Velocity between frames
    for (let i = 0; i < times.length - 1; i++) {
      const t1 = times[i];
      const t2 = times[i+1];
      const dt = t2 - t1;
      if (dt <= 0) continue;

      // Get Rotations
      const idx1 = i * 4;
      const idx2 = (i + 1) * 4;
      
      const q1 = new THREE.Quaternion(values[idx1], values[idx1+1], values[idx1+2], values[idx1+3]);
      const q2 = new THREE.Quaternion(values[idx2], values[idx2+1], values[idx2+2], values[idx2+3]);
      
      // Calculate angular distance (angle between quaternions)
      const angle = 2 * Math.acos(Math.abs(THREE.MathUtils.clamp(q1.dot(q2), -1, 1)));
      
      const velocity = angle / dt; // rad/sec
      
      boneDynamics[boneName].maxVelocity = Math.max(boneDynamics[boneName].maxVelocity, velocity);
      boneDynamics[boneName].accumulatedVelocity += velocity;
      boneDynamics[boneName].samples++;
    }
  });
});

// Finalize
const dynamics = {};
Object.keys(boneDynamics).forEach(bone => {
  const stats = boneDynamics[bone];
  dynamics[bone] = {
    maxSpeedDeg: Math.round(THREE.MathUtils.radToDeg(stats.maxVelocity)),
    avgSpeedDeg: Math.round(THREE.MathUtils.radToDeg(stats.accumulatedVelocity / stats.samples))
  };
});

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dynamics, null, 2));
console.log(`\nDynamics Map written to: ${OUTPUT_FILE}`);

// Summary
console.log('\n--- Speed Limits (Degrees/Sec) ---');
['upper_armR', 'lower_armR', 'spine'].forEach(bone => {
  if (dynamics[bone]) {
    console.log(`${bone}: Max ${dynamics[bone].maxSpeedDeg}/s, Avg ${dynamics[bone].avgSpeedDeg}/s`);
  }
});

