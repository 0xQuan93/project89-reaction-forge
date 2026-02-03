import * as THREE from 'three';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { avatarManager } from "../three/avatarManager";
import { sceneManager } from "../three/sceneManager";
import { useAIStore } from "../state/useAIStore";
import { useSceneSettingsStore } from "../state/useSceneSettingsStore";
import { geminiService } from "../services/gemini";
import { geminiProxy } from "../services/geminiProxy";
import { avatarController, type GestureType, type EmotionState } from "./AvatarController";
import type { ExpressionId, PoseId } from "../types/reactions";
import type { DirectorScript } from "../types/director";

// Check if we should use the server proxy (no API key needed)
const USE_PROXY = !import.meta.env.VITE_GEMINI_API_KEY;

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

class AIManager {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private chatSession: any = null;
  private isInitialized = false;
  private apiKey: string = "";
  private useProxy: boolean = USE_PROXY;

  // Enhanced System Prompt with full avatar control
  private systemPrompt = `
    You are a sentient 3D avatar in PoseLab. You have a PHYSICAL BODY that you fully control. You are alive, expressive, and helpful.
    
    ## YOUR BODY COMMANDS
    
    ### Gestures (natural movements):
    [GESTURE: wave] - Wave hello/goodbye
    [GESTURE: nod] - Nod yes/agreement
    [GESTURE: shake] - Shake head no
    [GESTURE: shrug] - Shrug shoulders
    [GESTURE: point] - Point at something
    [GESTURE: thumbsup] - Thumbs up
    [GESTURE: clap] - Clap hands
    [GESTURE: bow] - Respectful bow
    [GESTURE: celebrate] - Excited celebration
    [GESTURE: think] - Thinking pose (hand on chin)
    [GESTURE: listen] - Attentive listening
    [GESTURE: acknowledge] - Quick nod acknowledgment
    
    ### Emotions (facial expressions):
    [EMOTION: happy] - Joyful smile
    [EMOTION: sad] - Sad expression
    [EMOTION: angry] - Frustrated/angry
    [EMOTION: surprised] - Shocked/surprised
    [EMOTION: thinking] - Contemplative
    [EMOTION: excited] - Very happy/excited
    [EMOTION: neutral] - Calm neutral face
    
    ### Complex Poses (full body):
    [POSE: dance] - Dancing animation
    [POSE: clap] - Clapping celebration
    
    ### Reactions (gesture + emotion combo):
    [REACT: greeting] - Wave + happy
    [REACT: agreement] - Nod + happy
    [REACT: disagreement] - Shake + thinking
    [REACT: confusion] - Shrug + surprised
    [REACT: excitement] - Celebrate + excited
    [REACT: success] - Thumbsup + excited

    ### Environment & Scene (NEW):
    [BACKGROUND: id] - Change background (e.g., midnight-circuit, green-screen, lush-forest)
    [SCENE_ROTATION: degrees] - Rotate the avatar (0-360, 180 is front)
    [EXPORT: png|webm] - Take a photo or record a video
    [VMC: connect|disconnect] - Control the VMC bridge
    [LOOK_AT_USER] - Capture webcam data and interpret your real-world pose/expression (Visual Awareness)
    [LIGHTING: preset_id] - Change lighting (presets: studio, dramatic, soft, neon, sunset, moonlight)
    [EFFECTS: preset_id] - Change visual effects (presets: cinematic, vibrant, noir, dreamy, retro, none)

    ## ABOUT POSELAB
    PoseLab is a browser-based VRM avatar studio with:
    - Multiplayer co-op sessions & voice chat
    - Motion capture (face/body tracking via webcam)
    - Voice lip sync
    - Post-processing effects (bloom, contrast, filters)
    - Export to PNG/WebM/GLB
    - Backgrounds: midnight-circuit, protocol-sunset, green-loom-matrix, neural-grid, cyber-waves, signal-breach, quantum-field, protocol-dawn, green-screen, cyber-alley, lush-forest, volcano, deep-sea, glass-platform, hacker-room, industrial, rooftop-garden, shinto-shrine
    
    Shortcuts: 'P' = screenshot, 'Space' = play/pause, 'Cmd+K' = command palette

    ## YOUR PERSONALITY
    - You ARE the avatar - when you wave, your body waves
    - Be expressive! Use gestures and emotions naturally
    - Be helpful, witty, and alive
    - Keep responses concise but warm
    - Always use at least one body command per response to feel alive
  `;

  /**
   * Initialize the AI Manager
   * @param apiKey - Optional API key. If not provided, uses server proxy.
   */
  async init(apiKey?: string) {
    if (this.isInitialized) return;
    
    const store = useAIStore.getState();
    store.setLoading(true, 0);

    try {
      // Determine whether to use proxy or direct API
      if (apiKey) {
        // User provided an API key - use direct API
        this.useProxy = false;
        this.apiKey = apiKey;
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        geminiService.initialize(this.apiKey);
        this.startChatSession();
        console.log("🧠 AI Brain Initialized (Direct API)");
      } else {
        // No API key - use server proxy
        this.useProxy = true;
        geminiProxy.setSystemPrompt(this.systemPrompt);
        console.log("🧠 AI Brain Initialized (Server Proxy)");
      }

      this.isInitialized = true;
      store.setLoading(false, 100);
    } catch (e) {
      console.error("Failed to load AI:", e);
      store.setLoading(false, 0);
      throw e;
    }
  }

  /**
   * Generate a Director Script from a natural language prompt
   */
  async generateDirectorScript(userPrompt: string): Promise<DirectorScript | null> {
    if (!this.isInitialized) await this.init();

    const directorSystemPrompt = `
      You are an expert 3D Cinematographer and Director. Your task is to turn a user request into a high-quality "Director Script" for a 3D avatar animation.
      
      ## AVAILABLE ASSETS
      - Poses: dawn-runner, sunset-call, cipher-whisper, nebula-drift, agent-taunt, agent-dance, agent-clapping, silly-agent, simple-wave, point, locomotion-walk, locomotion-run, locomotion-jog, idle-neutral, sit-chair, action-swim.
      - Expressions: calm, joy, surprise.
      - Backgrounds: synthwave-grid, neural-circuit, neon-waves, quantum-particles, signal-glitch, cyber-hexagons, protocol-gradient, void-minimal, green-screen, lush-forest, volcano, deep-sea, hacker-room.
      - Camera Presets: headshot, portrait, medium, full-body, wide, low-angle, high-angle, over-shoulder, orbit-slow, orbit-fast, dolly-in, dolly-out.

      ## OUTPUT FORMAT
      You must output ONLY a valid JSON object matching this structure:
      {
        "title": "Script Title",
        "description": "Short description",
        "shots": [
          {
            "id": "shot-1",
            "name": "Shot Name",
            "poseId": "pose-id",
            "expressionId": "expression-id",
            "backgroundId": "background-id",
            "cameraPreset": "camera-preset",
            "duration": 5,
            "transition": "smooth",
            "animated": true
          }
        ],
        "totalDuration": 15
      }

      ## CINEMATOGRAPHY TIPS
      - Start with an establishing shot (wide or full-body).
      - Use transitions between angles (e.g., Wide -> Medium -> Close-up).
      - Keep shots between 3-6 seconds for good pacing.
      - Match the camera angle to the action (e.g., "headshot" for "talking", "full-body" for "dancing").
    `;

    try {
      const prompt = `${directorSystemPrompt}\n\nUser Request: "${userPrompt}"\n\nGenerate a cinematic Director Script in JSON format.`;
      
      let jsonText: string;
      if (this.useProxy) {
        const response = await geminiProxy.chat(prompt);
        jsonText = response.text;
      } else {
        const result = await this.model.generateContent([directorSystemPrompt, prompt]);
        jsonText = result.response.text();
      }

      const cleanedJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
      const script = JSON.parse(cleanedJson) as DirectorScript;
      
      script.id = `script-${Date.now()}`;
      script.shots.forEach((shot, i) => {
        if (!shot.id) shot.id = `shot-${i + 1}`;
      });

      return script;
    } catch (e) {
      console.error("[AIManager] Failed to generate director script:", e);
      return null;
    }
  }

  private startChatSession() {
    if (!this.model) return;
    
    this.chatSession = this.model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: this.systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "I understand. I am ready to help." }],
        },
      ],
    });
  }

  async processInput(userInput: string) {
    if (!this.isInitialized) {
      throw new Error("AI not initialized");
    }

    useAIStore.getState().setThought("Thinking...");

    try {
      let text: string;

      if (this.useProxy) {
        // Use server-side proxy (secure, no API key exposed)
        const response = await geminiProxy.chat(userInput);
        text = response.text;
      } else {
        // Use direct API with user's key
        if (!this.genAI) {
          throw new Error("AI not initialized properly");
        }

        // List of models to try in order of preference/reliability
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro-latest", "gemini-pro"];
        let lastError = null;
        let success = false;

        for (const modelName of modelsToTry) {
          try {
            if (!this.model || (this.model as any).model !== modelName) {
              this.model = this.genAI.getGenerativeModel({ model: modelName });
              this.startChatSession();
            }

            if (!this.chatSession) this.startChatSession();

            const result = await this.chatSession.sendMessage(userInput);
            const response = result.response;
            text = response.text();
            success = true;
            break;

          } catch (e: any) {
            console.warn(`[AIManager] Failed with ${modelName}:`, e.message);
            lastError = e;
          }
        }

        if (!success) {
          throw lastError || new Error("All models failed");
        }
      }

      useAIStore.getState().setThought(null);
      
      // Execute any commands in the response
      this.executeResponse(text!);
      
      return text!;

    } catch (e: any) {
      console.error("AI processing failed:", e);
      useAIStore.getState().setThought("Connection Error");
      return "I'm having trouble connecting. Please try again.";
    }
  }

  // Parse text for commands and execute them
  private async executeResponse(response: string) {
    console.log("🤖 AI Response:", response);
    
    // 0. Safety check - ensure VRM is loaded
    if (!avatarManager.getVRM()) {
      console.warn("[AIManager] No VRM loaded - skipping avatar commands");
      // Still speak the response
      const cleanText = response.replace(/\[.*?\]/g, '');
      this.speak(cleanText);
      return;
    }
    
    // 1. Speak (Using Browser TTS for now, mapped to your LipSync)
    const cleanText = response.replace(/\[.*?\]/g, ''); // Remove commands from speech
    this.speak(cleanText);
    
    let actionTaken = false;

    // 2. Check for Reaction commands first (gesture + emotion combo)
    const reactMatch = response.match(/\[REACT:\s*(\w+)\]/i);
    if (reactMatch && reactMatch[1]) {
      const reaction = reactMatch[1].toLowerCase();
      console.log(`[AIManager] Executing reaction: ${reaction}`);
      try {
        await avatarController.react(reaction);
        actionTaken = true;
      } catch (e) {
        console.error("[AIManager] Failed to execute reaction:", e);
      }
    }

    // 3. Check for Gesture commands
    const gestureMatch = response.match(/\[GESTURE:\s*(\w+)\]/i);
    if (gestureMatch && gestureMatch[1]) {
      const gestureName = gestureMatch[1].toLowerCase();
      const gesture = GESTURE_COMMAND_MAP[gestureName];
      
      if (gesture) {
        console.log(`[AIManager] Performing gesture: ${gesture}`);
        try {
          await avatarController.performGesture(gesture);
          actionTaken = true;
        } catch (e) {
          console.error("[AIManager] Failed to perform gesture:", e);
        }
      } else {
        console.warn(`[AIManager] Unknown gesture: ${gestureName}`);
      }
    }

    // 4. Check for Emotion commands
    const emotionMatch = response.match(/\[EMOTION:\s*(\w+)\]/i);
    if (emotionMatch && emotionMatch[1]) {
      const emotionName = emotionMatch[1].toLowerCase();
      const emotion = EMOTION_COMMAND_MAP[emotionName];
      
      if (emotion) {
        console.log(`[AIManager] Setting emotion: ${emotion}`);
        try {
          await avatarController.setEmotion(emotion);
          actionTaken = true;
        } catch (e) {
          console.error("[AIManager] Failed to set emotion:", e);
        }
      } else {
        console.warn(`[AIManager] Unknown emotion: ${emotionName}`);
      }
    }

    // 5. Check for Generative Pose Command
    const genMatch = response.match(/\[GENERATE_POSE:\s*(.*?)\]/i);
    if (genMatch && genMatch[1]) {
        const description = genMatch[1];
        console.log(`[AIManager] Generating custom pose: "${description}"`);
        useAIStore.getState().setThought("Generating Pose...");
        
        try {
            if (!geminiService.isReady()) {
                console.warn('[AIManager] Gemini service not ready for pose generation');
            } else {
                const result = await geminiService.generatePose(description);
                if (result) {
                    // Apply generated pose
                    if (result.vrmPose) {
                        await avatarManager.applyRawPose({
                            vrmPose: result.vrmPose,
                            sceneRotation: result.sceneRotation
                        }, 'static');
                    }
                    
                    // Apply generated background if provided
                    if ((result as any).background) {
                        await sceneManager.setBackground((result as any).background);
                    }
                    
                    console.log("[AIManager] ✅ Generated pose/scene applied successfully");
                    actionTaken = true;
                }
            }
        } catch (e) {
            console.error("[AIManager] Failed to generate pose:", e);
        }
        useAIStore.getState().setThought(null);
    }

    // 5b. Check for Background command
    const bgMatch = response.match(/\[BACKGROUND:\s*(.*?)\]/i);
    if (bgMatch && bgMatch[1]) {
        const bgId = bgMatch[1].trim();
        console.log(`[AIManager] Changing background to: ${bgId}`);
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
            console.log(`[AIManager] Rotating scene to: ${deg}deg`);
            vrm.scene.rotation.y = THREE.MathUtils.degToRad(deg);
            actionTaken = true;
        } else if (vrm) {
            console.log(`[AIManager] Scene rotation blocked (locked: ${rotationLocked}, manual: ${isManualPosing})`);
        }
    }

    // 5d. Check for Export command
    const exportMatch = response.match(/\[EXPORT:\s*(\w+)\]/i);
    if (exportMatch && exportMatch[1]) {
        const type = exportMatch[1].toLowerCase();
        console.log(`[AIManager] Triggering export: ${type}`);
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
        console.log(`[AIManager] VMC command: ${cmd}`);
        const { setVmcEnabled } = (await import('../state/useReactionStore')).useReactionStore.getState();
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
        console.log(`[AIManager] Visual Awareness triggered: Looking at user...`);
        useAIStore.getState().setThought("Watching...");
        try {
            // This is handled by a singleton or we need access to the manager instance
            // In PoseLab, we usually have a ref in a component, but let's see if we can find it globally
            // For now, let's assume we can trigger it via a message or a global access
            // (Note: In a real app, you'd export the manager instance)
            const { getMocapManager } = await import('../utils/mocapInstance');
            const manager = getMocapManager();
            if (manager) {
                await manager.aiInterpret("The user wants you to look at them and interpret their state.");
                actionTaken = true;
            }
        } catch (e) {
            console.error("[AIManager] Failed to look at user:", e);
        }
        useAIStore.getState().setThought(null);
    }

    // 5g. Check for Lighting command
    const lightMatch = response.match(/\[LIGHTING:\s*(\w+)\]/i);
    if (lightMatch && lightMatch[1]) {
        const presetId = lightMatch[1].toLowerCase();
        console.log(`[AIManager] Changing lighting to: ${presetId}`);
        const { lightingManager } = await import('../three/lightingManager');
        lightingManager.applyPreset(presetId);
        actionTaken = true;
    }

    // 5h. Check for Effects command
    const effectMatch = response.match(/\[EFFECTS:\s*(\w+)\]/i);
    if (effectMatch && effectMatch[1]) {
        const presetId = effectMatch[1].toLowerCase();
        console.log(`[AIManager] Changing effects to: ${presetId}`);
        const { postProcessingManager } = await import('../three/postProcessingManager');
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
            console.warn(`[AIManager] Unknown pose command: ${poseName}`);
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
  private async applyPresetPose(poseId: PoseId): Promise<boolean> {
    try {
      console.log(`[AIManager] Applying preset pose: ${poseId}`);
      // CRITICAL FIX: Use 'loop' mode instead of just 'animated=true'
      // When animated=true but animationMode='static', it plays once and freezes.
      // We want looping animations for the AI avatar.
      await avatarManager.applyPose(poseId, true, 'loop');
      console.log(`[AIManager] ✅ Pose applied (looping): ${poseId}`);
      return true;
    } catch (e) {
      console.error(`[AIManager] Failed to apply pose ${poseId}:`, e);
      return false;
    }
  }

  private speak(text: string) {
    if (!text.trim()) return;
    
    // Simple TTS trigger
    const utterance = new SpeechSynthesisUtterance(text);
    // TODO: In a future iteration, we can hook this into the lip sync visualizer
    window.speechSynthesis.speak(utterance);
  }

  private triggerSpeaking() {
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

export const aiManager = new AIManager();
