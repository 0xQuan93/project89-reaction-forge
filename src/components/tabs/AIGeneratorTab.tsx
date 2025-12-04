import { useState, useEffect } from 'react';
import { geminiService } from '../../services/gemini';
import { useCustomPoseStore } from '../../state/useCustomPoseStore';
import { avatarManager } from '../../three/avatarManager';
import type { VRMPose } from '@pixiv/three-vrm';

export function AIGeneratorTab() {
  const { addCustomPose, customPoses, removeCustomPose } = useCustomPoseStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPose, setGeneratedPose] = useState<VRMPose | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showModels, setShowModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-pro');
  const [customModelInput, setCustomModelInput] = useState('');
  const [useLimits, setUseLimits] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoop, setIsLoop] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [rawResponse, setRawResponse] = useState('');
  
  // Use environment variable for API Key
  const envApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // State for user-provided API key (for web demo)
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');

  // Effective API key
  const apiKey = envApiKey || userApiKey;

  useEffect(() => {
    if (apiKey) {
      geminiService.initialize(apiKey);
    }
  }, [apiKey]);

  const handleSaveKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setUserApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setUserApiKey('');
  };

  const handleCheckModels = async () => {
    try {
      if (!apiKey) throw new Error('No API Key');
      const models = await geminiService.listAvailableModels();
      setAvailableModels(models);
      setShowModels(true);
      if (models.length > 0 && !models.includes(selectedModel)) {
        // If current default isn't in list, switch to first available
        setSelectedModel(models[0]);
        geminiService.setModel(models[0]);
      }
    } catch (err: any) {
      setError('Failed to list models: ' + err.message);
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    if (model !== 'custom') {
      geminiService.setModel(model);
    }
  };
  
  const handleCustomModelBlur = () => {
    if (customModelInput.trim()) {
      geminiService.setModel(customModelInput.trim());
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedPose(null);
    
    try {
      if (!apiKey) {
        throw new Error('API Key is missing. Please check your .env file.');
      }
      
      // Ensure service is initialized and model set
      if (selectedModel === 'custom' && customModelInput.trim()) {
         geminiService.setModel(customModelInput.trim());
      } else {
         geminiService.setModel(selectedModel);
      }
      
      const result = await geminiService.generatePose(prompt, useLimits, isAnimating, isLoop);
      
      if (result && (result.vrmPose || (result as any).tracks)) {
        if ((result as any).tracks) {
           setGeneratedPose((result as any)); // Store full animation data
           await avatarManager.applyRawPose(result, isLoop ? 'loop' : 'once'); // Play animation
        } else if (result.vrmPose) {
           setGeneratedPose(result.vrmPose);
           await avatarManager.applyRawPose({ vrmPose: result.vrmPose, expressions: result.expressions }, 'static');
        }
        setRawResponse(result.rawJson || '');
      } else {
        throw new Error('Invalid response format from AI');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedPose) return;
    
    // Create a default name from prompt
    const defaultName = prompt.split(' ').slice(0, 4).join(' ') + (prompt.split(' ').length > 4 ? '...' : '');
    const name = window.prompt('Name this pose:', defaultName);
    
    if (name) {
      addCustomPose({
        name,
        description: prompt,
        poseData: { vrmPose: generatedPose }
      });
      setGeneratedPose(null);
      setPrompt('');
    }
  };

  const handleApplySaved = (poseData: { vrmPose: VRMPose }) => {
    avatarManager.applyRawPose(poseData, 'static');
  };

  const handleExportPose = (pose: any) => {
    const dataStr = JSON.stringify(pose.poseData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pose.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!apiKey) {
    return (
      <div className="tab-content">
        <div className="tab-section">
          <h3>🤖 AI Setup Required</h3>
          <p className="muted small">
            To use the AI generator, you need a Google Gemini API Key.
          </p>
          
          <div style={{ margin: '12px 0' }}>
            <input
              type="password"
              className="text-input"
              placeholder="Paste your Gemini API Key here"
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              style={{ marginBottom: '8px' }}
            />
            <button 
              className="primary full-width"
              onClick={() => handleSaveKey(userApiKey)}
              disabled={!userApiKey.trim()}
            >
              Save Key
            </button>
          </div>
          
          <p className="small muted">
            Your key is stored locally in your browser and sent directly to Google.
            <br />
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
              Get a free Gemini API Key here
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="tab-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>AI Pose Generator</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="small muted" style={{ fontSize: '0.8em' }}>
              {envApiKey ? 'Using Env Key' : `Key: ...${apiKey.slice(-4)}`}
            </span>
            {!envApiKey && (
              <button 
                className="secondary small"
                onClick={handleClearKey}
                title="Change API Key"
                style={{ padding: '2px 6px', fontSize: '0.7em' }}
              >
                Change
              </button>
            )}
          </div>
        </div>

        {/* Model Selection */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              className="text-input" 
              value={selectedModel} 
              onChange={handleModelChange}
              style={{ flex: 1, fontSize: '0.9em' }}
            >
              <option value="gemini-pro">gemini-pro (Default)</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              {availableModels.map(m => (
                 !['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'].includes(m) && 
                 <option key={m} value={m}>{m}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            {selectedModel === 'custom' && (
              <input
                type="text"
                className="text-input"
                placeholder="Model ID (e.g. gemini-1.0-pro)"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                onBlur={handleCustomModelBlur}
                style={{ flex: 1 }}
              />
            )}
          </div>
        </div>

        <textarea
          className="text-input"
          placeholder="Describe a pose (e.g., 'Sitting on a chair looking pensive', 'Superhero landing', 'Victory jump')..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ minHeight: '80px', resize: 'vertical' }}
          disabled={isGenerating}
        />
        
        {error && (
          <div className="error-message" style={{ color: '#ff4444', fontSize: '0.9em', marginTop: '8px' }}>
            Error: {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            className="primary full-width"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? '✨ Generating...' : '✨ Generate Pose'}
          </button>
        </div>
        
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="useLimits"
            checked={useLimits}
            onChange={(e) => setUseLimits(e.target.checked)}
          />
          <label htmlFor="useLimits" style={{ fontSize: '0.9em', cursor: 'pointer' }}>Enforce Bio-Limits</label>
          
          <input
            type="checkbox"
            id="isAnimating"
            checked={isAnimating}
            onChange={(e) => setIsAnimating(e.target.checked)}
            style={{ marginLeft: '12px' }}
          />
          <label htmlFor="isAnimating" style={{ fontSize: '0.9em', cursor: 'pointer' }}>Generate Animation</label>

          {isAnimating && (
            <>
              <input
                type="checkbox"
                id="isLoop"
                checked={isLoop}
                onChange={(e) => setIsLoop(e.target.checked)}
                style={{ marginLeft: '12px' }}
              />
              <label htmlFor="isLoop" style={{ fontSize: '0.9em', cursor: 'pointer' }}>Loop</label>
            </>
          )}
          
          <div style={{ flex: 1 }} />
          
          <button 
            className="secondary small" 
            onClick={() => setShowDebug(!showDebug)}
            style={{ fontSize: '0.8em', opacity: 0.7 }}
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>

        {showDebug && (
          <div className="tab-section" style={{ marginTop: '12px', padding: '8px', background: '#00000040' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <button 
                className="secondary small" 
                onClick={handleCheckModels}
                style={{ fontSize: '0.8em' }}
              >
                🔍 Troubleshoot: Check Available Models
              </button>
            </div>

            {showModels && (
              <div className="code-block" style={{ fontSize: '0.8em', maxHeight: '100px', overflowY: 'auto', marginBottom: '8px' }}>
                <strong>Available Models:</strong><br/>
                {availableModels.length > 0 ? (
                  availableModels.map(m => <div key={m}>{m}</div>)
                ) : (
                  <div>No compatible models found.</div>
                )}
              </div>
            )}
            
            {rawResponse && (
              <div style={{ marginTop: '8px' }}>
                <strong style={{ fontSize: '0.8em' }}>Last AI Response:</strong>
                <pre className="code-block" style={{ fontSize: '0.7em', maxHeight: '200px', overflow: 'auto' }}>
                  {rawResponse}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {generatedPose && (
        <div className="tab-section" style={{ border: '1px solid var(--accent)', background: 'rgba(0, 255, 157, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small" style={{ color: 'var(--accent)' }}>Preview Active</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="secondary small" onClick={() => avatarManager.applyRawPose({ vrmPose: generatedPose }, 'static')}>
                Re-Apply
              </button>
              <button className="primary small" onClick={handleSave}>
                💾 Save to Library
              </button>
            </div>
          </div>
        </div>
      )}

      {customPoses.length > 0 && (
        <div className="tab-section">
          <h3>Your Library ({customPoses.length})</h3>
          <div className="pose-list">
            {customPoses.map((pose) => (
              <div key={pose.id} className="pose-item">
                <div className="pose-item__info">
                  <strong>{pose.name}</strong>
                  <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                    {pose.description}
                  </div>
                </div>
                <div className="pose-item__actions">
                  <button
                    className="icon-button"
                    onClick={() => handleApplySaved(pose.poseData)}
                    title="Apply"
                  >
                    ✓
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => handleExportPose(pose)}
                    title="Download JSON"
                  >
                    ⬇️
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => removeCustomPose(pose.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

