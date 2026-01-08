import { GoogleGenerativeAI } from "@google/generative-ai";
import { avatarManager } from "../three/avatarManager";
import { useAIStore } from "../state/useAIStore";
import { geminiService } from "../services/gemini";
import { geminiProxy } from "../services/geminiProxy";
import { avatarController, type GestureType, type EmotionState } from "./AvatarController";
import type { ExpressionId, PoseId } from "../types/reactions";

// Check if we should use the server proxy (no API key needed)
const USE_PROXY = !import.meta.env.VITE_GEMINI_API_KEY;

// Valid pose IDs that exist in the pose library
const VALID_POSE_IDS: PoseId[] = [
  'dawn-runner', 'sunset-call', 'cipher-whisper', 'nebula-drift',
  'signal-reverie', 'agent-taunt', 'agent-dance',
  'agent-clapping', 'silly-agent', 'simple-wave', 'point'
];

// Map AI commands to actual pose IDs
const POSE_COMMAND_MAP: Record<string, PoseId> = {
  'wave': 'simple-wave',
  'dance': 'agent-dance',
  'point': 'point',
  'victory': 'agent-clapping',
  'celebrate': 'agent-clapping',
  'think': 'cipher-whisper',
  'ponder': 'cipher-whisper',
  'angry': 'agent-taunt',
  'taunt': 'agent-taunt',
  'clap': 'agent-clapping',
  'silly': 'silly-agent',
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

    ## ABOUT POSELAB
    PoseLab is a browser-based VRM avatar studio with:
    - Multiplayer co-op sessions & voice chat
    - Motion capture (face/body tracking via webcam)
    - Voice lip sync
    - Post-processing effects (bloom, contrast, filters)
    - Export to PNG/WebM/GLB
    
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
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro-latest" });
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
        const modelsToTry = ["gemini-pro-latest", "gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
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
                if (result && result.vrmPose) {
                    await avatarManager.applyRawPose({
                        vrmPose: result.vrmPose,
                        sceneRotation: result.sceneRotation
                    }, 'static');
                    console.log("[AIManager] ✅ Generated pose applied successfully");
                    actionTaken = true;
                }
            }
        } catch (e) {
            console.error("[AIManager] Failed to generate pose:", e);
        }
        useAIStore.getState().setThought(null);
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
