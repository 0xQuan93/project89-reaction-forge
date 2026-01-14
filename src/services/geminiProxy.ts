/**
 * Gemini Proxy Service
 * 
 * Provides a unified interface for Gemini API calls that can use either:
 * 1. Server-side proxy (secure, recommended for production)
 * 2. Direct API calls (requires user API key, for development/demo)
 * 
 * The proxy URL can be configured via environment variable: VITE_GEMINI_PROXY_URL
 */

// apiKeyStorage imported for potential future use in direct mode
// import { apiKeyStorage } from '../utils/secureStorage';

// Configuration
// Netlify functions are at /.netlify/functions/[name]
// Vercel functions are at /api/[name]
const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL || '/.netlify/functions/gemini';
const DIRECT_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-1.5-flash';

export type GeminiMode = 'proxy' | 'direct';

interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  text: string;
  usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

class GeminiProxyService {
  private mode: GeminiMode = 'proxy';
  private directApiKey: string | null = null;
  private chatHistory: ChatMessage[] = [];
  private systemPrompt: string = '';

  constructor() {
    // Default to proxy mode - it's the secure option
    // Only switch to direct if user explicitly provides a key
    this.mode = 'proxy';
    console.log('[GeminiProxy] Initialized in proxy mode (/.netlify/functions/gemini)');
  }

  /**
   * Set the mode explicitly
   */
  setMode(mode: GeminiMode, apiKey?: string) {
    this.mode = mode;
    if (mode === 'direct' && apiKey) {
      this.directApiKey = apiKey;
    }
    console.log(`[GeminiProxy] Mode set to: ${mode}`);
  }

  /**
   * Get current mode
   */
  getMode(): GeminiMode {
    return this.mode;
  }

  /**
   * Check if the service is ready to make requests
   */
  isReady(): boolean {
    if (this.mode === 'proxy') {
      return true; // Proxy availability checked on request
    }
    return !!this.directApiKey;
  }

  /**
   * Set system prompt for chat context
   */
  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
  }

  /**
   * Clear chat history
   */
  clearHistory() {
    this.chatHistory = [];
  }

  /**
   * Send a chat message
   */
  async chat(message: string): Promise<GeminiResponse> {
    if (this.mode === 'proxy') {
      return this.chatViaProxy(message);
    } else {
      return this.chatDirect(message);
    }
  }

  /**
   * Generate content (one-shot, no history)
   */
  async generate(prompt: string): Promise<GeminiResponse> {
    if (this.mode === 'proxy') {
      return this.generateViaProxy(prompt);
    } else {
      return this.generateDirect(prompt);
    }
  }

  // ==================== Proxy Methods ====================

  private async chatViaProxy(message: string): Promise<GeminiResponse> {
    console.log('[GeminiProxy] Sending chat request to:', PROXY_URL);
    
    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          prompt: message,
          history: this.chatHistory,
          systemPrompt: this.systemPrompt
        })
      });

      console.log('[GeminiProxy] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GeminiProxy] Error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        
        throw new Error(errorData.error || errorData.details || `Proxy error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[GeminiProxy] Success, response length:', data.text?.length);

      // Update history
      this.chatHistory.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: data.text }] }
      );

      return data;
    } catch (error: any) {
      console.error('[GeminiProxy] Request failed:', error);
      throw error;
    }
  }

  private async generateViaProxy(prompt: string): Promise<GeminiResponse> {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate',
        prompt
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Proxy error: ${response.status}`);
    }

    return response.json();
  }

  // ==================== Direct API Methods ====================

  private async chatDirect(message: string): Promise<GeminiResponse> {
    if (!this.directApiKey) {
      throw new Error('No API key configured for direct mode');
    }

    const url = `${DIRECT_API_URL}/models/${DEFAULT_MODEL}:generateContent?key=${this.directApiKey}`;

    const contents = [
      ...this.chatHistory,
      { role: 'user', parts: [{ text: message }] }
    ];

    const body: any = { contents };

    if (this.systemPrompt) {
      body.systemInstruction = { parts: [{ text: this.systemPrompt }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Update history
    this.chatHistory.push(
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text }] }
    );

    return {
      text,
      usage: data.usageMetadata
    };
  }

  private async generateDirect(prompt: string): Promise<GeminiResponse> {
    if (!this.directApiKey) {
      throw new Error('No API key configured for direct mode');
    }

    const url = `${DIRECT_API_URL}/models/${DEFAULT_MODEL}:generateContent?key=${this.directApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      text,
      usage: data.usageMetadata
    };
  }
}

// Export singleton instance
export const geminiProxy = new GeminiProxyService();

