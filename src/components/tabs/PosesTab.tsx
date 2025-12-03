import { useState } from 'react';
import { avatarManager } from '../../three/avatarManager';
import { sceneManager } from '../../three/sceneManager';
import { animationManager } from '../../three/animationManager';
import { serializeAnimationClip } from '../../poses/animationClipSerializer';
import type { VRMPose } from '@pixiv/three-vrm';
import * as THREE from 'three';

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
  const [savedPoses, setSavedPoses] = useState<SavedPose[]>([]);
  const [poseName, setPoseName] = useState('');

  const handleCapturePose = async () => {
    const vrm = avatarManager.getVRM();
    if (!vrm) {
      alert('Please load a VRM avatar first');
      return;
    }

    if (!poseName.trim()) {
      alert('Please enter a name for the pose');
      return;
    }

    try {
      // Update VRM to ensure pose is current
      vrm.update(0);
      
      // Capture VRM pose
      const vrmPose = vrm.humanoid?.getNormalizedPose();
      if (!vrmPose) {
        alert('Failed to capture pose');
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
      alert(`✅ Captured pose: ${newPose.name}${animationClip ? ' (with animation)' : ''}`);
    } catch (error) {
      console.error('Failed to capture pose:', error);
      alert(`Failed to capture pose: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleApplyPose = async (poseId: string) => {
    const pose = savedPoses.find((p) => p.id === poseId);
    if (!pose) {
      alert('Pose not found');
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

      alert(`✅ Applied pose: ${pose.name}`);
    } catch (error) {
      console.error('Failed to apply pose:', error);
      alert(`Failed to apply pose: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeletePose = (poseId: string) => {
    setSavedPoses(savedPoses.filter((p) => p.id !== poseId));
  };

  const handleExportPose = (poseId: string) => {
    const pose = savedPoses.find((p) => p.id === poseId);
    if (!pose) {
      alert('Pose not found');
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
      anchor.download = `${pose.name.replace(/\s+/g, '-').toLowerCase()}.json`;
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
        animAnchor.download = `${pose.name.replace(/\s+/g, '-').toLowerCase()}-animation.json`;
        animAnchor.click();
        URL.revokeObjectURL(animUrl);
        alert(`✅ Exported 2 files: ${pose.name}.json and ${pose.name}-animation.json`);
      } else {
        alert(`✅ Exported: ${pose.name}.json`);
      }
    } catch (error) {
      console.error('Failed to export pose:', error);
      alert(`Failed to export pose: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExportAll = () => {
    if (savedPoses.length === 0) {
      alert('No poses to export');
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
      alert(`✅ Exported ${savedPoses.length} pose(s) to all-poses.json`);
    } catch (error) {
      console.error('Failed to export all poses:', error);
      alert(`Failed to export poses: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

