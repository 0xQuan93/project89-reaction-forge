
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

const OUTPUT_FILE = path.join(process.cwd(), 'src', 'poses', 'skeleton_limits.json');

// Helper to convert quaternion to euler (degrees)
function getEuler(qArray) {
  const q = new THREE.Quaternion(qArray[0], qArray[1], qArray[2], qArray[3]);
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return {
    x: THREE.MathUtils.radToDeg(e.x),
    y: THREE.MathUtils.radToDeg(e.y),
    z: THREE.MathUtils.radToDeg(e.z)
  };
}

const boneStats = {};

console.log('--- Starting Skeleton Analysis ---');

FILES_TO_ANALYZE.forEach(filename => {
  const filePath = path.join(ANIMATION_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${filename}`);
    return;
  }

  console.log(`Analyzing ${filename}...`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (!data.tracks) return;

    data.tracks.forEach(track => {
      // Only care about rotations (quaternions)
      if (track.type !== 'quaternion') return;
      
      // Extract simplified bone name (remove path prefix)
      // e.g., "VRMHumanoidRig/.../Normalized_upper_armR.quaternion" -> "upper_armR"
      const parts = track.name.split('/');
      const rawBoneName = parts[parts.length - 1].replace('.quaternion', '').replace('Normalized_', '');
      
      if (!boneStats[rawBoneName]) {
        boneStats[rawBoneName] = {
          min: { x: Infinity, y: Infinity, z: Infinity },
          max: { x: -Infinity, y: -Infinity, z: -Infinity },
          samples: 0,
          paths: new Set()
        };
      }
      
      boneStats[rawBoneName].paths.add(track.name); // Keep full path for reference

      // Process samples (stride of 4 for quaternion [x,y,z,w])
      for (let i = 0; i < track.values.length; i += 4) {
        const qVal = [
          track.values[i],
          track.values[i+1],
          track.values[i+2],
          track.values[i+3]
        ];
        
        const euler = getEuler(qVal);
        
        // Update Min/Max
        boneStats[rawBoneName].min.x = Math.min(boneStats[rawBoneName].min.x, euler.x);
        boneStats[rawBoneName].min.y = Math.min(boneStats[rawBoneName].min.y, euler.y);
        boneStats[rawBoneName].min.z = Math.min(boneStats[rawBoneName].min.z, euler.z);
        
        boneStats[rawBoneName].max.x = Math.max(boneStats[rawBoneName].max.x, euler.x);
        boneStats[rawBoneName].max.y = Math.max(boneStats[rawBoneName].max.y, euler.y);
        boneStats[rawBoneName].max.z = Math.max(boneStats[rawBoneName].max.z, euler.z);
        
        boneStats[rawBoneName].samples++;
      }
    });
  } catch (err) {
    console.error(`Error processing ${filename}:`, err.message);
  }
});

// Post-processing: Calculate Range and Identify Primary Axis
const analysis = {};

Object.keys(boneStats).forEach(bone => {
  const stats = boneStats[bone];
  const range = {
    x: stats.max.x - stats.min.x,
    y: stats.max.y - stats.min.y,
    z: stats.max.z - stats.min.z
  };
  
  // Find primary axis
  let primaryAxis = 'x';
  let maxRange = range.x;
  if (range.y > maxRange) { primaryAxis = 'y'; maxRange = range.y; }
  if (range.z > maxRange) { primaryAxis = 'z'; maxRange = range.z; }

  analysis[bone] = {
    limits: {
      x: [Math.round(stats.min.x), Math.round(stats.max.x)],
      y: [Math.round(stats.min.y), Math.round(stats.max.y)],
      z: [Math.round(stats.min.z), Math.round(stats.max.z)]
    },
    range: {
      x: Math.round(range.x),
      y: Math.round(range.y),
      z: Math.round(range.z)
    },
    primaryAxis,
    fullPath: Array.from(stats.paths)[0] // Store one valid path for generator use
  };
});

// Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysis, null, 2));
console.log('--- Analysis Complete ---');
console.log(`Skeleton Limits Map written to: ${OUTPUT_FILE}`);

// Print a quick summary for arms
console.log('\n--- Quick Arm Summary ---');
['upper_armR', 'lower_armR', 'upper_armL', 'lower_armL'].forEach(bone => {
  if (analysis[bone]) {
    console.log(`${bone}:`);
    console.log(`  Primary Axis: ${analysis[bone].primaryAxis.toUpperCase()}`);
    console.log(`  Limits: X[${analysis[bone].limits.x}], Y[${analysis[bone].limits.y}], Z[${analysis[bone].limits.z}]`);
  }
});

