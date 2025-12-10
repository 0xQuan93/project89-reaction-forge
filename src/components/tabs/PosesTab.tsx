import { useState } from 'react';
import { avatarManager } from '../../three/avatarManager';
import { animationManager } from '../../three/animationManager';
import { serializeAnimationClip } from '../../poses/animationClipSerializer';
import type { VRMPose } from '@pixiv/three-vrm';
import { useToastStore } from '../../state/useToastStore';

interface SavedPose {
  id: string;
  name: string;
  timestamp: Date;
  vrmPose: VRMPose;
  sceneRotation: { x: number; y: number; z: number };
  animationClip?: {
    name: string;
    duration: number;
    tracks: any[];
  };
}

export function PosesTab() {
  const { addToast } = useToastStore();
  const [savedPoses, setSavedPoses] = useState<SavedPose[]>([]);
  const [poseName, setPoseName] = useState('');

  const handleCapturePose = async () => {
    const vrm = avatarManager.getVRM();
    if (!vrm) {
      addToast('Please load a VRM avatar first', 'warning');
      return;
    }

    if (!poseName.trim()) {
      addToast('Please enter a name for the pose', 'warning');
      return;
    }

    try {
      // Update VRM to ensure pose is current
      vrm.update(0);
      
      // Capture VRM pose
      const vrmPose = vrm.humanoid?.getNormalizedPose();
      if (!vrmPose) {
        addToast('Failed to capture pose', 'error');
        return;
      }

      // Capture scene rotation (in degrees)
      const sceneRotation = {
        x: (vrm.scene.rotation.x * 180) / Math.PI,
        y: (vrm.scene.rotation.y * 180) / Math.PI,
        z: (vrm.scene.rotation.z * 180) / Math.PI,
      };

      // Check if there's a current animation playing
      let animationClip: SavedPose['animationClip'] | undefined;
      if (animationManager.isPlaying()) {
        const currentAction = animationManager.getCurrentAction();
        if (currentAction) {
          const clip = currentAction.getClip();
          const serialized = serializeAnimationClip(clip);
          animationClip = {
            name: serialized.name,
            duration: serialized.duration,
            tracks: serialized.tracks,
          };
        }
      }

      const newPose: SavedPose = {
        id: Date.now().toString(),
        name: poseName.trim(),
        timestamp: new Date(),
        vrmPose: JSON.parse(JSON.stringify(vrmPose)), // Deep clone
        sceneRotation,
        animationClip,
      };

      setSavedPoses([...savedPoses, newPose]);
      setPoseName('');
      addToast(`✅ Captured pose: ${newPose.name}${animationClip ? ' (with animation)' : ''}`, 'success');
    } catch (error) {
      console.error('Failed to capture pose:', error);
      addToast(`Failed to capture pose: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleApplyPose = async (poseId: string) => {
    const pose = savedPoses.find((p) => p.id === poseId);
    if (!pose) {
      addToast('Pose not found', 'error');
      return;
    }

    try {
      const poseData: any = {
        vrmPose: pose.vrmPose,
        sceneRotation: pose.sceneRotation,
      };

      // If pose has animation, include it
      if (pose.animationClip) {
        poseData.tracks = pose.animationClip.tracks;
        poseData.duration = pose.animationClip.duration;
        poseData.name = pose.animationClip.name;
        await avatarManager.applyRawPose(poseData, 'loop');
      } else {
        await avatarManager.applyRawPose(poseData, 'static');
      }

      addToast(`✅ Applied pose: ${pose.name}`, 'success');
    } catch (error) {
      console.error('Failed to apply pose:', error);
      addToast(`Failed to apply pose: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDeletePose = (poseId: string) => {
    setSavedPoses(savedPoses.filter((p) => p.id !== poseId));
  };

  const handleExportPose = (poseId: string) => {
    const pose = savedPoses.find((p) => p.id === poseId);
    if (!pose) {
      addToast('Pose not found', 'error');
      return;
    }

    try {
      // Export pose JSON
      const poseData = {
        sceneRotation: pose.sceneRotation,
        vrmPose: pose.vrmPose,
      };

      const blob = new Blob([JSON.stringify(poseData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `PoseLab_${pose.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      // Export animation if available
      if (pose.animationClip) {
        const animData = {
          name: pose.animationClip.name,
          duration: pose.animationClip.duration,
          tracks: pose.animationClip.tracks,
        };
        const animBlob = new Blob([JSON.stringify(animData, null, 2)], { type: 'application/json' });
        const animUrl = URL.createObjectURL(animBlob);
        const animAnchor = document.createElement('a');
        animAnchor.href = animUrl;
        animAnchor.download = `PoseLab_${pose.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_animation.json`;
        animAnchor.click();
        URL.revokeObjectURL(animUrl);
        addToast(`✅ Exported 2 files for ${pose.name}`, 'success');
      } else {
        addToast(`✅ Exported: ${pose.name}`, 'success');
      }
    } catch (error) {
      console.error('Failed to export pose:', error);
      addToast(`Failed to export pose: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleExportAll = () => {
    if (savedPoses.length === 0) {
      addToast('No poses to export', 'warning');
      return;
    }

    try {
      const allPosesData = savedPoses.map((pose) => ({
        name: pose.name,
        timestamp: pose.timestamp.toISOString(),
        sceneRotation: pose.sceneRotation,
        vrmPose: pose.vrmPose,
        animationClip: pose.animationClip,
      }));

      const blob = new Blob([JSON.stringify(allPosesData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'all-poses.json';
      anchor.click();
      URL.revokeObjectURL(url);
      addToast(`✅ Exported ${savedPoses.length} pose(s) to all-poses.json`, 'success');
    } catch (error) {
      console.error('Failed to export all poses:', error);
      addToast(`Failed to export poses: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
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
                      {pose.animationClip && ' 🎬'}
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

