import { useEffect, useRef, useState } from 'react';
import './pose-lab.css';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm';
import { getMixamoAnimation } from './getMixamoAnimation';
import { poseFromClip } from './poseFromClip';
import { convertAnimationToScenePaths } from './convertAnimationToScenePaths';
import { useAvatarSource } from '../state/useAvatarSource';
import type { PoseId } from '../types/reactions';
import type { VRMPose } from '@pixiv/three-vrm';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 1.4, 2.3);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(640, 640);

const hemi = new THREE.HemisphereLight(0xffffff, 0x080820, 1.2);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(0, 4, 2);
scene.add(dir);

// OrbitControls (initialized in useEffect)
let controls: OrbitControls | null = null;

// Animation mixer for playback
let mixer: THREE.AnimationMixer | null = null;
let currentAction: THREE.AnimationAction | null = null;

const mixamoSources = {
  crouch: new URL('../poses/fbx/Male Crouch Pose.fbx', import.meta.url).href,
  dance: new URL('../poses/fbx/Male Dance Pose.fbx', import.meta.url).href,
  dynamic: new URL('../poses/fbx/Male Dynamic Pose.fbx', import.meta.url).href,
  locomotion: new URL('../poses/fbx/Male Locomotion Pose.fbx', import.meta.url).href,
  sitting: new URL('../poses/fbx/Male Sitting Pose.fbx', import.meta.url).href,
  standing: new URL('../poses/fbx/Male Standing Pose.fbx', import.meta.url).href,
};

type BatchPoseConfig = {
  id: PoseId;
  label: string;
  source: string;
  fileName: string;
  sceneRotation?: { x?: number; y?: number; z?: number };
};

const batchConfigs: BatchPoseConfig[] = [
  { id: 'dawn-runner', label: 'Dawn Runner', source: mixamoSources.dynamic, fileName: 'Male Dynamic Pose.fbx', sceneRotation: { y: 180 } },
  { id: 'green-loom', label: 'Green Loom', source: mixamoSources.dance, fileName: 'Male Dance Pose.fbx', sceneRotation: { y: 180 } },
  { id: 'sunset-call', label: 'Sunset Call', source: mixamoSources.standing, fileName: 'Male Standing Pose.fbx', sceneRotation: { y: 180 } },
  { id: 'cipher-whisper', label: 'Cipher Whisper', source: mixamoSources.sitting, fileName: 'Male Sitting Pose.fbx', sceneRotation: { y: 180 } },
  { id: 'nebula-drift', label: 'Nebula Drift', source: mixamoSources.locomotion, fileName: 'Male Locomotion Pose.fbx', sceneRotation: { y: 180 } },
  { id: 'loom-vanguard', label: 'Loom Vanguard', source: mixamoSources.standing, fileName: 'Male Standing Pose.fbx', sceneRotation: { y: 180 } },
  { id: 'signal-reverie', label: 'Signal Reverie', source: mixamoSources.crouch, fileName: 'Male Crouch Pose.fbx', sceneRotation: { y: 180 } },
  { id: 'protocol-enforcer', label: 'Protocol Enforcer', source: mixamoSources.locomotion, fileName: 'Male Locomotion Pose.fbx', sceneRotation: { y: 180 } },
];

function PoseLab() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const animationClipRef = useRef<THREE.AnimationClip | null>(null);
  const [status, setStatus] = useState('🎭 Drag & drop a VRM file to begin');
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [isDraggingVRM, setIsDraggingVRM] = useState(false);
  const [isDraggingFBX, setIsDraggingFBX] = useState(false);
  const [currentAnimationClip, setCurrentAnimationClip] = useState<THREE.AnimationClip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const clockRef = useRef(new THREE.Clock());
  const isPlayingRef = useRef(false); // Ref for render loop access

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.innerHTML = '';
    canvasRef.current.appendChild(renderer.domElement);
    
    // Initialize OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.4, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 3;
    
    // Start render loop
    const animate = () => {
      const delta = clockRef.current.getDelta();
      controls?.update();
      
      // Update VRM
      if (vrmRef.current) {
        vrmRef.current.update(delta);
      }
      
      // Update animation mixer
      if (mixer && isPlayingRef.current) {
        mixer.update(delta);
      }
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();
    
    return () => {
      controls?.dispose();
    };
  }, []);

  const loadVRM = async (file: File, options?: { syncSource?: boolean }) => {
    setStatus('Loading VRM…');
    
    // Dispose of old VRM if exists
    if (vrmRef.current) {
      console.log('[PoseLab] Disposing old VRM');
      scene.remove(vrmRef.current.scene);
      vrmRef.current.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      vrmRef.current = null;
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(arrayBuffer, '');
    const vrm = gltf.userData.vrm as VRM;
    vrmRef.current = vrm;
    
    // Rotate VRM to face camera (VRM models load facing backwards by default)
    vrm.scene.rotation.set(0, THREE.MathUtils.degToRad(180), 0);
    
    scene.add(vrm.scene);
    setStatus('✅ VRM loaded! Now drop an FBX/GLTF animation.');
    renderer.render(scene, camera);
  };

  // No auto-loading - user must manually drop VRM file

  const retarget = async (file: File) => {
    if (!vrmRef.current) {
      setStatus('Load a VRM first.');
      return;
    }

    setStatus('Loading Mixamo pose…');
    try {
      const { animationClip } = await applyMixamoBuffer(await file.arrayBuffer(), file.name);
      animationClipRef.current = animationClip;
      setCurrentAnimationClip(animationClip);
      
      // Initialize mixer and start playing
      initializeAnimation(animationClip);
      
      setStatus('✅ Animation loaded! Use controls to preview.');
    } catch (error) {
      console.error('Retarget error:', error);
      setStatus(`Retarget failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const initializeAnimation = (clip: THREE.AnimationClip) => {
    const vrm = vrmRef.current;
    if (!vrm) {
      console.error('[PoseLab] Cannot initialize animation: VRM not loaded');
      return;
    }

    console.log('[PoseLab] Initializing animation:', clip.name, 'duration:', clip.duration);

    // Create or reset mixer
    if (mixer) {
      mixer.stopAllAction();
    }
    mixer = new THREE.AnimationMixer(vrm.scene);
    
    // Create action
    currentAction = mixer.clipAction(clip);
    currentAction.loop = isLooping ? THREE.LoopRepeat : THREE.LoopOnce;
    currentAction.clampWhenFinished = true;
    currentAction.play();
    
    console.log('[PoseLab] Animation started, isPlaying:', true);
    
    isPlayingRef.current = true;
    setIsPlaying(true);
  };

  const handlePlayPause = () => {
    if (!currentAction) return;
    
    if (isPlaying) {
      currentAction.paused = true;
      isPlayingRef.current = false;
      setIsPlaying(false);
      setStatus('⏸️ Animation paused');
    } else {
      currentAction.paused = false;
      isPlayingRef.current = true;
      setIsPlaying(true);
      setStatus('▶️ Animation playing');
    }
  };

  const handleStop = () => {
    if (!currentAction) return;
    
    currentAction.stop();
    currentAction.reset();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setStatus('⏹️ Animation stopped');
  };

  const handleRestart = () => {
    if (!currentAction) return;
    
    currentAction.stop();
    currentAction.reset();
    currentAction.play();
    isPlayingRef.current = true;
    setIsPlaying(true);
    setStatus('🔄 Animation restarted');
  };

  const handleToggleLoop = () => {
    const newLooping = !isLooping;
    setIsLooping(newLooping);
    
    if (currentAction) {
      currentAction.loop = newLooping ? THREE.LoopRepeat : THREE.LoopOnce;
    }
    
    setStatus(newLooping ? '🔁 Loop enabled' : '1️⃣ Play once');
  };

  const loadMixamoFromBuffer = async (arrayBuffer: ArrayBuffer, fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    let mixamoRoot: THREE.Object3D;
    let animations: THREE.AnimationClip[] = [];

    if (ext === 'fbx') {
      const loader = new FBXLoader();
      const group = loader.parse(arrayBuffer, '');
      mixamoRoot = group;
      animations = group.animations;
    } else {
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(arrayBuffer, '');
      mixamoRoot = gltf.scene || gltf;
      animations = gltf.animations;
    }

    return { mixamoRoot, animations };
  };

  const applyMixamoBuffer = async (arrayBuffer: ArrayBuffer, fileName: string) => {
    const vrm = vrmRef.current;
    if (!vrm) throw new Error('Load a VRM first.');

    const { mixamoRoot, animations } = await loadMixamoFromBuffer(arrayBuffer, fileName);

    const vrmClip = getMixamoAnimation(animations, mixamoRoot, vrm);
    if (!vrmClip) {
      throw new Error('Failed to convert Mixamo data for this VRM.');
    }

    // Convert animation to use scene node paths (critical for playback in main app)
    const scenePathClip = convertAnimationToScenePaths(vrmClip, vrm);
    console.log('[PoseLab] Converted animation to scene paths');

    const pose = poseFromClip(vrmClip);
    if (!pose || !Object.keys(pose).length) {
      throw new Error('Mixamo clip did not contain pose data.');
    }

    vrm.humanoid?.setNormalizedPose(pose);
    vrm.update(0);

    // Reframe Pose Lab camera so avatar stays centered per pose
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const height = size.y || 1;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distance = (height * 1.2) / (2 * Math.tan(fov / 2));
    camera.position.set(center.x, center.y, center.z + distance);
    camera.lookAt(center);

    renderer.render(scene, camera);

    // Return both pose and animation clip (with scene paths)
    return { pose, animationClip: scenePathClip };
  };

  const exportPose = async () => {
    const vrm = vrmRef.current;
    if (!vrm) {
      setStatus('Load a VRM before exporting.');
      return;
    }
    vrm.update(0);
    const pose = vrm.humanoid?.getNormalizedPose?.();
    if (!pose) {
      setStatus('Failed to extract pose.');
      return;
    }
    const payload = {
      sceneRotation: { y: 180 },
      vrmPose: pose,
    };
    
    // Export pose JSON
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pose.json';
    anchor.click();
    URL.revokeObjectURL(url);

    // Export animation clip if available
    if (animationClipRef.current) {
      const { serializeAnimationClip } = await import('../poses/animationClipSerializer');
      const serialized = serializeAnimationClip(animationClipRef.current);
      const animBlob = new Blob([JSON.stringify(serialized, null, 2)], { type: 'application/json' });
      const animUrl = URL.createObjectURL(animBlob);
      const animAnchor = document.createElement('a');
      animAnchor.href = animUrl;
      animAnchor.download = 'pose-animation.json';
      animAnchor.click();
      URL.revokeObjectURL(animUrl);
      setStatus('✅ Exported 2 files! Rename: pose.json → {id}.json, pose-animation.json → {id}-animation.json');
    } else {
      setStatus('Exported pose.json (no animation). Rename to {id}.json');
    }
  };

  const savePoseToDisk = async (
    poseId: PoseId,
    payload: {
      sceneRotation?: { x?: number; y?: number; z?: number };
      vrmPose: VRMPose;
      animationClip?: THREE.AnimationClip;
    }
  ) => {
    // Save pose JSON
    const response = await fetch('/__pose-export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ poseId, data: payload }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to save pose');
    }

    // If animation clip exists, save it separately
    if (payload.animationClip) {
      const { serializeAnimationClip } = await import('../poses/animationClipSerializer');
      const serialized = serializeAnimationClip(payload.animationClip);
      
      const animResponse = await fetch('/__pose-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poseId: `${poseId}-animation`,
          data: serialized,
        }),
      });
      if (!animResponse.ok) {
        console.warn('Failed to save animation clip for', poseId);
      }
    }
  };

  const batchExport = async () => {
    if (!vrmRef.current) {
      setStatus('Load a VRM before running batch export.');
      return;
    }
    setIsBatchExporting(true);
    try {
      for (const config of batchConfigs) {
        setStatus(`Exporting ${config.label}…`);
        const response = await fetch(config.source);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${config.label} (${response.status})`);
        }
        const buffer = await response.arrayBuffer();
        const { pose, animationClip } = await applyMixamoBuffer(buffer, config.fileName);
        await savePoseToDisk(config.id, {
          sceneRotation: config.sceneRotation ?? DEFAULT_SCENE_ROTATION,
          vrmPose: pose,
          animationClip, // Include animation clip
        });
      }
      setStatus('Batch export complete! Updated files in src/poses.');
    } catch (error) {
      console.error('Batch export failed', error);
      setStatus(`Batch export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBatchExporting(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.vrm')) {
      await loadVRM(file, { syncSource: true });
    } else if (/\.(fbx|gltf|glb)$/i.test(file.name)) {
      await retarget(file);
    } else {
      setStatus('Unsupported file type. Drop VRM or FBX/GLTF.');
    }
  };

  const runTest = async () => {
    try {
      setStatus('Running test: Fetching default VRM...');
      const vrmRes = await fetch('/vrm/HarmonVox_519.vrm');
      const vrmBlob = await vrmRes.blob();
      const vrmFile = new File([vrmBlob], 'HarmonVox_519.vrm');
      await loadVRM(vrmFile);

      setStatus('Running test: Fetching test pose...');
      const poseRes = await fetch('/test-pose.fbx');
      const poseBlob = await poseRes.blob();
      const poseFile = new File([poseBlob], 'test-pose.fbx');
      await retarget(poseFile);
    } catch (err) {
      console.error(err);
      setStatus('Test failed: ' + err);
    }
  };

  const handleVRMDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingVRM(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.vrm')) {
      await loadVRM(file);
    } else {
      setStatus('❌ Please drop a VRM file here.');
    }
  };

  const handleFBXDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFBX(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (/\.(fbx|gltf|glb)$/i.test(file.name)) {
      await retarget(file);
    } else {
      setStatus('Please drop an FBX, GLTF, or GLB file here.');
    }
  };

  return (
    <div className="pose-lab">
      <header className="pose-lab__header">
        <h1>🎭 Pose Lab</h1>
        <p className="muted">Retarget Mixamo animations to VRM format</p>
      </header>

      <div className="pose-lab__workflow">
        {/* Step 1: VRM Drop Zone */}
        <div className="pose-lab__step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h3>Load VRM Avatar</h3>
            <div
              className={`drop-zone ${isDraggingVRM ? 'drop-zone--active' : ''} ${vrmRef.current ? 'drop-zone--loaded' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingVRM(true);
              }}
              onDragLeave={() => setIsDraggingVRM(false)}
              onDrop={handleVRMDrop}
              onClick={() => document.getElementById('vrm-upload')?.click()}
            >
              <div className="drop-zone__icon">📦</div>
              <div className="drop-zone__text">
                {vrmRef.current ? (
                  <>
                    <strong>✅ VRM Loaded</strong>
                    <span>Drop another to replace</span>
                  </>
                ) : (
                  <>
                    <strong>Drag & Drop VRM File Here</strong>
                    <span>or click to browse</span>
                  </>
                )}
              </div>
              <input
                type="file"
                id="vrm-upload"
                accept=".vrm"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && loadVRM(e.target.files[0], { syncSource: true })}
              />
            </div>
          </div>
        </div>

        {/* Step 2: FBX Drop Zone */}
        <div className="pose-lab__step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h3>Load Mixamo Animation</h3>
            <div
              className={`drop-zone ${isDraggingFBX ? 'drop-zone--active' : ''} ${currentAnimationClip ? 'drop-zone--loaded' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFBX(true);
              }}
              onDragLeave={() => setIsDraggingFBX(false)}
              onDrop={handleFBXDrop}
              onClick={() => document.getElementById('fbx-upload')?.click()}
            >
              <div className="drop-zone__icon">🎬</div>
              <div className="drop-zone__text">
                {currentAnimationClip ? (
                  <>
                    <strong>✅ Animation Loaded</strong>
                    <span>Drop another to replace</span>
                  </>
                ) : (
                  <>
                    <strong>Drag & Drop FBX/GLTF File Here</strong>
                    <span>or click to browse</span>
                  </>
                )}
              </div>
              <input
                type="file"
                id="fbx-upload"
                accept=".fbx,.gltf,.glb"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && retarget(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        {/* Step 3: Preview Canvas */}
        <div className="pose-lab__step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h3>Preview & Export</h3>
            <div ref={canvasRef} className="pose-lab__canvas" />
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div className="status-card">
        <p className="status-message">{status}</p>
      </div>

      {/* Animation Controls */}
      {currentAnimationClip && (
        <div className="pose-lab__animation-controls">
          <h3>🎬 Animation Preview</h3>
          <div className="pose-lab__actions">
            <button type="button" onClick={handlePlayPause}>
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button type="button" onClick={handleStop}>
              ⏹️ Stop
            </button>
            <button type="button" onClick={handleRestart}>
              🔄 Restart
            </button>
            <button 
              type="button" 
              onClick={handleToggleLoop}
              className={isLooping ? 'active' : ''}
            >
              {isLooping ? '🔁 Loop' : '1️⃣ Once'}
            </button>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="pose-lab__actions">
        <button type="button" onClick={exportPose} disabled={!vrmRef.current}>
          💾 Export Pose JSON
        </button>
        <button type="button" onClick={batchExport} disabled={isBatchExporting || !vrmRef.current}>
          {isBatchExporting ? 'Exporting…' : '📦 Batch Export All Poses'}
        </button>
      </div>
    </div>
  );
}

export default PoseLab;

