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
interface PoseData { 
  [bone: string]: { x: number; y: number; z: number } | { rotation: number[] } | any; 
  hipsPosition?: { x: number; y: number; z: number };
}

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
  /** Emotional state for idle/breathing animations */
  emotion?: 'neutral' | 'happy' | 'sad' | 'alert' | 'tired' | 'nervous';
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

  public getBoneMap(): BoneMap {
    // We now return standard VRMHumanBoneNames so they can be re-targeted later
    const map: BoneMap = {
      hips: "hips",
      spine: "spine",
      chest: "chest",
      neck: "neck",
      head: "head",
      rightShoulder: "rightShoulder",
      rightUpperArm: "rightUpperArm",
      rightLowerArm: "rightLowerArm",
      rightHand: "rightHand",
      leftShoulder: "leftShoulder",
      leftUpperArm: "leftUpperArm",
      leftLowerArm: "leftLowerArm",
      leftHand: "leftHand",
      rightUpperLeg: "rightUpperLeg",
      rightLowerLeg: "rightLowerLeg",
      rightFoot: "rightFoot",
      leftUpperLeg: "leftUpperLeg",
      leftLowerLeg: "leftLowerLeg",
      leftFoot: "leftFoot"
    };

    // Add Fingers
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
    const segments = ['Proximal', 'Intermediate', 'Distal'];
    
    // Right Hand Fingers
    fingers.forEach(f => {
      segments.forEach(s => {
        if (f === 'Thumb' && s === 'Intermediate') return; 
        const key = `right${f}${s}`;
        // VRM bone name: rightIndexProximal, etc.
        map[key] = key; 
      });
    });

    // Left Hand Fingers
    fingers.forEach(f => {
      segments.forEach(s => {
        const key = `left${f}${s}`;
        map[key] = key;
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
    // Multi-octave noise for organic feel
    const n1 = Math.sin(t * 1.5 + offset);
    const n2 = Math.sin(t * 3.7 + offset * 1.3) * 0.5;
    const n3 = Math.sin(t * 7.1 + offset * 0.7) * 0.25;
    return (n1 + n2 + n3) * amp;
  }

  public clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Apply safety limits to a bone rotation
   */
  public constrainRotation(boneName: string, rotation: {x:number, y:number, z:number}): {x:number, y:number, z:number} {
      // 1. Get mapped limit key (e.g. rightUpperArm -> upper_armR)
      const limitKey = this.getLimitKey(boneName);
      
      // 2. Check if we have specific limits for this bone
      if (limitKey && this.limits[limitKey]) {
          const l = this.limits[limitKey].limits;
          
          // Apply strict limits from skeleton_limits.json
          // We add a small buffer (5 degrees) to prevent hard robotic stops
          const buffer = 5;
          
          return {
              x: this.clamp(rotation.x, l.x[0] - buffer, l.x[1] + buffer),
              y: this.clamp(rotation.y, l.y[0] - buffer, l.y[1] + buffer),
              z: this.clamp(rotation.z, l.z[0] - buffer, l.z[1] + buffer)
          };
      }

      // 3. Fallback to general safety limits
      const safety = 170; // Degrees
      return {
          x: this.clamp(rotation.x, -safety, safety),
          y: this.clamp(rotation.y, -safety, safety),
          z: this.clamp(rotation.z, -safety, safety)
      };
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

  private solveIdleGesture(boneName: string, phase: number, energy: number, target: {x:number, y:number, z:number}, emotion: string) {
     let breathAmp = 1.0;
     let speedMult = 1.0;

     // Emotional variations
     switch(emotion) {
        case 'happy': 
          breathAmp = 1.5; speedMult = 1.2; 
          if(boneName === 'chest') target.x -= 5; // Chest up
          if(boneName === 'head') target.x -= 5; // Chin up
          break;
        case 'sad': 
          breathAmp = 0.5; speedMult = 0.8;
          if(boneName === 'chest') target.x += 10; // Slump
          if(boneName === 'head') target.x += 15; // Head down
          if(boneName.includes('Shoulder')) target.z += 5; // Shoulders drop/forward
          break;
        case 'alert':
          breathAmp = 0.8; speedMult = 1.5;
          if(boneName === 'spine') target.x -= 2; // Rigid
          break;
        case 'tired':
          breathAmp = 0.3; speedMult = 0.5;
          if(boneName === 'head') target.x += 10;
          if(boneName === 'spine') target.x += 5;
          break;
        case 'nervous':
          breathAmp = 2.0; speedMult = 2.5;
          break;
     }

     const t = phase * speedMult;

     if (boneName === 'spine' || boneName === 'chest') {
       target.x += Math.sin(t) * 1.5 * energy * breathAmp; 
     }
     if (boneName.includes('Shoulder')) {
       target.y -= Math.sin(t) * 1.0 * energy * breathAmp; 
     }
     if (boneName === 'head') {
       target.x += Math.sin(t) * 0.5 * energy * breathAmp;
     }
  }

  private solveShrugGesture(boneName: string, t: number, frequency: number, energy: number, target: {x:number, y:number, z:number}) {
     // A simple shrug pulse
     // Use a bell curve or simple sin hump for the shrug duration
     // Assuming t goes 0->duration, we want the shrug to peak in middle
     
     // Map t (0..duration) to 0..PI
     // Actually t is time in seconds. 
     // Let's use a simpler sin wave that peaks and returns
     
     const shrugLift = Math.pow(Math.sin(t * frequency), 2) * energy; // 0 -> 1 -> 0

     if (boneName.includes('Shoulder')) {
       target.z += 15 * shrugLift; // Lift shoulders (Z-axis in VRM is usually forward/back or up/down depending on rest pose, standard VRM T-pose shoulder Z is up/down? No, Y is up, Z is forward. Wait. VRM bones: +Y is axis of bone. Rotation depends on parent. 
       // Standard VRM T-Pose: 
       // Shoulder: +Y is arm direction? No. 
       // Let's assume standard humanoid rig limits.
       // Usually Shoulder Z rotation lifts it.
       target.z += 15 * shrugLift;
     }

     if (boneName.includes('UpperArm')) {
       target.z -= 10 * shrugLift; // Arms flare out slightly
       target.y += 20 * shrugLift; // Palms turn forward (supination)
     }
     
     if (boneName.includes('Hand')) {
        target.y += 30 * shrugLift; // Hands turn up
        target.x -= 10 * shrugLift; // Wrist extend
     }

     if (boneName === 'head') {
       target.z += Math.sin(t * frequency * 2) * 2 * energy; // Slight wobble
       target.x += 5 * shrugLift; // Tilt back slightly? Or forward?
     }
  }

  private solveNodGesture(boneName: string, t: number, frequency: number, energy: number, target: {x:number, y:number, z:number}) {
     const nod = Math.sin(t * frequency * 2) * 15 * energy; // Faster frequency for nod
     
     if (boneName === 'head') {
       target.x += nod;
     }
     if (boneName === 'neck') {
       target.x += nod * 0.5; // Neck follows
     }
  }

  private solveShakeGesture(boneName: string, t: number, frequency: number, energy: number, target: {x:number, y:number, z:number}) {
     const shake = Math.sin(t * frequency * 2) * 20 * energy;
     
     if (boneName === 'head') {
       target.y += shake;
     }
     if (boneName === 'neck') {
       target.y += shake * 0.5;
     }
  }

  // --- CORE GENERATION ---

  public generateProceduralAnimation(
    basePose: PoseData, 
    type: 'wave' | 'idle' | 'breath' | 'point' | 'shrug' | 'nod' | 'shake',
    config: MotionConfig = {}
  ) {
    const duration = config.duration || 2.0;
    const fps = config.fps || 30;
    const frames = Math.floor(duration * fps);
    const frequency = (config.frequency || 2.0) * (Math.PI * 2 / duration);
    const energy = config.energy !== undefined ? config.energy : 1.0;
    const noiseScale = config.noiseScale !== undefined ? config.noiseScale : 1.0;
    const coreCoupling = config.coreCoupling !== undefined ? config.coreCoupling : 1.0;
    const emotion = config.emotion || 'neutral';

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
        // Emotion sway
        if (emotion === 'nervous') swayX = Math.sin(t * frequency * 3) * 0.005;
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
      let baseEuler = { x: 0, y: 0, z: 0 };

      // FIX: Handle VRMPose Quaternion input and convert to Euler
      const poseBone = basePose[boneName];
      if (poseBone) {
        if (poseBone.rotation) {
           // It's a Quaternion array [x, y, z, w]
           const q = new THREE.Quaternion().fromArray(poseBone.rotation);
           const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
           baseEuler = {
             x: THREE.MathUtils.radToDeg(e.x),
             y: THREE.MathUtils.radToDeg(e.y),
             z: THREE.MathUtils.radToDeg(e.z)
           };
        } else if (poseBone.x !== undefined) {
           // It's already Euler
           baseEuler = poseBone;
        }
      }
        
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
        
        switch(type) {
           case 'wave':
             this.solveWaveGesture(boneName, t, frequency, energy, target, signal, boneLag, spineCoupling, coreCoupling);
             break;
           case 'point':
             this.solvePointGesture(boneName, t, frequency, energy, target, phase, boneLag);
             break;
           case 'breath':
           case 'idle':
             this.solveIdleGesture(boneName, phase, energy, target, emotion);
             break;
           case 'shrug':
             this.solveShrugGesture(boneName, t, frequency, energy, target);
             break;
           case 'nod':
             this.solveNodGesture(boneName, t, frequency, energy, target);
             break;
           case 'shake':
             this.solveShakeGesture(boneName, t, frequency, energy, target);
             break;
        }

        // --- DYNAMICS & NOISE ---
        let jitterAmp = 0.2; 
        if (limitKey && this.dynamics[limitKey]) {
          jitterAmp = this.dynamics[limitKey].avgSpeedDeg * 0.002;
        }
        // Fingers need less noise
        if (boneName.includes('Index') || boneName.includes('Thumb')) jitterAmp *= 0.1;
        
        jitterAmp *= noiseScale;
        
        // Boost noise for nervous emotion
        if (emotion === 'nervous') jitterAmp *= 3.0;

        target.x += this.noise(t, 0, jitterAmp);
        target.y += this.noise(t, 13, jitterAmp);
        target.z += this.noise(t, 29, jitterAmp);

        // --- CONSTRAINTS ---
        // Disable hard limits for now as they may conflict with user-defined poses or T-pose basis
        // if (limitKey && this.limits[limitKey]) {
        //   const l = this.limits[limitKey].limits;
        //   target.x = this.clamp(target.x, l.x[0], l.x[1]);
        //   target.y = this.clamp(target.y, l.y[0], l.y[1]);
        //   target.z = this.clamp(target.z, l.z[0], l.z[1]);
        // }

        // Apply soft safety limits instead (prevent broken joints)
        const safety = 170; // Degrees
        target.x = this.clamp(target.x, -safety, safety);
        target.y = this.clamp(target.y, -safety, safety);
        target.z = this.clamp(target.z, -safety, safety);

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
