import { useSettingsStore, type QualityLevel } from '../state/useSettingsStore';
import { GearSix, Moon, Sun } from '@phosphor-icons/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { quality, shadows, showStats, theme, setQuality, setShadows, setShowStats, setTheme } = useSettingsStore();

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
            </div>
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
      `}</style>
    </div>
  );
}
