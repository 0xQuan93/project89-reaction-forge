import type { IAgent } from "../interfaces/IAgent";

type AgentFactory = (config?: any) => Promise<IAgent>;

class PluginRegistry {
  private factories: Map<string, AgentFactory> = new Map();

  register(id: string, factory: AgentFactory) {
    this.factories.set(id, factory);
    console.log(`[PluginRegistry] Registered agent factory: ${id}`);
  }

  getFactory(id: string): AgentFactory | undefined {
    return this.factories.get(id);
  }

  getAvailableAgents(): string[] {
    return Array.from(this.factories.keys());
  }
}

export const pluginRegistry = new PluginRegistry();
