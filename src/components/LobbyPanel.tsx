import { useState, useEffect, useRef } from 'react';
import { useLobbyStore } from '../state/useLobbyStore';
import { lobbyManager } from '../lobby/LobbyManager';
import './LobbyPanel.css';

export function LobbyPanel() {
  const { onlineCount, messages, isChatOpen, toggleChat } = useLobbyStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize lobby connection on mount
  useEffect(() => {
    lobbyManager.init();
    return () => lobbyManager.disconnect();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    
    lobbyManager.sendMessage(inputText);
    setInputText('');
  };

  return (
    <div className={`lobby-container ${isChatOpen ? 'open' : 'closed'}`}>
      {/* Minimized Status Bar */}
      <div className="lobby-status-bar" onClick={toggleChat}>
        <div className="lobby-live-indicator">
          <span className="live-dot"></span>
          <span className="live-count">{onlineCount} Online</span>
        </div>
        <div className="lobby-toggle-icon">
          {isChatOpen ? '▼' : '💬 World Chat'}
        </div>
      </div>

      {/* Chat Window */}
      {isChatOpen && (
        <div className="lobby-chat-window">
          <div className="lobby-messages">
            {messages.length === 0 ? (
              <div className="lobby-empty-state">
                Welcome to the global lobby! Say hello to other creators.
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="lobby-message">
                  <span className="lobby-sender">{msg.sender}:</span>
                  <span className="lobby-text">{msg.text}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="lobby-input-area" onSubmit={handleSend}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              maxLength={140}
            />
            <button type="submit">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

