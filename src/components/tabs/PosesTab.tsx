import { useState } from 'react';

interface SavedPose {
  id: string;
  name: string;
  timestamp: Date;
}

export function PosesTab() {
  const [savedPoses, setSavedPoses] = useState<SavedPose[]>([]);
  const [poseName, setPoseName] = useState('');

  const handleCapturePose = () => {
    if (!poseName.trim()) {
      alert('Please enter a name for the pose');
      return;
    }

    const newPose: SavedPose = {
      id: Date.now().toString(),
      name: poseName,
      timestamp: new Date(),
    };

    setSavedPoses([...savedPoses, newPose]);
    setPoseName('');
  };

  const handleApplyPose = (poseId: string) => {
    console.log('Apply pose:', poseId);
    // TODO: Implement pose application
  };

  const handleDeletePose = (poseId: string) => {
    setSavedPoses(savedPoses.filter((p) => p.id !== poseId));
  };

  const handleExportPose = (poseId: string) => {
    console.log('Export pose:', poseId);
    // TODO: Implement pose export
  };

  const handleExportAll = () => {
    console.log('Export all poses');
    // TODO: Implement export all
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Capture Pose</h3>
        <p className="muted small">Save the current avatar pose</p>
        
        <input
          type="text"
          className="text-input"
          placeholder="Pose name..."
          value={poseName}
          onChange={(e) => setPoseName(e.target.value)}
        />
        
        <button
          className="primary full-width"
          onClick={handleCapturePose}
          disabled={!poseName.trim()}
        >
          📸 Capture Current Pose
        </button>
      </div>

      {savedPoses.length > 0 && (
        <>
          <div className="tab-section">
            <h3>Saved Poses ({savedPoses.length})</h3>
            
            <div className="pose-list">
              {savedPoses.map((pose) => (
                <div key={pose.id} className="pose-item">
                  <div className="pose-item__info">
                    <strong>{pose.name}</strong>
                    <span className="muted small">
                      {pose.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="pose-item__actions">
                    <button
                      className="icon-button"
                      onClick={() => handleApplyPose(pose.id)}
                      title="Apply"
                    >
                      ✓
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => handleExportPose(pose.id)}
                      title="Export"
                    >
                      💾
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => handleDeletePose(pose.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tab-section">
            <button className="secondary full-width" onClick={handleExportAll}>
              Export All Poses
            </button>
          </div>
        </>
      )}
    </div>
  );
}

