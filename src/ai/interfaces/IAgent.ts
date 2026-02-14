import type { DirectorScript } from "../../types/director";

export interface IAgent {
  id: string;
  name: string;
  
  // Lifecycle
  initialize(config?: any): Promise<void>;
  dispose(): void;
  
  // Input Processing
  processInput(text: string): Promise<string>; // Handle chat
  
  // Optional: Voice processing
  processAudio?(audioData: Float32Array): Promise<void>; 
  
  // Capabilities
  capabilities: {
    voice: boolean;
    emotions: boolean;
    gestures: boolean;
  };

  // Optional: Advanced Features
  generateDirectorScript?(userPrompt: string): Promise<DirectorScript | null>;
}
