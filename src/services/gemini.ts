import { GoogleGenerativeAI } from '@google/generative-ai';
import * as THREE from 'three';
import type { VRMPose } from '@pixiv/three-vrm';
import limitsData from '../poses/skeleton_limits.json';

// System prompt that defines the expected output format
const SYSTEM_PROMPT = `
You are an expert 3D animator and rigger specialized in VRM/GLTF avatars.
Your task is to generate a JSON object representing a specific body pose for a VRM avatar based on a text description.

The output MUST be a valid JSON object with the following structure:
{
  "vrmPose": {
    "boneName": {
      "rotation": [x, y, z], // Euler Angles in Degrees
      "position": [x, y, z]  // Optional, only for hips usually
    }
  },
  "expressions": {
    "presetName": value // 0.0 to 1.0
  }
}

Supported bone names:
hips, spine, chest, upperChest, neck, head,
leftShoulder, leftUpperArm, leftLowerArm, leftHand,
rightShoulder, rightUpperArm, rightLowerArm, rightHand,
leftUpperLeg, leftLowerLeg, leftFoot, leftToes,
rightUpperLeg, rightLowerLeg, rightFoot, rightToes,
leftThumbProximal, leftThumbIntermediate, leftThumbDistal,
leftIndexProximal, leftIndexIntermediate, leftIndexDistal,
leftMiddleProximal, leftMiddleIntermediate, leftMiddleDistal,
leftRingProximal, leftRingIntermediate, leftRingDistal,
leftLittleProximal, leftLittleIntermediate, leftLittleDistal,
rightThumbProximal, rightThumbIntermediate, rightThumbDistal,
rightIndexProximal, rightIndexIntermediate, rightIndexDistal,
rightMiddleProximal, rightMiddleIntermediate, rightMiddleDistal,
rightRingProximal, rightRingIntermediate, rightRingDistal,
rightLittleProximal, rightLittleIntermediate, rightLittleDistal

Supported Expression/BlendShape Names:
- Standard VRM: neutral, happy, angry, sad, relaxed, surprised, aa, ih, ou, ee, oh, blink, blinkLeft, blinkRight, lookUp, lookDown, lookLeft, lookRight
- Application Presets: joy, calm, surprise
- ARKit (52 keys) if available on model (e.g. jawOpen, mouthSmileLeft, eyeBlinkLeft, browInnerUp, etc.)

IMPORTANT GUIDELINES:
1. Use Euler Angles in DEGREES (x, y, z). Do NOT use Quaternions.
2. The avatar is in a T-Pose by default.
3. Coordinate System (Right-Handed, Y-Up, -Z Forward):
   - X Axis (Pitch): Positive = Bend Forward/Down. Negative = Bend Backward/Up.
   - Y Axis (Yaw): Positive = Turn Left. Negative = Turn Right.
   - Z Axis (Roll): Positive = Tilt Left. Negative = Tilt Right.
4. "hips" position is [x, y, z]. Default standing is [0, 0.85, 0].
5. Ensure the pose is physically possible.

BIO-CONSTRAINTS & HEURISTICS (Strictly follow these ranges):

1. LEGS (Thighs):
   - X-axis: +X = SIT/KNEE UP (0 to 90). -X = Extension (-20). 
   - Z-axis: Spread legs (0 to 20).
   - "Sitting": X should be ~70 to 90.

2. KNEES (Lower Legs):
   - X-axis: -X = BEND BACK (-130 to 0). 
   - Knees DO NOT bend forward (+X is invalid).
   - "Sitting": X should be ~-80.

3. ARMS (Left vs Right Symmetry):
   - Left Arm (+X axis in T-pose):
     - Z: +20 to +90 (Arm Down), -90 (Arm Up).
     - Y: -70 (Forward), +20 (Back).
   - Right Arm (-X axis in T-pose):
     - Z: -20 to -90 (Arm Down), +90 (Arm Up).
     - Y: +70 (Forward), -20 (Back).
   - ELBOWS (Forearms):
     - Left: -Y = BEND (-160 to 0). X/Z are usually 0 or small twists.
     - Right: +Y = BEND (0 to 160). X/Z are usually 0 or small twists.

4. FINGERS (Hand Gestures):
   - Curl direction depends on the hand side!
   - LEFT Hand Fingers: +Z = CURL (Close), -Z = OPEN (Backwards).
   - RIGHT Hand Fingers: -Z = CURL (Close), +Z = OPEN (Backwards).
   - Thumb: Rotates mostly on Y and Z.

5. SPINE/HEAD:
   - Spine/Chest: Small rotations (Max 10-20 degrees).
   - Head: Look up/down (-30 to 30), Turn (-40 to 40).

5. HIPS (Root):
   - Position: [0, y, 0]. y ~ 0.85 (Standing), y ~ 0.5 (Sitting/Crouching).
   - Rotation: Global orientation.

Example "Sitting on chair":
{
  "vrmPose": {
    "hips": { "position": [0, 0.55, 0], "rotation": [0, 0, 0] },
    "leftUpperLeg": { "rotation": [80, 0, 0] },
    "leftLowerLeg": { "rotation": [-80, 0, 0] },
    "rightUpperLeg": { "rotation": [80, 0, 0] },
    "rightLowerLeg": { "rotation": [-80, 0, 0] },
    "leftUpperArm": { "rotation": [0, 0, 70] },
    "rightUpperArm": { "rotation": [0, 0, -70] },
    "leftLowerArm": { "rotation": [0, -20, 0] }, 
    "rightLowerArm": { "rotation": [0, 20, 0] }
  }
}
`;

// Standard VRM Humanoid Bone Names (VRM 0.0 & 1.0 Compatible)
const VALID_BONES = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  'leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal',
  'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
  'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
  'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
  'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  'rightThumbProximal', 'rightThumbIntermediate', 'rightThumbDistal',
  'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
  'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
  'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
  'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal'
];

type LimitStats = { limits: { x: number[]; y: number[]; z: number[] }; primaryAxis: string; };

// System prompt for Animation generation
const ANIMATION_SYSTEM_PROMPT = `
You are an expert 3D animator.
Your task is to generate a JSON object representing an Animation Clip for a VRM avatar.

The output MUST be a valid JSON object with the following structure (compatible with THREE.js animation clips):
{
  "name": "animation_name",
  "duration": 2.0, // Length in seconds
  "tracks": [
    {
      "name": "boneName.rotation", // OR "hips.position"
      "type": "quaternion",        // OR "vector" for position
      "times": [0, 1, 2],          // Keyframe times in seconds
      "values": [x, y, z, w, ...]  // Flat array of values (4 per quaternion, 3 per vector)
    }
  ]
}

Supported bones: SAME AS POSE SYSTEM (hips, spine, rightUpperArm, etc).
For rotation tracks, use type "quaternion".
For position tracks, use type "vector" (only for hips).

CRITICAL ANIMATION GUIDELINES:
1. Interpolation: Use smooth transitions. The "times" array must have at least 3 keyframes (start, middle, end) for simple moves, more for complex ones.
2. Natural Motion: 
   - Move multiple bones (e.g., if arm moves, adjust spine/shoulder slightly).
   - Avoid robotic linear movement.
   - For "breathing" or "idle", use subtle sine-wave motions on chest/spine.
3. Looping vs One-Shot:
   - If the request implies a LOOP (e.g. "dance", "idle", "walk"): Ensure the start values (time=0) and end values (time=duration) are IDENTICAL for all tracks.
   - If One-Shot (e.g. "jump", "fall"): Start from T-pose or neutral, execute action, and hold or return to neutral.
4. Timing:
   - Fast actions (punch): 0.5 - 1.0s.
   - Slow actions (idle): 2.0 - 4.0s.
5. Quaternion Math: Ensure quaternions are normalized.
6. Hips Position: Use "hips.position" to move the entire body (e.g. jumping up/down). Default Y is ~0.85.

Output raw JSON only.
`;

// Standard Humanoid Limits (Symmetric & Physically Reasonable)
// Overrides the potentially restrictive/asymmetric data from skeleton_limits.json
const HUMANOID_LIMITS: Record<string, { x: [number, number], y: [number, number], z: [number, number] }> = {
  // LEGS
  'upper_legL': { x: [-30, 130], y: [-45, 45], z: [-30, 50] },
  'upper_legR': { x: [-30, 130], y: [-45, 45], z: [-30, 50] },
  'lower_legL': { x: [-160, 0], y: [-20, 20], z: [-10, 10] },
  'lower_legR': { x: [-160, 0], y: [-20, 20], z: [-10, 10] },
  
  // ARMS
  'upper_armL': { x: [-180, 180], y: [-180, 180], z: [-180, 180] },
  'upper_armR': { x: [-180, 180], y: [-180, 180], z: [-180, 180] },
  'lower_armL': { x: [-10, 10], y: [-160, 0], z: [-20, 20] }, // Elbows bend on Y usually in VRM, sometimes X depending on T-pose
  'lower_armR': { x: [-10, 10], y: [0, 160], z: [-20, 20] },

  // SPINE/HEAD
  'spine': { x: [-30, 30], y: [-45, 45], z: [-20, 20] },
  'chest': { x: [-30, 30], y: [-45, 45], z: [-20, 20] },
  'neck': { x: [-40, 40], y: [-60, 60], z: [-30, 30] },
  'head': { x: [-40, 40], y: [-60, 60], z: [-30, 30] },
};

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private apiKey: string = '';
  private limits: { [key: string]: LimitStats };

  constructor() {
    this.limits = limitsData as any;
  }

  initialize(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Fallback to gemini-pro-latest as strictly requested.
    // We will let the user configure this or we'll detect availability.
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-pro-latest',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  async listAvailableModels(): Promise<string[]> {
    if (!this.apiKey) return [];
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      const data = await response.json();
      return data.models
        ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', '')) || [];
    } catch (error) {
      console.error('[GeminiService] Failed to list models:', error);
      return [];
    }
  }

  setModel(modelName: string) {
    if (!this.genAI) return;
    this.model = this.genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  isReady(): boolean {
    return !!this.model;
  }

  private getLimitKey(boneName: string): string | null {
    // Try exact match first
    if (this.limits[boneName]) return boneName;

    // Mapping based on motionEngine logic
    const map: { [key: string]: string } = {
      rightUpperArm: "upper_armR", rightLowerArm: "lower_armR",
      leftUpperArm: "upper_armL", leftLowerArm: "lower_armL",
      spine: "spine", chest: "chest", hips: "hips", upperChest: "upperChest",
      head: "head", neck: "neck",
      rightShoulder: "shoulderR", leftShoulder: "shoulderL",
      rightUpperLeg: "upper_legR", rightLowerLeg: "lower_legR",
      leftUpperLeg: "upper_legL", leftLowerLeg: "lower_legL",
      rightFoot: "footR", leftFoot: "footL",
      rightHand: "handR", leftHand: "handL"
    };
    
    // Auto-map simple matches from MotionEngine logic
    if (map[boneName]) return map[boneName];

    // Attempt to map fingers (e.g. rightIndexProximal -> index_proximalR)
    if (boneName.includes('Index') || boneName.includes('Middle') || boneName.includes('Ring') || boneName.includes('Little') || boneName.includes('Thumb')) {
       const side = boneName.startsWith('right') ? 'R' : 'L';
       // Convert camelCase "rightIndexProximal" to snake_case "index_proximal"
       const part = boneName
         .replace('right', '')
         .replace('left', '')
         .replace(/([A-Z])/g, '_$1')
         .toLowerCase()
         .substring(1); // remove leading underscore
       
       const key = `${part}${side}`;
       if (this.limits[key]) return key;
    }
    
    return null;
  }

  private clamp(val: number, min: number, max: number): number {
    // Normalize to -180 to 180 to handle wrapping
    let angle = val;
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    
    // If angle is within limits, return it
    if (angle >= min && angle <= max) return angle;
    
    // If the un-wrapped value was within limits (e.g. limits are 0 to 360), return original
    if (val >= min && val <= max) return val;
    
    return Math.min(Math.max(angle, min), max);
  }

  private sanitizePose(pose: any): any {
    const cleanPose: any = {};
    const corrections: Record<string, string> = {
      'right_arm': 'rightUpperArm', 'left_arm': 'leftUpperArm',
      'right_leg': 'rightUpperLeg', 'left_leg': 'leftUpperLeg',
      'right_hand': 'rightHand', 'left_hand': 'leftHand',
      'right_foot': 'rightFoot', 'left_foot': 'leftFoot',
      'waist': 'hips', 'pelvis': 'hips'
    };

    Object.entries(pose).forEach(([key, value]) => {
      // 1. Check exact match
      if (VALID_BONES.includes(key)) {
        cleanPose[key] = value;
        return;
      }
      
      // 2. Check common aliases
      if (corrections[key]) {
        cleanPose[corrections[key]] = value;
        return;
      }
      
      // 3. Case insensitive check
      const lowerKey = key.toLowerCase();
      const match = VALID_BONES.find(b => b.toLowerCase() === lowerKey);
      if (match) {
        cleanPose[match] = value;
      }
    });
    
    return cleanPose;
  }

  private enforceLimits(pose: any): VRMPose {
    // Sanitize keys first
    const sanitizedPose = this.sanitizePose(pose);
    
    // Note: Input 'pose' here is using Euler Angles (Degrees) from AI
    const newPose: any = {};
    
    const boneCount = Object.keys(sanitizedPose).length;
    console.log('[GeminiService] Processing Euler pose. Bone count:', boneCount);
    
    if (boneCount === 0) {
      console.warn('[GeminiService] No valid bones found after sanitization. Original pose keys:', Object.keys(pose));
    }

    Object.entries(sanitizedPose).forEach(([boneName, transform]: [string, any]) => {
      if (!transform || !transform.rotation) return;
      
      // Get AI Euler
      let x = transform.rotation[0];
      let y = transform.rotation[1];
      let z = transform.rotation[2];
      
      const limitKey = this.getLimitKey(boneName);
      let limits = null;

      // Prefer hardcoded sane limits for major bones
      if (limitKey && HUMANOID_LIMITS[limitKey]) {
        const hl = HUMANOID_LIMITS[limitKey];
        limits = { x: hl.x, y: hl.y, z: hl.z };
      } else if (limitKey && this.limits[limitKey]) {
        // Fallback to loaded JSON
        const l = this.limits[limitKey].limits;
        limits = { x: l.x, y: l.y, z: l.z };
      }

      if (limits) {
        // Clamp (with wrapping handling)
        const cx = this.clamp(x, limits.x[0], limits.x[1]);
        const cy = this.clamp(y, limits.y[0], limits.y[1]);
        const cz = this.clamp(z, limits.z[0], limits.z[1]);
        
        // Log significant corrections
        if (Math.abs(cx - x) > 10 || Math.abs(cy - y) > 10 || Math.abs(cz - z) > 10) {
           console.log(`[GeminiService] Correcting ${boneName}: [${x}, ${y}, ${z}] -> [${cx}, ${cy}, ${cz}]`);
        }
        
        x = cx;
        y = cy;
        z = cz;
      }
      
      // Convert Euler (Deg) -> Quaternion
      const e = new THREE.Euler(
        THREE.MathUtils.degToRad(x),
        THREE.MathUtils.degToRad(y),
        THREE.MathUtils.degToRad(z),
        'XYZ'
      );
      const q = new THREE.Quaternion().setFromEuler(e);
      
      newPose[boneName] = {
        rotation: [q.x, q.y, q.z, q.w]
      };
      
      if (transform.position) {
        newPose[boneName].position = transform.position;
      }
    });
    
    return newPose as VRMPose;
  }

  // Convert raw Euler JSON to VRMPose (Quaternion) without clamping
  private convertEulerToQuaternion(pose: any): VRMPose {
    const newPose: any = {};
    Object.entries(pose).forEach(([boneName, transform]: [string, any]) => {
      if (!transform || !transform.rotation) return;
      const [x, y, z] = transform.rotation;
      const e = new THREE.Euler(
        THREE.MathUtils.degToRad(x),
        THREE.MathUtils.degToRad(y),
        THREE.MathUtils.degToRad(z),
        'XYZ'
      );
      const q = new THREE.Quaternion().setFromEuler(e);
      newPose[boneName] = {
        rotation: [q.x, q.y, q.z, q.w],
        position: transform.position
      };
    });
    return newPose as VRMPose;
  }

  async generatePose(prompt: string, useLimits = true, isAnimation = false, isLoop = true): Promise<{ vrmPose?: VRMPose; sceneRotation?: { x: number, y: number, z: number }; tracks?: any[]; expressions?: Record<string, number>; rawJson: string } | null> {
    if (!this.model) {
      throw new Error('Gemini API not initialized. Please provide an API key.');
    }

    try {
      const systemPrompt = isAnimation ? ANIMATION_SYSTEM_PROMPT : SYSTEM_PROMPT;
      console.log('[GeminiService] Generating with model:', this.model.model, isAnimation ? '(Animation)' : '(Pose)');
      
      let fullPrompt = systemPrompt + '\n\nUser Prompt: ' + prompt;
      if (isAnimation) {
        fullPrompt += `\n\nAnimation Constraints:
        - Type: ${isLoop ? 'LOOPING (Start pose MUST equal End pose)' : 'ONE-SHOT (Action sequence)'}
        - Focus on creating a realistic, high-quality animation for a 3D humanoid.`;
      }

      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();
      
      console.log('[GeminiService] Raw response:', text);

      // Clean up potential markdown code blocks
      const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      const jsonOnly = cleanJson.substring(firstBrace, lastBrace + 1);
      
      const parsed = JSON.parse(jsonOnly);
      
      if (isAnimation) {
         // Return animation structure directly
         return { ...parsed, rawJson: text };
      }
      
      let finalPose: VRMPose;
      
      if (parsed.vrmPose) {
        if (useLimits) {
          console.log('[GeminiService] Enforcing skeleton limits...');
          finalPose = this.enforceLimits(parsed.vrmPose);
        } else {
          console.log('[GeminiService] Converting Euler to Quaternion...');
          finalPose = this.convertEulerToQuaternion(parsed.vrmPose);
        }
        parsed.vrmPose = finalPose;
      }
      
      return { ...parsed, rawJson: text };
    } catch (error) {
      console.error('[GeminiService] Generation failed:', error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
