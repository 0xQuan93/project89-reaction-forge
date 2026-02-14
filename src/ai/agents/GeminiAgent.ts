
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAIStore } from "../../state/useAIStore";
import { geminiService } from "../../services/gemini";
import { geminiProxy } from "../../services/geminiProxy";
import type { DirectorScript } from "../../types/director";
import type { IAgent } from "../interfaces/IAgent";
import { ActionParser } from "../utils/ActionParser";

export class GeminiAgent implements IAgent {
  id = 'gemini-agent';
  name = 'Gemini Pro';
  
  capabilities = {
    voice: true, 
    emotions: true,
    gestures: true
  };

  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private chatSession: any = null;
  private isInitialized = false;
  private apiKey: string = "";
  private useProxy: boolean = !import.meta.env.VITE_GEMINI_API_KEY;

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

  async initialize(config?: { apiKey?: string }) {
    if (this.isInitialized) return;
    
    const store = useAIStore.getState();
    store.setLoading(true, 0);

    try {
      const apiKey = config?.apiKey;

      if (apiKey) {
        this.useProxy = false;
        this.apiKey = apiKey;
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        geminiService.initialize(this.apiKey);
        this.startChatSession();
        console.log("🧠 GeminiAgent Initialized (Direct API)");
      } else {
        this.useProxy = true;
        geminiProxy.setSystemPrompt(this.systemPrompt);
        console.log("🧠 GeminiAgent Initialized (Server Proxy)");
      }

      this.isInitialized = true;
      store.setLoading(false, 100);
    } catch (e) {
      console.error("Failed to load GeminiAgent:", e);
      store.setLoading(false, 0);
      throw e;
    }
  }

  dispose() {
    this.chatSession = null;
    this.model = null;
    this.genAI = null;
    this.isInitialized = false;
    console.log("🧠 GeminiAgent Disposed");
  }

  async generateDirectorScript(userPrompt: string): Promise<DirectorScript | null> {
    if (!this.isInitialized) await this.initialize();

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
      console.error("[GeminiAgent] Failed to generate director script:", e);
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
      await this.initialize();
    }

    useAIStore.getState().setThought("Thinking...");

    try {
      let text: string;

      if (this.useProxy) {
        const response = await geminiProxy.chat(userInput);
        text = response.text;
      } else {
        if (!this.genAI) {
           await this.initialize();
           if (!this.genAI) throw new Error("AI not initialized properly");
        }

        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro-latest", "gemini-pro"];
        let lastError = null;
        let success = false;

        for (const modelName of modelsToTry) {
          try {
            if (!this.model || (this.model as any).model !== modelName) {
              this.model = this.genAI!.getGenerativeModel({ model: modelName });
              this.startChatSession();
            }

            if (!this.chatSession) this.startChatSession();

            const result = await this.chatSession.sendMessage(userInput);
            const response = result.response;
            text = response.text();
            success = true;
            break;

          } catch (e: any) {
            console.warn(`[GeminiAgent] Failed with ${modelName}:`, e.message);
            lastError = e;
          }
        }

        if (!success) {
          throw lastError || new Error("All models failed");
        }
      }

      useAIStore.getState().setThought(null);
      
      // Use ActionParser to execute commands
      await ActionParser.execute(text!, (t) => this.speak(t));
      
      return text!;

    } catch (e: any) {
      console.error("AI processing failed:", e);
      useAIStore.getState().setThought("Connection Error");
      return "I'm having trouble connecting. Please try again.";
    }
  }

  private speak(text: string) {
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
}
