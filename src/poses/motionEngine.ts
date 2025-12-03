
import * as THREE from 'three';
import limitsData from './skeleton_limits.json';
import dynamicsData from './skeleton_dynamics.json';
import behaviorData from './skeleton_behavior.json';
import synergyData from './skeleton_synergy.json';
import energyData from './skeleton_energy.json';

// Types
interface BoneMap { [key: string]: string; }
interface DynamicsStats { maxSpeedDeg: number; avgSpeedDeg: number; }
interface LimitStats { limits: { x: number[]; y: number[]; z: number[] }; primaryAxis: string; }
interface BehaviorStats { 
  headStabilization: number; 
  lags: { spineToHead: number; shoulderToHand: number; hipsToChest: number; }; 
}
interface SynergyStats {
  fingers: { indexToMiddle: number; middleToRing: number; ringToLittle: number; };
  legs: { hipsY_vs_LegFlexion: number; };
}
interface EnergyStats {
  spineToArmRatio: number;
  headToChestRatio: number;
  hipsToSpineRatio: number;
}
interface PoseData { [bone: string]: { x: number; y: number; z: number } | any; }

/**
 * Configuration for procedural motion generation
 */
interface MotionConfig {
  /** Duration of the animation loop in seconds (default: 2.0) */
  duration?: number;
  /** Frames per second (default: 30) */
  fps?: number;
  /** Base frequency of the motion in Hz (default: 2.0) */
  frequency?: number;     
  /** Amplitude multiplier 0.0-1.0 (default: 1.0) */
  energy?: number;        
  /** Jitter/Noise multiplier (default: 1.0) */
  noiseScale?: number;
  /** Scale factor for core/spine reaction (default: 1.0). Reduce for subtle motions. */
  coreCoupling?: number;
}

/**
 * MotionEngine
 * 
 * A procedural animation generator that combines:
 * 1. Kinetic Chain Physics (Measured Lag/Drag)
 * 2. Bio-Mechanical Constraints (Limits)
 * 3. Dynamic Noise Profiles (Organic Jitter)
 * 4. Extremity Solvers (Hand Synergy & Leg Grounding)
 * 5. Energy Coupling (Full Body Integration)
 */
export class MotionEngine {
  private limits: { [key: string]: LimitStats };
  private dynamics: { [key: string]: DynamicsStats };
  private behavior: BehaviorStats;
  private synergy: SynergyStats;
  private energy: EnergyStats;
  private boneMap: BoneMap;
  
  constructor() {
    this.limits = limitsData as any;
    this.dynamics = dynamicsData as any;
    this.behavior = behaviorData as any;
    this.synergy = synergyData as any;
    this.energy = energyData as any;
    this.boneMap = this.getBoneMap();
  }

  // Maps standard simplified names to VRM paths
  private getBoneMap(): BoneMap {
    const map: BoneMap = {
      hips: "VRMHumanoidRig/Normalized_hips",
      spine: "VRMHumanoidRig/Normalized_hips/Normalized_spine",
      chest: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest",
      neck: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_neck",
      head: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_neck/Normalized_head",
      rightShoulder: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderR",
      rightUpperArm: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderR/Normalized_upper_armR",
      rightLowerArm: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderR/Normalized_upper_armR/Normalized_lower_armR",
      rightHand: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderR/Normalized_upper_armR/Normalized_lower_armR/Normalized_handR",
      leftShoulder: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderL",
      leftUpperArm: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderL/Normalized_upper_armL",
      leftLowerArm: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderL/Normalized_upper_armL/Normalized_lower_armL",
      leftHand: "VRMHumanoidRig/Normalized_hips/Normalized_spine/Normalized_chest/Normalized_shoulderL/Normalized_upper_armL/Normalized_lower_armL/Normalized_handL",
      rightUpperLeg: "VRMHumanoidRig/Normalized_hips/Normalized_upper_legR",
      rightLowerLeg: "VRMHumanoidRig/Normalized_hips/Normalized_upper_legR/Normalized_lower_legR",
      rightFoot: "VRMHumanoidRig/Normalized_hips/Normalized_upper_legR/Normalized_lower_legR/Normalized_footR",
      leftUpperLeg: "VRMHumanoidRig/Normalized_hips/Normalized_upper_legL",
      leftLowerLeg: "VRMHumanoidRig/Normalized_hips/Normalized_upper_legL/Normalized_lower_legL",
      leftFoot: "VRMHumanoidRig/Normalized_hips/Normalized_upper_legL/Normalized_lower_legL/Normalized_footL"
    };

    // Add Fingers
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
    const segments = ['Proximal', 'Intermediate', 'Distal'];
    
    // Right Hand Fingers
    const rHandPath = map.rightHand;
    fingers.forEach(f => {
      segments.forEach(s => {
        if (f === 'Thumb' && s === 'Intermediate') return; 
        const key = `right${f}${s}`;
        const vrmName = `Normalized_${f.toLowerCase()}_${s.toLowerCase()}R`;
        map[key] = `${rHandPath}/${vrmName}`;
      });
    });

    // Left Hand Fingers
    const lHandPath = map.leftHand;
    fingers.forEach(f => {
      segments.forEach(s => {
        const key = `left${f}${s}`;
        const vrmName = `Normalized_${f.toLowerCase()}_${s.toLowerCase()}L`;
        map[key] = `${lHandPath}/${vrmName}`;
      });
    });

    return map;
  }

  private getLimitKey(boneName: string): string | null {
    const map: { [key: string]: string } = {
      rightUpperArm: "upper_armR", rightLowerArm: "lower_armR",
      leftUpperArm: "upper_armL", leftLowerArm: "lower_armL",
      spine: "spine", chest: "chest", hips: "hips",
      head: "head", neck: "neck",
      rightUpperLeg: "upper_legR", rightLowerLeg: "lower_legR",
      leftUpperLeg: "upper_legL", leftLowerLeg: "lower_legL",
    };
    
    // Auto-map simple matches
    if (boneName.includes('Hand')) return boneName.includes('right') ? 'handR' : 'handL';
    if (boneName.includes('Foot')) return boneName.includes('right') ? 'footR' : 'footL';
    
    // Attempt to map fingers (e.g. rightIndexProximal -> index_proximalR)
    if (boneName.includes('Index') || boneName.includes('Middle') || boneName.includes('Ring') || boneName.includes('Little') || boneName.includes('Thumb')) {
       const side = boneName.startsWith('right') ? 'R' : 'L';
       const part = boneName.replace('right', '').replace('left', '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1); 
       return `${part}${side}`;
    }

    return map[boneName] || null;
  }

  // --- MATH HELPERS ---

  private bioSin(t: number): number {
    const s = Math.sin(t);
    return Math.sign(s) * Math.pow(Math.abs(s), 0.85); 
  }

  private noise(t: number, offset: number, amp: number): number {
    return (Math.sin(t * 1.5 + offset) + Math.sin(t * 3.2 + offset) * 0.5) * amp;
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }

  // --- SOLVERS ---

  private solveLegIK(boneName: string, baseEuler: {x:number,y:number,z:number}, hipsDeltaY: number): {x:number,y:number,z:number} {
    const target = { ...baseEuler };
    const correlation = this.synergy.legs.hipsY_vs_LegFlexion || -0.35;
    // Scale factors tuned for natural standing compression
    const upperLegScale = 200 * Math.abs(correlation); 
    const lowerLegScale = -400 * Math.abs(correlation); // Knee bends opposite (Negative X)
    const footScale = 200 * Math.abs(correlation);      // Ankle compensates

    if (boneName.includes('UpperLeg')) {
      target.x += hipsDeltaY * upperLegScale;
    } else if (boneName.includes('LowerLeg')) {
      target.x += hipsDeltaY * lowerLegScale;
    } else if (boneName.includes('Foot')) {
      target.x += hipsDeltaY * footScale;
    }
    
    return target;
  }

  private solveHandSynergy(boneName: string, baseEuler: {x:number,y:number,z:number}, t: number, energy: number): {x:number,y:number,z:number} {
    const target = { ...baseEuler };
    // Phase shift based on finger index to create a "wave" effect across hand
    let fingerIndex = 0;
    if (boneName.includes('Index')) fingerIndex = 0;
    if (boneName.includes('Middle')) fingerIndex = 1;
    if (boneName.includes('Ring')) fingerIndex = 2;
    if (boneName.includes('Little')) fingerIndex = 3;
    if (boneName.includes('Thumb')) fingerIndex = -1;

    const phase = t + (fingerIndex * 0.2);
    const curl = Math.sin(phase * 2.0) * 5 * energy; // +/- 5 degrees breathing

    if (fingerIndex >= 0) {
       target.z -= curl; // Curl inwards
    } else {
       target.y += curl * 0.5; // Thumb oppose
    }
    return target;
  }

  // --- GESTURE LOGIC EXTRACTED ---

  private solveWaveGesture(boneName: string, t: number, frequency: number, energy: number, target: {x:number, y:number, z:number}, signal: number, boneLag: number, spineCoupling: number, coreCoupling: number) {
     // Active Arm (Right)
     if (boneName.startsWith('right')) {
       if (boneName === 'rightLowerArm') {
         target.y += signal * 25; 
         target.z += signal * 10; 
       }
       if (boneName === 'rightHand') target.z -= signal * 20; 
       if (boneName === 'rightUpperArm') target.x += signal * 2; 
       if (boneName === 'rightShoulder') target.z += signal * 3; 
     }

     // Passive Arm (Left) - Sympathetic Motion
     if (boneName.startsWith('left')) {
       if (boneName === 'leftShoulder') target.y -= Math.sin(t * frequency) * 1.5 * energy; 
       if (boneName === 'leftUpperArm') {
         target.z += Math.sin(t * frequency) * 2.0 * energy; 
         target.x += Math.sin(t * frequency + 0.5) * 1.0 * energy;
       }
       if (boneName === 'leftLowerArm') target.x -= Math.sin(t * frequency) * 1.5 * energy;
     }
     
     // Core Coupling
     if (boneName === 'spine' || boneName === 'chest') {
       const coreAmp = 25 * spineCoupling * energy * coreCoupling; 
       target.z += Math.sin(t * frequency) * coreAmp; 
     }
     
     if (boneName === 'head') {
       target.z -= Math.sin((t - boneLag) * frequency) * 1.0 * energy;
     }
  }

  private solvePointGesture(boneName: string, t: number, frequency: number, energy: number, target: {x:number, y:number, z:number}, phase: number, boneLag: number) {
     // Body faces target
     if (boneName === 'spine' || boneName === 'chest') {
       target.y -= 5; // Twist slightly right
       target.x += Math.sin(phase) * 1.0 * energy; // Breath
     }
     if (boneName === 'head') {
       target.y -= 10; // Look at finger
       target.z -= Math.sin((t - boneLag) * frequency) * 0.5 * energy;
     }

     // Right Arm: Point Forward
     if (boneName === 'rightUpperArm') {
       target.z += 10; 
       target.y += 75; 
     }
     if (boneName === 'rightLowerArm') {
       target.z += 10; 
     }
     
     // Override Fingers for Pointing
     if (boneName.startsWith('right')) {
       if (boneName.includes('Index')) target.z = 0; 
       if (boneName.includes('Middle') || boneName.includes('Ring') || boneName.includes('Little')) target.z -= 90;
       if (boneName.includes('Thumb')) {
          target.y -= 30; 
          target.z -= 45; 
          target.x = 0; 
       }
     }
     
     // Passive Left Arm
     if (boneName.startsWith('left')) {
       if (boneName === 'leftShoulder') target.y -= Math.sin(t * frequency) * 1.0 * energy;
       if (boneName === 'leftUpperArm') target.z += 5; 
     }
  }

  private solveIdleGesture(boneName: string, phase: number, energy: number, target: {x:number, y:number, z:number}) {
     if (boneName === 'spine' || boneName === 'chest') {
       target.x += Math.sin(phase) * 1.5 * energy; 
     }
     if (boneName.includes('Shoulder')) {
       target.y -= Math.sin(phase) * 1.0 * energy; 
     }
     if (boneName === 'head') {
       target.x += Math.sin(phase) * 0.5 * energy;
     }
  }

  // --- CORE GENERATION ---

  public generateProceduralAnimation(
    basePose: PoseData, 
    type: 'wave' | 'idle' | 'breath' | 'point',
    config: MotionConfig = {}
  ) {
    const duration = config.duration || 2.0;
    const fps = config.fps || 30;
    const frames = Math.floor(duration * fps);
    const frequency = (config.frequency || 2.0) * (Math.PI * 2 / duration);
    const energy = config.energy !== undefined ? config.energy : 1.0;
    const noiseScale = config.noiseScale !== undefined ? config.noiseScale : 1.0;
    const coreCoupling = config.coreCoupling !== undefined ? config.coreCoupling : 1.0;

    const tracks: any[] = [];
    
    // Physics Constants
    const lagHipsToChest = this.behavior.lags.hipsToChest || 0.26;
    const lagChestToHead = this.behavior.lags.spineToHead || 0.22;
    const lagShoulderToHand = this.behavior.lags.shoulderToHand || 0.21;
    
    const spineCoupling = this.energy.spineToArmRatio || 0.29; 

    // 1. Process Hips
    const hipsTimes: number[] = [];
    const hipsValues: number[] = [];
    const baseHips = basePose.hipsPosition || { x: 0, y: 0.85, z: 0 };
    const hipsYDeltaPerFrame: number[] = [];

    for (let i = 0; i <= frames; i++) {
      const t = (i / frames) * duration;
      hipsTimes.push(t);
      
      let swayX = 0, swayY = 0, swayZ = 0;
      
      if (type === 'wave') {
        const sway = Math.sin(t * Math.PI * 2 / duration) * 0.015 * energy;
        swayX = sway * 0.5;
        swayZ = sway * 0.2;
        swayY = Math.sin(t * frequency) * 0.005 * energy;
      } else if (type === 'breath' || type === 'idle') {
        swayY = Math.sin(t * frequency) * 0.005 * energy;
      }

      hipsYDeltaPerFrame.push(swayY); 
      hipsValues.push(baseHips.x + swayX, baseHips.y + swayY, baseHips.z + swayZ);
    }
    tracks.push({ 
      name: this.boneMap.hips + ".position", 
      type: "vector", 
      times: hipsTimes, 
      values: hipsValues 
    });

    // 2. Process Bones
    for (const [boneName, path] of Object.entries(this.boneMap)) {
      const times: number[] = [];
      const values: number[] = [];
      const baseEuler = (basePose[boneName] && basePose[boneName].x !== undefined) 
        ? basePose[boneName] 
        : { x: 0, y: 0, z: 0 };
        
      const limitKey = this.getLimitKey(boneName);
      
      let boneLag = 0;
      if (boneName === 'spine' || boneName === 'chest') boneLag = lagHipsToChest * 0.5;
      if (boneName === 'neck') boneLag = lagHipsToChest + (lagChestToHead * 0.5);
      if (boneName === 'head') boneLag = lagHipsToChest + lagChestToHead;
      
      if (boneName.includes('Shoulder')) boneLag = lagHipsToChest + 0.05;
      if (boneName.includes('UpperArm')) boneLag = lagHipsToChest + 0.05 + (lagShoulderToHand * 0.33);
      if (boneName.includes('LowerArm')) boneLag = lagHipsToChest + 0.05 + (lagShoulderToHand * 0.66);
      if (boneName.includes('Hand')) boneLag = lagHipsToChest + 0.05 + lagShoulderToHand;
      // Fingers lag behind hand
      if (boneName.includes('Index') || boneName.includes('Middle') || boneName.includes('Ring') || boneName.includes('Little') || boneName.includes('Thumb')) {
        boneLag = lagHipsToChest + 0.05 + lagShoulderToHand + 0.05;
      }

      for (let i = 0; i <= frames; i++) {
        const t = (i / frames) * duration;
        times.push(t);
        
        let target = { ...baseEuler };
        const phase = (t - boneLag) * frequency;
        const signal = this.bioSin(phase) * energy;

        if (boneName.includes('Leg')) {
           target = this.solveLegIK(boneName, target, hipsYDeltaPerFrame[i]);
        }

        // Apply Hand Synergy
        if (boneName.includes('Index') || boneName.includes('Middle') || boneName.includes('Ring') || boneName.includes('Little') || boneName.includes('Thumb')) {
           target = this.solveHandSynergy(boneName, target, t, energy);
        }

        // --- DISPATCH GESTURE LOGIC ---
        
        if (type === 'wave') {
           this.solveWaveGesture(boneName, t, frequency, energy, target, signal, boneLag, spineCoupling, coreCoupling);
        }
        else if (type === 'point') {
           this.solvePointGesture(boneName, t, frequency, energy, target, phase, boneLag);
        }
        else if (type === 'breath' || type === 'idle') {
           this.solveIdleGesture(boneName, phase, energy, target);
        }

        // --- DYNAMICS & NOISE ---
        let jitterAmp = 0.2; 
        if (limitKey && this.dynamics[limitKey]) {
          jitterAmp = this.dynamics[limitKey].avgSpeedDeg * 0.002;
        }
        // Fingers need less noise
        if (boneName.includes('Index') || boneName.includes('Thumb')) jitterAmp *= 0.1;
        
        jitterAmp *= noiseScale;

        target.x += this.noise(t, 0, jitterAmp);
        target.y += this.noise(t, 13, jitterAmp);
        target.z += this.noise(t, 29, jitterAmp);

        // --- CONSTRAINTS ---
        if (limitKey && this.limits[limitKey]) {
          const l = this.limits[limitKey].limits;
          target.x = this.clamp(target.x, l.x[0], l.x[1]);
          target.y = this.clamp(target.y, l.y[0], l.y[1]);
          target.z = this.clamp(target.z, l.z[0], l.z[1]);
        }

        const e = new THREE.Euler(
          THREE.MathUtils.degToRad(target.x),
          THREE.MathUtils.degToRad(target.y),
          THREE.MathUtils.degToRad(target.z),
          'XYZ'
        );
        const q = new THREE.Quaternion().setFromEuler(e);
        values.push(q.x, q.y, q.z, q.w);
      }
      
      tracks.push({ 
        name: path + ".quaternion", 
        type: "quaternion", 
        times: times, 
        values: values 
      });
    }

    return { 
      name: `Procedural_${type}_${Date.now()}`, 
      duration: duration, 
      tracks 
    };
  }
}

export const motionEngine = new MotionEngine();
