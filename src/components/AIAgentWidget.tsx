import { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../state/useAIStore';
import { aiManager } from '../ai/AIManager';
import { apiKeyStorage } from '../utils/secureStorage';
import './AIAgentWidget.css';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { 
  Brain, 
  CaretLeft, 
  Key, 
  X, 
  Lightning, 
  Plug, 
  PaperPlaneTilt,
  Lock
} from '@phosphor-icons/react';

// Check if server proxy is available (no env API key means we use proxy)
const USE_SERVER_PROXY = !import.meta.env.VITE_GEMINI_API_KEY;

export function AIAgentWidget() {
  const { isAIActive, isLoading, loadProgress, currentThought, setAIActive } = useAIStore();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(!USE_SERVER_PROXY); // Hide if using proxy
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // On mount, migrate old storage and check for existing key
  useEffect(() => {
    // If using server proxy, no need to check for stored keys
    if (USE_SERVER_PROXY) {
      setShowKeyInput(false);
      return;
    }
    
    // Migrate from old insecure localStorage
    apiKeyStorage.migrate();
    
    // Check if we have a stored key
    const storedKey = apiKeyStorage.get();
    if (storedKey) {
      setApiKey(storedKey);
      setShowKeyInput(false);
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, currentThought, isOpen]);

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      // Store securely - persistent only if user opts in
      apiKeyStorage.set(apiKey.trim(), rememberKey);
      setShowKeyInput(false);
    }
  };

  const handleClearKey = () => {
    apiKeyStorage.remove();
    setApiKey('');
    setShowKeyInput(true);
    setAIActive(false);
  };

  const handleToggleActive = async () => {
    if (!isAIActive) {
      // If using proxy, no API key needed
      if (!USE_SERVER_PROXY && !apiKey) {
        setIsOpen(true);
        setShowKeyInput(true);
        return;
      }
      try {
        // Pass API key only if not using proxy
        await aiManager.init(USE_SERVER_PROXY ? undefined : apiKey);
        setAIActive(true);
      } catch (error) {
        alert("Failed to connect to AI. Check your API key.");
        setIsOpen(true);
        setShowKeyInput(true);
      }
    } else {
      setAIActive(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText;
    setInputText('');
    
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);

    const response = await aiManager.processInput(userMessage);
    
    // Clean response if it contains commands, but keep the text
    const cleanResponse = response || "..."; 
    setChatHistory(prev => [...prev, { role: 'ai', text: cleanResponse }]);
  };

  return (
    <div className={`ai-widget-container ${isOpen ? 'open' : ''}`}>
      {/* Toggle Tab (Visible when closed or open) */}
      <div className="ai-drawer-toggle" onClick={() => setIsOpen(!isOpen)} title="Toggle AI Assistant">
        <span className="ai-drawer-icon">{isOpen ? <CaretLeft size={18} weight="bold" /> : <Brain size={20} weight="duotone" />}</span>
      </div>

      {/* Drawer Content */}
      <div className="ai-widget-content">
        {/* Header */}
        <div className="ai-widget-header">
          <div className="ai-status-indicator">
            <div className={`ai-pulse-dot ${isAIActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`} />
            <span className="ai-label">
              {isLoading ? `Initializing ${loadProgress}%` : isAIActive ? 'AI Agent Online' : 'AI Agent Offline'}
            </span>
          </div>
          
          <div className="ai-header-controls">
            {apiKey && !showKeyInput && (
              <button 
                className="ai-clear-key-btn"
                onClick={handleClearKey}
                title="Clear API Key"
              >
                <Key size={14} weight="duotone" /><X size={10} weight="bold" />
              </button>
            )}
            <button 
              className={`ai-power-btn ${isAIActive ? 'active' : ''}`}
              onClick={handleToggleActive}
              title={isAIActive ? "Deactivate AI" : "Activate AI"}
            >
              {isAIActive ? <Lightning size={16} weight="fill" /> : <Plug size={16} weight="duotone" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {showKeyInput && !isAIActive ? (
          <div className="ai-key-input">
            <p>Enter Google Gemini API Key:</p>
            <div className="ai-key-row">
              <Input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
              <Button onClick={handleSaveKey}>Save</Button>
            </div>
            <label className="ai-remember-key">
              <Input 
                type="checkbox" 
                checked={rememberKey}
                onChange={(e) => setRememberKey(e.target.checked)}
              />
              <span>Remember across sessions</span>
            </label>
            <small className="ai-security-note" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} weight="duotone" /> Key stored locally, {rememberKey ? 'persists until cleared' : 'cleared when tab closes'}
            </small>
            <small>Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a></small>
          </div>
        ) : (
          <>
            <div className="ai-chat-history">
              {chatHistory.length === 0 && (
                <div className="ai-empty-state">
                  I'm your AI Copilot. Ask me about PoseLab features or tell me to pose!
                </div>
              )}
              
              {chatHistory.map((msg, i) => (
                <div key={i} className={`ai-message ${msg.role}`}>
                  {msg.text}
                </div>
              ))}
              
              {currentThought && (
                <div className="ai-thought" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Lightning size={14} weight="fill" style={{ flexShrink: 0, marginTop: '2px' }} /> {currentThought}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="ai-input-form" onSubmit={handleSend}>
              <Input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isAIActive ? "Ask me anything..." : "Activate AI to chat"}
                disabled={!isAIActive || isLoading}
              />
              <Button type="submit" disabled={!isAIActive || isLoading || !inputText.trim()}>
                <PaperPlaneTilt size={16} weight="fill" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

