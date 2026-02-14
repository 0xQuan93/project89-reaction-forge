import * as THREE from 'three';
import { avatarManager } from "../../three/avatarManager";
import { sceneManager } from "../../three/sceneManager";
import { useAIStore } from "../../state/useAIStore";
import { useSceneSettingsStore } from "../../state/useSceneSettingsStore";
import { geminiService } from "../../services/gemini";
import { avatarController, type GestureType, type EmotionState } from "../AvatarController";
import type { ExpressionId, PoseId } from "../../types/reactions";

// Valid pose IDs that exist in the pose library
const VALID_POSE_IDS: PoseId[] = [
  'dawn-runner', 'sunset-call', 'cipher-whisper', 'nebula-drift',
  'signal-reverie', 'agent-taunt', 'agent-dance',
  'agent-clapping', 'silly-agent', 'simple-wave', 'point',
  'locomotion-walk', 'locomotion-run', 'locomotion-jog', 'locomotion-crouch-walk',
  'idle-neutral', 'idle-happy', 'idle-breathing', 'idle-nervous',
  'sit-chair', 'sit-sad', 'emote-wave', 'emote-thumbsup', 'action-swim'
];

// Map AI commands to actual pose IDs
const POSE_COMMAND_MAP: Record<string, PoseId> = {
  'wave': 'emote-wave',
  'dance': 'agent-dance',
  'point': 'emote-point',
  'victory': 'emote-cheer',
  'celebrate': 'emote-cheer',
  'think': 'cipher-whisper',
  'ponder': 'cipher-whisper',
  'angry': 'idle-offensive',
  'taunt': 'emote-taunt',
  'clap': 'emote-clap',
  'silly': 'emote-dance-silly',
  'walk': 'locomotion-walk',
  'run': 'locomotion-run',
  'jog': 'locomotion-jog',
  'sit': 'sit-chair',
  'sad_sit': 'sit-sad',
  'bow': 'emote-bow',
  'thumbsup': 'emote-thumbsup',
  'swim': 'action-swim',
  'focus': 'action-focus'
};

// Map AI commands to gestures (new system)
const GESTURE_COMMAND_MAP: Record<string, GestureType> = {
  'wave': 'wave',
  'nod': 'nod',
  'shake': 'shake',
  'shrug': 'shrug',
  'point': 'point',
  'thumbsup': 'thumbsUp',
  'clap': 'clap',
  'bow': 'bow',
  'celebrate': 'celebrate',
  'think': 'think',
  'listen': 'listen',
  'acknowledge': 'acknowledge',
};

// Map AI commands to emotions
const EMOTION_COMMAND_MAP: Record<string, EmotionState> = {
  'happy': 'happy',
  'joy': 'happy',
  'sad': 'sad',
  'angry': 'angry',
  'surprised': 'surprised',
  'thinking': 'thinking',
  'excited': 'excited',
  'tired': 'tired',
  'nervous': 'nervous',
  'neutral': 'neutral',
  'calm': 'neutral',
};

export class ActionParser {
  static async execute(response: string, speak: (text: string) => void) {
    console.log("🤖 AI Response:", response);
    
    // 0. Safety check - ensure VRM is loaded
    if (!avatarManager.getVRM()) {
      console.warn("[ActionParser] No VRM loaded - skipping avatar commands");
      // Still speak the response
      const cleanText = response.replace(/\[.*?\]/g, '');
      speak(cleanText);
      return;
    }
    
    // 1. Speak (Using Browser TTS for now, mapped to your LipSync)
    const cleanText = response.replace(/\[.*?\]/g, ''); // Remove commands from speech
    speak(cleanText);
    
    let actionTaken = false;

    // 2. Check for Reaction commands first (gesture + emotion combo)
    const reactMatch = response.match(/\[REACT:\s*(\w+)\]/i);
    if (reactMatch && reactMatch[1]) {
      const reaction = reactMatch[1].toLowerCase();
      console.log(`[ActionParser] Executing reaction: ${reaction}`);
      try {
        await avatarController.react(reaction);
        actionTaken = true;
      } catch (e) {
        console.error("[ActionParser] Failed to execute reaction:", e);
      }
    }

    // 3. Check for Gesture commands
    const gestureMatch = response.match(/\[GESTURE:\s*(\w+)\]/i);
    if (gestureMatch && gestureMatch[1]) {
      const gestureName = gestureMatch[1].toLowerCase();
      const gesture = GESTURE_COMMAND_MAP[gestureName];
      
      if (gesture) {
        console.log(`[ActionParser] Performing gesture: ${gesture}`);
        try {
          await avatarController.performGesture(gesture);
          actionTaken = true;
        } catch (e) {
          console.error("[ActionParser] Failed to perform gesture:", e);
        }
      } else {
        console.warn(`[ActionParser] Unknown gesture: ${gestureName}`);
      }
    }

    // 4. Check for Emotion commands
    const emotionMatch = response.match(/\[EMOTION:\s*(\w+)\]/i);
    if (emotionMatch && emotionMatch[1]) {
      const emotionName = emotionMatch[1].toLowerCase();
      const emotion = EMOTION_COMMAND_MAP[emotionName];
      
      if (emotion) {
        console.log(`[ActionParser] Setting emotion: ${emotion}`);
        try {
          await avatarController.setEmotion(emotion);
          actionTaken = true;
        } catch (e) {
          console.error("[ActionParser] Failed to set emotion:", e);
        }
      } else {
        console.warn(`[ActionParser] Unknown emotion: ${emotionName}`);
      }
    }

    // 5. Check for Generative Pose Command
    const genMatch = response.match(/\[GENERATE_POSE:\s*(.*?)\]/i);
    if (genMatch && genMatch[1]) {
        const description = genMatch[1];
        console.log(`[ActionParser] Generating custom pose: "${description}"`);
        useAIStore.getState().setThought("Generating Pose...");
        
        try {
            if (!geminiService.isReady()) {
                console.warn('[ActionParser] Gemini service not ready for pose generation');
            } else {
                const result = await geminiService.generatePose(description);
                if (result) {
                    // Apply generated pose
                    if (result.vrmPose) {
                        const rotationLocked = useSceneSettingsStore.getState().rotationLocked;
                        await avatarManager.applyRawPose({
                            vrmPose: result.vrmPose,
                            sceneRotation: result.sceneRotation
                        }, rotationLocked, 'static');
                    }
                    
                    // Apply generated background if provided
                    if ((result as any).background) {
                        await sceneManager.setBackground((result as any).background);
                    }
                    
                    console.log("[ActionParser] ✅ Generated pose/scene applied successfully");
                    actionTaken = true;
                }
            }
        } catch (e) {
            console.error("[ActionParser] Failed to generate pose:", e);
        }
        useAIStore.getState().setThought(null);
    }

    // 5b. Check for Background command
    const bgMatch = response.match(/\[BACKGROUND:\s*(.*?)\]/i);
    if (bgMatch && bgMatch[1]) {
        const bgId = bgMatch[1].trim();
        console.log(`[ActionParser] Changing background to: ${bgId}`);
        await sceneManager.setBackground(bgId);
        actionTaken = true;
    }

    // 5c. Check for Scene Rotation command
    const rotMatch = response.match(/\[SCENE_ROTATION:\s*(\d+)\]/i);
    if (rotMatch && rotMatch[1]) {
        const deg = parseInt(rotMatch[1]);
        const vrm = avatarManager.getVRM();
        
        // Respect rotation lock and manual posing mode
        const rotationLocked = useSceneSettingsStore.getState().rotationLocked;
        const isManualPosing = avatarManager.isManualPosingEnabled();
        
        if (vrm && !rotationLocked && !isManualPosing) {
            console.log(`[ActionParser] Rotating scene to: ${deg}deg`);
            vrm.scene.rotation.y = THREE.MathUtils.degToRad(deg);
            actionTaken = true;
        } else if (vrm) {
            console.log(`[ActionParser] Scene rotation blocked (locked: ${rotationLocked}, manual: ${isManualPosing})`);
        }
    }

    // 5d. Check for Export command
    const exportMatch = response.match(/\[EXPORT:\s*(\w+)\]/i);
    if (exportMatch && exportMatch[1]) {
        const type = exportMatch[1].toLowerCase();
        console.log(`[ActionParser] Triggering export: ${type}`);
        // We'll use the sceneManager capture for PNG
        if (type === 'png' || type === 'photo') {
            const dataUrl = await sceneManager.captureSnapshot();
            if (dataUrl) {
                const link = document.createElement('a');
                link.download = `poselab-ai-snapshot-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                actionTaken = true;
            }
        }
    }

    // 5e. Check for VMC command
    const vmcMatch = response.match(/\[VMC:\s*(\w+)\]/i);
    if (vmcMatch && vmcMatch[1]) {
        const cmd = vmcMatch[1].toLowerCase();
        console.log(`[ActionParser] VMC command: ${cmd}`);
        const { setVmcEnabled } = (await import('../../state/useReactionStore')).useReactionStore.getState();
        if (cmd === 'connect' || cmd === 'on') {
            setVmcEnabled(true);
            actionTaken = true;
        } else if (cmd === 'disconnect' || cmd === 'off') {
            setVmcEnabled(false);
            actionTaken = true;
        }
    }

    // 5f. Check for Visual Awareness command
    if (response.includes('[LOOK_AT_USER]')) {
        console.log(`[ActionParser] Visual Awareness triggered: Looking at user...`);
        useAIStore.getState().setThought("Watching...");
        try {
            // This is handled by a singleton or we need access to the manager instance
            // In PoseLab, we usually have a ref in a component, but let's see if we can find it globally
            // For now, let's assume we can trigger it via a message or a global access
            // (Note: In a real app, you'd export the manager instance)
            const { getMocapManager } = await import('../../utils/mocapInstance');
            const manager = getMocapManager();
            if (manager) {
                await manager.aiInterpret("The user wants you to look at them and interpret their state.");
                actionTaken = true;
            }
        } catch (e) {
            console.error("[ActionParser] Failed to look at user:", e);
        }
        useAIStore.getState().setThought(null);
    }

    // 5g. Check for Lighting command
    const lightMatch = response.match(/\[LIGHTING:\s*(\w+)\]/i);
    if (lightMatch && lightMatch[1]) {
        const presetId = lightMatch[1].toLowerCase();
        console.log(`[ActionParser] Changing lighting to: ${presetId}`);
        const { lightingManager } = await import('../../three/lightingManager');
        lightingManager.applyPreset(presetId);
        actionTaken = true;
    }

    // 5h. Check for Effects command
    const effectMatch = response.match(/\[EFFECTS:\s*(\w+)\]/i);
    if (effectMatch && effectMatch[1]) {
        const presetId = effectMatch[1].toLowerCase();
        console.log(`[ActionParser] Changing effects to: ${presetId}`);
        const { postProcessingManager } = await import('../../three/postProcessingManager');
        postProcessingManager.applyPreset(presetId);
        actionTaken = true;
    }

    // 6. Check for Preset Pose commands
    const poseMatch = response.match(/\[POSE:\s*(\w+)\]/i);
    if (poseMatch && poseMatch[1]) {
        const poseName = poseMatch[1].toLowerCase();
        const poseId = POSE_COMMAND_MAP[poseName];
        
        if (poseId) {
            const success = await this.applyPresetPose(poseId);
            if (success) actionTaken = true;
        } else if (VALID_POSE_IDS.includes(poseName as PoseId)) {
            const success = await this.applyPresetPose(poseName as PoseId);
            if (success) actionTaken = true;
        } else {
            console.warn(`[ActionParser] Unknown pose command: ${poseName}`);
        }
    }
    
    // 7. Legacy Expression commands (backwards compatibility)
    const exprMatch = response.match(/\[EXPRESSION:\s*(\w+)\]/i);
    if (exprMatch && exprMatch[1]) {
        const exprName = exprMatch[1].toLowerCase();
        const emotion = EMOTION_COMMAND_MAP[exprName];
        if (emotion) {
            await avatarController.setEmotion(emotion);
            actionTaken = true;
        } else {
            // Fallback to old system
            const legacyExpr = exprName as ExpressionId;
            if (['joy', 'surprise', 'calm'].includes(legacyExpr)) {
                avatarManager.applyExpression(legacyExpr);
                actionTaken = true;
            }
        }
    }
    
    // 8. If no action was taken, start idle animation to feel alive
    if (!actionTaken) {
       this.triggerSpeaking();
       avatarController.startIdleAnimation();
    }
  }

  // Helper to safely apply a preset pose with error handling
  private static async applyPresetPose(poseId: PoseId): Promise<boolean> {
    try {
      console.log(`[ActionParser] Applying preset pose: ${poseId}`);
      const rotationLocked = useSceneSettingsStore.getState().rotationLocked;
      // CRITICAL FIX: Use 'loop' mode instead of just 'animated=true'
      // When animated=true but animationMode='static', it plays once and freezes.
      // We want looping animations for the AI avatar.
      await avatarManager.applyPose(poseId, rotationLocked, true, 'loop');
      console.log(`[ActionParser] ✅ Pose applied (looping): ${poseId}`);
      return true;
    } catch (e) {
      console.error(`[ActionParser] Failed to apply pose ${poseId}:`, e);
      return false;
    }
  }

  private static triggerSpeaking() {
    // Simple visual feedback - random expression to look alive
    // Note: 'fun' isn't in ExpressionId strict type but might be supported by underlying VRM
    // Let's stick to safe ones
    const safeExpressions: ExpressionId[] = ['joy', 'surprise'];
    const randomExpr = safeExpressions[Math.floor(Math.random() * safeExpressions.length)];
    
    // Reset any previous expression
    avatarManager.applyExpression('calm');
    
    // Apply new one briefly
    setTimeout(() => {
        avatarManager.applyExpression(randomExpr);
        
        // Reset back to calm after a few seconds
        setTimeout(() => {
            avatarManager.applyExpression('calm');
        }, 2000);
    }, 100);
  }
}
