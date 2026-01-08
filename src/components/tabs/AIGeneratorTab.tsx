import { useState, useEffect } from 'react';
import { geminiService } from '../../services/gemini';
import { useCustomPoseStore } from '../../state/useCustomPoseStore';
import { useToastStore } from '../../state/useToastStore';
import { avatarManager } from '../../three/avatarManager';
import { apiKeyStorage } from '../../utils/secureStorage';
import type { VRMPose } from '@pixiv/three-vrm';
import { 
  Robot, 
  Sparkle, 
  MagnifyingGlass, 
  FloppyDisk, 
  DownloadSimple, 
  UploadSimple, 
  Trash, 
  Check
} from '@phosphor-icons/react';

export function AIGeneratorTab() {
  const { addCustomPose, customPoses, removeCustomPose, importPoses } = useCustomPoseStore();
  const { addToast } = useToastStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPose, setGeneratedPose] = useState<VRMPose | null>(null);
  const [generatedAnimation, setGeneratedAnimation] = useState<{ data: any; loop: boolean } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showModels, setShowModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-pro');
  const [customModelInput, setCustomModelInput] = useState('');
  const [useLimits, setUseLimits] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoop, setIsLoop] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [rawResponse, setRawResponse] = useState('');
  
  // Use environment variable for API Key (highest priority)
  const envApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // State for user-provided API key (secure storage)
  const [userApiKey, setUserApiKey] = useState('');

  // Effective API key (env takes priority)
  const apiKey = envApiKey || userApiKey;

  // On mount, migrate and load stored key
  useEffect(() => {
    apiKeyStorage.migrate();
    const storedKey = apiKeyStorage.get();
    if (storedKey) {
      setUserApiKey(storedKey);
    }
  }, []);

  useEffect(() => {
    if (apiKey) {
      geminiService.initialize(apiKey);
    }
  }, [apiKey]);

  const handleSaveKey = (key: string) => {
    apiKeyStorage.set(key, true); // Persistent for this tab since it's a power-user feature
    setUserApiKey(key);
  };

  const handleClearKey = () => {
    apiKeyStorage.remove();
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
    setGeneratedAnimation(null);
    
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
           setGeneratedAnimation({ data: result, loop: isLoop });
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

  const handleExportLibrary = () => {
    const dataStr = JSON.stringify(customPoses, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poselab-library-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportLibrary = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json)) {
            importPoses(json);
            addToast(`Successfully imported ${json.length} poses!`, 'success');
        } else {
            addToast('Invalid file format: Expected an array of poses.', 'error');
        }
      } catch (err) {
        console.error(err);
        addToast('Failed to parse JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (!apiKey) {
    return (
      <div className="tab-content">
        <div className="tab-section">
          <h3><Robot size={18} weight="duotone" /> AI Setup Required</h3>
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
            {isGenerating ? <><Sparkle size={16} weight="fill" /> Generating...</> : <><Sparkle size={16} weight="duotone" /> Generate Pose</>}
          </button>
        </div>
        
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={useLimits}
              onChange={(e) => setUseLimits(e.target.checked)}
            />
            Bio-Limits
          </label>
          
          <label style={{ fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={isAnimating}
              onChange={(e) => setIsAnimating(e.target.checked)}
            />
            Animate
          </label>

          {isAnimating && (
            <label style={{ fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="checkbox"
                checked={isLoop}
                onChange={(e) => setIsLoop(e.target.checked)}
              />
              Loop
            </label>
          )}
          
          <div style={{ flex: '1 0 100%', height: '4px' }} className="mobile-only-spacer" />
          
          <button 
            className="secondary small" 
            onClick={() => setShowDebug(!showDebug)}
            style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: 'auto' }}
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
                <MagnifyingGlass size={16} weight="duotone" /> Troubleshoot: Check Available Models
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
                <FloppyDisk size={16} weight="duotone" /> Save to Library
              </button>
            </div>
          </div>
        </div>
      )}

      {generatedAnimation && (
        <div className="tab-section" style={{ border: '1px solid var(--accent)', background: 'rgba(0, 255, 157, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small" style={{ color: 'var(--accent)' }}>Animation Preview Active</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="secondary small"
                onClick={() => avatarManager.applyRawPose(generatedAnimation.data, generatedAnimation.loop ? 'loop' : 'once')}
              >
                Replay
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tab-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>Your Library ({customPoses.length})</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <label className="secondary small button" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <UploadSimple size={16} weight="duotone" /> Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportLibrary}
                style={{ display: 'none' }}
              />
            </label>
            <button 
              className="secondary small"
              onClick={handleExportLibrary}
              disabled={customPoses.length === 0}
            >
              <DownloadSimple size={16} weight="duotone" /> Export All
            </button>
          </div>
        </div>
        
        {customPoses.length === 0 ? (
          <div className="muted small" style={{ textAlign: 'center', padding: '20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
            No saved poses yet. Create one or import a library!
          </div>
        ) : (
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
                    <Check size={16} weight="bold" />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => handleExportPose(pose)}
                    title="Download JSON"
                  >
                    <DownloadSimple size={16} weight="duotone" />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => removeCustomPose(pose.id)}
                    title="Delete"
                  >
                    <Trash size={16} weight="duotone" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
