import type { IAgent } from "./interfaces/IAgent";
import { GeminiAgent } from "./agents/GeminiAgent";
import type { DirectorScript } from "../types/director";

class AgentManager {
  private activeAgent: IAgent;
  
  constructor() {
    // Default to GeminiAgent
    this.activeAgent = new GeminiAgent();
  }

  get agent(): IAgent {
    return this.activeAgent;
  }

  async setAgent(agent: IAgent, config?: any) {
    if (this.activeAgent) {
      this.activeAgent.dispose();
    }
    this.activeAgent = agent;
    await this.activeAgent.initialize(config);
    console.log(`[AgentManager] Switched to agent: ${agent.name}`);
  }

  // Proxy methods to match old AIManager where possible, or new standard
  async init(apiKey?: string) {
    return this.activeAgent.initialize({ apiKey });
  }

  async processInput(text: string) {
    return this.activeAgent.processInput(text);
  }

  async generateDirectorScript(prompt: string): Promise<DirectorScript | null> {
    if (this.activeAgent.generateDirectorScript) {
      return this.activeAgent.generateDirectorScript(prompt);
    }
    console.warn(`[AgentManager] Current agent ${this.activeAgent.name} does not support director scripts.`);
    return null;
  }
}

export const agentManager = new AgentManager();
