import { useEffect, useState } from 'react';
import { useSettingsStore, type Locale, type QualityLevel } from '../state/useSettingsStore';
import { autosaveManager, type AutosaveEntry } from '../persistence/autosaveManager';
import { projectManager } from '../persistence/projectManager';
import { useToastStore } from '../state/useToastStore';
import { Desktop, GearSix, Moon, Sun } from '@phosphor-icons/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    quality,
    shadows,
    showStats,
    theme,
    locale,
    textScale,
    autosaveEnabled,
    autosaveIntervalMinutes,
    autosaveMaxEntries,
    setQuality,
    setShadows,
    setShowStats,
    setTheme,
    setLocale,
    setTextScale,
    setAutosaveEnabled,
    setAutosaveIntervalMinutes,
    setAutosaveMaxEntries,
  } = useSettingsStore();
  const addToast = useToastStore((state) => state.addToast);
  const [autosaves, setAutosaves] = useState<AutosaveEntry[]>([]);

  const refreshAutosaves = () => {
    setAutosaves(autosaveManager.getAutosaves());
  };

  useEffect(() => {
    if (isOpen) {
      refreshAutosaves();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><GearSix size={24} weight="duotone" /> Settings</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="setting-group">
            <label>Interface Theme</label>
            <div className="theme-toggle">
              <button 
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={18} weight={theme === 'dark' ? 'fill' : 'regular'} /> Dark
              </button>
              <button 
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <Sun size={18} weight={theme === 'light' ? 'fill' : 'regular'} /> Light
              </button>
              <button 
                className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                onClick={() => setTheme('system')}
              >
                <Desktop size={18} weight={theme === 'system' ? 'fill' : 'regular'} /> System
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label>Language</label>
            <div className="select-wrapper">
              <select 
                value={locale} 
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="text-input"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </div>
            <p className="muted small">We’ll use this for future translations and accessibility hints.</p>
          </div>

          <div className="setting-group">
            <label>Interface Scale</label>
            <div className="range-row">
              <input
                type="range"
                min={0.9}
                max={1.2}
                step={0.05}
                value={textScale}
                onChange={(e) => setTextScale(parseFloat(e.target.value))}
              />
              <span className="muted small">{Math.round(textScale * 100)}%</span>
            </div>
            <p className="muted small">Increase scale for readability on high-density screens.</p>
          </div>

          <div className="setting-group">
            <label>Quality Level</label>
            <div className="select-wrapper">
              <select 
                value={quality} 
                onChange={(e) => setQuality(e.target.value as QualityLevel)}
                className="text-input"
              >
                <option value="high">High (1.0x Res, MSAA)</option>
                <option value="medium">Medium (0.8x Res)</option>
                <option value="low">Low (0.5x Res, No FX)</option>
              </select>
            </div>
            <p className="muted small">Adjust render resolution for better performance on low-end devices.</p>
          </div>

          <div className="setting-group">
            <div className="checkbox-row">
              <input 
                type="checkbox" 
                id="shadows" 
                checked={shadows} 
                onChange={(e) => setShadows(e.target.checked)}
              />
              <label htmlFor="shadows">Enable Shadows</label>
            </div>
            <p className="muted small">Shadows are expensive. Disable for a big FPS boost.</p>
          </div>

          <div className="setting-group">
            <div className="checkbox-row">
              <input 
                type="checkbox" 
                id="stats" 
                checked={showStats} 
                onChange={(e) => setShowStats(e.target.checked)}
              />
              <label htmlFor="stats">Show FPS / Stats</label>
            </div>
          </div>

          <div className="setting-group">
            <label>Autosave History</label>
            <div className="checkbox-row">
              <input 
                type="checkbox"
                id="autosave"
                checked={autosaveEnabled}
                onChange={(e) => setAutosaveEnabled(e.target.checked)}
              />
              <label htmlFor="autosave">Enable autosaves (stored locally)</label>
            </div>
            <div className="select-wrapper">
              <select
                value={autosaveIntervalMinutes}
                onChange={(e) => setAutosaveIntervalMinutes(Number(e.target.value))}
                className="text-input"
              >
                <option value={1}>Every 1 minute</option>
                <option value={3}>Every 3 minutes</option>
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
              </select>
            </div>
            <div className="range-row" style={{ marginTop: '0.5rem' }}>
              <label className="muted small">Max snapshots</label>
              <input
                type="range"
                min={5}
                max={40}
                step={5}
                value={autosaveMaxEntries}
                onChange={(e) => setAutosaveMaxEntries(parseInt(e.target.value, 10))}
              />
              <span className="muted small">{autosaveMaxEntries}</span>
            </div>
            <div className="autosave-actions">
              <button
                className="secondary"
                onClick={() => {
                  const project = projectManager.serializeProject('Autosave');
                  autosaveManager.addAutosave(project, autosaveMaxEntries);
                  refreshAutosaves();
                  addToast('Autosave snapshot created', 'success');
                }}
              >
                Save snapshot now
              </button>
              <button
                className="secondary"
                onClick={() => {
                  autosaveManager.clearAutosaves();
                  refreshAutosaves();
                  addToast('Autosave history cleared', 'info');
                }}
              >
                Clear history
              </button>
            </div>
            {autosaves.length === 0 ? (
              <p className="muted small">No autosaves yet.</p>
            ) : (
              <div className="autosave-list">
                {autosaves.map((entry) => (
                  <div key={entry.id} className="autosave-item">
                    <div>
                      <div className="autosave-title">{entry.name}</div>
                      <div className="muted small">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="autosave-item__actions">
                      <button
                        className="secondary small"
                        onClick={async () => {
                          const result = await projectManager.loadProject(entry.project);
                          if (result.avatarWarning) {
                            addToast(result.avatarWarning, 'warning');
                          }
                          addToast('Autosave restored', 'success');
                        }}
                      >
                        Restore
                      </button>
                      <button
                        className="secondary small"
                        onClick={() => {
                          autosaveManager.removeAutosave(entry.id);
                          refreshAutosaves();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
            <p className="muted small" style={{textAlign: 'center', width: '100%'}}>
                Changes apply immediately.
            </p>
        </div>
      </div>
      <style>{`
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 16px;
        }
        
        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .setting-group { margin-bottom: 20px; }
        .checkbox-row { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
        .select-wrapper { margin-top: 5px; margin-bottom: 5px; }
        .range-row { display: flex; align-items: center; gap: 12px; }
        
        .theme-toggle {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          padding: 4px;
          border-radius: 8px;
          margin-top: 8px;
        }
        
        .theme-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-body);
          font-weight: 500;
        }
        
        .theme-btn.active {
          background: var(--accent);
          color: var(--color-abyss);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .theme-btn:hover:not(.active) {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }

        .close-button {
          background: transparent !important;
          border: none !important;
          color: var(--text-secondary);
          font-size: 1.5rem;
          padding: 8px;
          line-height: 1;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }
        
        .close-button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: var(--text-primary);
          transform: none;
        }

        .autosave-actions {
          display: flex;
          gap: 8px;
          margin: 8px 0;
          flex-wrap: wrap;
        }

        .autosave-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 240px;
          overflow: auto;
          padding-right: 4px;
        }

        .autosave-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .autosave-title {
          font-size: 0.9rem;
          font-weight: 600;
        }

        .autosave-item__actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
