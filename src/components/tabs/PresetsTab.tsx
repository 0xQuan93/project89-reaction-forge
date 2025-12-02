import { useReactionStore } from '../../state/useReactionStore';
import { reactionPresets } from '../../data/reactions';

export function PresetsTab() {
  const { activePreset, setPresetById, isAvatarReady } = useReactionStore();

  const handlePresetClick = (presetId: string) => {
    setPresetById(presetId);
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Quick Presets</h3>
        <p className="muted small">Select a preset to apply pose, expression, and background</p>
      </div>

      <div className="preset-grid">
        {reactionPresets.map((preset) => (
          <button
            key={preset.id}
            className={`preset-card ${activePreset.id === preset.id ? 'active' : ''}`}
            onClick={() => handlePresetClick(preset.id)}
            disabled={!isAvatarReady}
          >
            <div className="preset-card__indicator" style={{ backgroundColor: preset.background === 'green-loom-matrix' ? '#00ffd6' : '#9c2253' }} />
            <div className="preset-card__content">
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

