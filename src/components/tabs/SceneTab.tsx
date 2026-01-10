import { useState, useEffect, useRef } from 'react';
import { sceneManager } from '../../three/sceneManager';
import { backgroundOptions } from '../../three/backgrounds';
import { avatarManager } from '../../three/avatarManager';
import { useReactionStore } from '../../state/useReactionStore';
import { useToastStore } from '../../state/useToastStore';
import { useUIStore } from '../../state/useUIStore';
import { useSceneSettingsStore } from '../../state/useSceneSettingsStore';
import { useIntroStore } from '../../state/useIntroStore';
import { useAvatarSource } from '../../state/useAvatarSource';
import { useOnboardingStore } from '../../state/useOnboardingStore';
import { introSequence } from '../../intro/IntroSequence';
import { getOnboardingPersona, ONBOARDING_PERSONAS } from '../../data/onboardingPaths';
import { LIGHT_PRESETS } from '../../three/lightingManager';
import { POST_PRESETS } from '../../three/postProcessingManager';
import { HDRI_PRESETS, environmentManager } from '../../three/environmentManager';
import { MATERIAL_PRESETS, materialManager } from '../../three/materialManager';
import type { BackgroundId } from '../../types/reactions';
import { MultiplayerPanel } from '../MultiplayerPanel';
import { notifySceneChange } from '../../multiplayer/avatarBridge';
import { live2dManager } from '../../live2d/live2dManager';
import { 
  User, 
  Lightbulb, 
  Palette, 
  Sparkle, 
  Image, 
  FilmStrip, 
  Globe, 
  FilmSlate,
  CaretDown,
  ArrowsClockwise,
  Package,
  Lock,
  LockOpen,
  UploadSimple,
  Plus,
  FrameCorners,
  Play,
  Sun,
  MagnifyingGlass
} from '@phosphor-icons/react';

type AspectRatio = '16:9' | '1:1' | '9:16';

// Collapsible Section Component
function Section({ 
  title, 
  icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="tab-section" style={{ marginBottom: '0.5rem' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--accent, #00ffd6)' }}>{icon}</span>
          <span>{title}</span>
        </span>
        <CaretDown 
          size={16} 
          weight="bold"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>
      {isOpen && (
        <div style={{ 
          padding: '1rem',
          background: 'var(--glass-bg)',
          borderRadius: '0 0 8px 8px',
          marginTop: '-4px',
          borderLeft: '1px solid var(--glass-border)',
          borderRight: '1px solid var(--glass-border)',
          borderBottom: '1px solid var(--glass-border)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Slider Component
function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '0.25rem',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)'
      }}>
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '3px',
          background: 'var(--color-surface)',
          outline: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

// Toggle Component
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox-option" style={{ marginBottom: '0.5rem' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

// Preset Buttons
function PresetButtons({
  presets,
  activePreset,
  onSelect,
}: {
  presets: Record<string, { name: string }>;
  activePreset: string;
  onSelect: (preset: string) => void;
}) {
  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '4px',
      marginBottom: '1rem'
    }}>
      {Object.entries(presets).map(([id, preset]) => (
        <button
          key={id}
          className={activePreset === id ? 'secondary active' : 'secondary'}
          onClick={() => onSelect(id)}
          style={{ 
            flex: '1 1 calc(50% - 4px)', 
            fontSize: '0.75rem',
            padding: '0.5rem 0.75rem'
          }}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
}

export function SceneTab() {
  const { isAvatarReady, setAvatarReady } = useReactionStore();
  const { avatarType, sourceLabel, setFileSource, setLive2dSource } = useAvatarSource();
  const { addToast } = useToastStore();
  const { activeCssOverlay, setActiveCssOverlay } = useUIStore();
  const sceneSettings = useSceneSettingsStore();
  const { 
    backgroundLocked, 
    setBackgroundLocked,
    setCurrentBackground,
    setCustomBackground: setCustomBackgroundStore,
    currentBackground: storeBackground,
    customBackgroundData,
    rotationLocked,
    setRotationLocked,
  } = useSceneSettingsStore();
  
  const [selectedBackground, setSelectedBackground] = useState(storeBackground || 'midnight-circuit');
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isLoadingHdri, setIsLoadingHdri] = useState(false);
  
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const live2dInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const hdriInputRef = useRef<HTMLInputElement>(null);
  const [live2dExpression, setLive2dExpression] = useState('');
  const [live2dExpressionWeight, setLive2dExpressionWeight] = useState(0.8);
  const [live2dPhysicsEnabled, setLive2dPhysicsEnabled] = useState(true);
  const [live2dEyeTrackingEnabled, setLive2dEyeTrackingEnabled] = useState(true);
  const { selectedPersonaId, completedSteps, setPersona, toggleStep, resetPersona } = useOnboardingStore();
  const activePersona = getOnboardingPersona(selectedPersonaId) ?? ONBOARDING_PERSONAS[0];
  const personaCompletedSteps = completedSteps[activePersona.id] ?? [];
  const personaStepIds = new Set(activePersona.steps.map((step) => step.id));
  const personaCompletedCount = personaCompletedSteps.filter((stepId) => personaStepIds.has(stepId)).length;

  // Restore custom background from store on mount
  useEffect(() => {
    if (customBackgroundData) {
      const url = `data:${useSceneSettingsStore.getState().customBackgroundType || 'image/png'};base64,${customBackgroundData}`;
      setCustomBackground(url);
      if (storeBackground === 'custom') {
        sceneManager.setBackground(url);
      }
    }
  }, []);

  useEffect(() => {
    const currentRatio = sceneManager.getAspectRatio();
    setAspectRatio(currentRatio);
  }, []);

  useEffect(() => {
    if (!getOnboardingPersona(selectedPersonaId) && ONBOARDING_PERSONAS.length > 0) {
      setPersona(ONBOARDING_PERSONAS[0].id);
    }
  }, [selectedPersonaId, setPersona]);

  const handleVRMUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarReady(false);
    try {
      setFileSource(file);
      addToast('Loading VRM avatar...', 'info');
    } catch (error) {
      console.error('Failed to load VRM:', error);
      addToast('Failed to load VRM file', 'error');
    }
  };

  const handleLive2DUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;
    event.target.value = '';

    try {
      const zipFile = selectedFiles.length === 1 && selectedFiles[0].name.toLowerCase().endsWith('.zip');
      if (zipFile) {
        addToast('ZIP bundles are not supported yet. Please select the .model3.json and texture files directly.', 'warning');
        return;
      }

      setAvatarReady(false);
      const files = selectedFiles;
      const label = files.find((file) => file.name.toLowerCase().endsWith('.model3.json'))?.name ?? 'Live2D Avatar';
      await setLive2dSource(files, label);
      addToast('Live2D avatar loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to load Live2D:', error);
      addToast(error instanceof Error ? error.message : 'Failed to load Live2D assets', 'error');
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      addToast('Please select an image or video file', 'warning');
      return;
    }

    const url = URL.createObjectURL(file);
    const typeUrl = `${url}#type=${file.type}`;
    
    setCustomBackground(typeUrl);
    setSelectedBackground('custom');
    await sceneManager.setBackground(typeUrl);
    
    // Store base64 for persistence and multiplayer sync
    // Only for images that aren't too large (under 5MB)
    if (file.type.startsWith('image/') && file.size < 5 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setCustomBackgroundStore(base64, file.type);
        
        // Notify multiplayer (will be handled by sync manager)
        notifySceneChange({ background: 'custom' });
      };
      reader.readAsDataURL(file);
    } else {
      // Just update local state for large files or videos
      setCurrentBackground('custom');
      setBackgroundLocked(true);
      addToast('Background set (too large for multiplayer sync)', 'info');
    }
  };

  const handleHdriUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.hdr') && !file.name.toLowerCase().endsWith('.exr')) {
      addToast('Please select an HDR or EXR file', 'warning');
      return;
    }

    setIsLoadingHdri(true);
    try {
      await environmentManager.loadHDRIFromFile(file);
      sceneSettings.setEnvironment({ enabled: true });
      sceneSettings.setEnvironmentPreset('custom');
      addToast('HDRI loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to load HDRI:', error);
      addToast('Failed to load HDRI file', 'error');
    } finally {
      setIsLoadingHdri(false);
    }
  };

  const handleBackgroundSelect = async (backgroundId: string) => {
    setSelectedBackground(backgroundId);
    setCurrentBackground(backgroundId);
    
    if (backgroundId === 'custom' && customBackground) {
      await sceneManager.setBackground(customBackground);
    } else {
      await sceneManager.setBackground(backgroundId as BackgroundId);
    }
    
    // Notify multiplayer peers if we're the host
    notifySceneChange({ background: backgroundId });
  };

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    sceneManager.setAspectRatio(ratio);
    
    // Notify multiplayer peers if we're the host
    notifySceneChange({ aspectRatio: ratio });
  };

  const handleHdriPreset = async (presetId: string) => {
    setIsLoadingHdri(true);
    try {
      await sceneSettings.setEnvironmentPreset(presetId);
      if (presetId !== 'none') {
        addToast('Environment loaded', 'success');
      }
    } catch {
      addToast('Failed to load environment', 'error');
    } finally {
      setIsLoadingHdri(false);
    }
  };

  const vrmReady = avatarType === 'vrm' && isAvatarReady;

  return (
    <div className="tab-content" style={{ gap: '0.5rem' }}>
      {/* Avatar Section */}
      <Section title="Avatar" icon={<User size={18} weight="duotone" />} defaultOpen={!isAvatarReady}>
        <p className="muted small">Load or change the VRM or Live2D avatar</p>
        <button
          className={vrmReady ? 'secondary full-width' : 'primary full-width'}
          onClick={() => vrmInputRef.current?.click()}
        >
          {vrmReady ? <><ArrowsClockwise size={16} weight="duotone" /> Change Avatar</> : <><Package size={16} weight="duotone" /> Load VRM Avatar</>}
        </button>

        <button
          className="secondary full-width"
          onClick={() => live2dInputRef.current?.click()}
          style={{ marginTop: '0.5rem' }}
        >
          {avatarType === 'live2d' ? <><ArrowsClockwise size={16} weight="duotone" /> Change Live2D Avatar</> : <><UploadSimple size={16} weight="duotone" /> Load Live2D Avatar</>}
        </button>
        
        {vrmReady && (
          <>
            <button
              className="secondary full-width"
              onClick={() => {
                const vrm = avatarManager.getVRM();
                if (vrm) sceneManager.frameObject(vrm.scene);
              }}
              style={{ marginTop: '0.5rem' }}
            >
              <MagnifyingGlass size={16} weight="duotone" /> Fit Avatar to Screen
            </button>
            
            {/* Rotation lock toggle */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: rotationLocked ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              border: rotationLocked ? '1px solid rgba(255, 193, 7, 0.3)' : '1px solid transparent',
            }}>
              <span className="small" style={{ color: rotationLocked ? '#ffc107' : 'var(--text-muted)' }}>
                {rotationLocked ? <><Lock size={14} weight="fill" /> Rotation locked</> : <><LockOpen size={14} weight="duotone" /> Rotation unlocked</>}
              </span>
              <button
                className={`secondary small ${rotationLocked ? 'active' : ''}`}
                onClick={() => setRotationLocked(!rotationLocked)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                title={rotationLocked ? 'Unlock rotation (will change with poses)' : 'Lock rotation (won\'t change with poses)'}
              >
                {rotationLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          </>
        )}

        {avatarType === 'live2d' && (
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
            <p className="muted small" style={{ marginBottom: '0.5rem' }}>
              Live2D Controls ({sourceLabel})
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={live2dExpression}
                onChange={(e) => setLive2dExpression(e.target.value)}
                placeholder="Expression name"
                style={{
                  flex: 1,
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--color-surface)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                className="secondary small"
                onClick={() => live2dManager.setExpression(live2dExpression || 'neutral', live2dExpressionWeight)}
              >
                Apply
              </button>
            </div>
            <Slider
              label="Expression Weight"
              value={live2dExpressionWeight}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) => setLive2dExpressionWeight(value)}
            />
            <Toggle
              label="Physics Enabled"
              checked={live2dPhysicsEnabled}
              onChange={(enabled) => {
                setLive2dPhysicsEnabled(enabled);
                live2dManager.setPhysicsEnabled(enabled);
              }}
            />
            <Toggle
              label="Eye Tracking"
              checked={live2dEyeTrackingEnabled}
              onChange={(enabled) => {
                setLive2dEyeTrackingEnabled(enabled);
                live2dManager.setEyeTrackingEnabled(enabled);
              }}
            />
          </div>
        )}
        
        <input
          ref={vrmInputRef}
          type="file"
          accept=".vrm"
          onChange={handleVRMUpload}
          style={{ display: 'none' }}
        />
        <input
          ref={live2dInputRef}
          type="file"
          accept=".model3.json,.zip,.moc3,.json,image/*"
          multiple
          onChange={handleLive2DUpload}
          style={{ display: 'none' }}
        />
      </Section>

      <Section title="Creator Path" icon={<User size={18} weight="duotone" />} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Choose a persona to get an evergreen checklist tailored to your workflow.
            </span>
            <select
              value={activePersona.id}
              onChange={(event) => setPersona(event.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            >
              {ONBOARDING_PERSONAS.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {activePersona.description}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              Progress: {personaCompletedCount}/{activePersona.steps.length}
            </span>
            <button
              className="secondary"
              onClick={() => resetPersona(activePersona.id)}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            >
              Reset
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {activePersona.steps.map((step) => {
              const isComplete = personaCompletedSteps.includes(step.id);
              return (
                <label
                  key={step.id}
                  style={{
                    display: 'flex',
                    gap: '0.6rem',
                    alignItems: 'flex-start',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '0.6rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isComplete}
                    onChange={() => toggleStep(activePersona.id, step.id)}
                    style={{ marginTop: '0.2rem', accentColor: 'var(--accent)' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {step.title}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {step.description}
                    </span>
                    {step.cta && (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(0, 255, 214, 0.8)' }}>
                        {step.cta}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Lighting Section */}
      <Section title="Lighting" icon={<Lightbulb size={18} weight="duotone" />} defaultOpen={false}>
        <p className="muted small" style={{ marginBottom: '0.75rem' }}>
          3-point lighting presets for professional renders
        </p>
        
        <PresetButtons
          presets={LIGHT_PRESETS}
          activePreset={sceneSettings.lightingPreset}
          onSelect={(preset) => sceneSettings.setLightingPreset(preset)}
        />
        
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
          <Toggle
            label="Key Light (Main)"
            checked={sceneSettings.lighting.keyLight.enabled}
            onChange={(enabled) => sceneSettings.setLighting({ keyLight: { ...sceneSettings.lighting.keyLight, enabled } })}
          />
          {sceneSettings.lighting.keyLight.enabled && (
            <Slider
              label="Intensity"
              value={sceneSettings.lighting.keyLight.intensity}
              min={0}
              max={3}
              onChange={(intensity) => sceneSettings.setLighting({ keyLight: { ...sceneSettings.lighting.keyLight, intensity } })}
            />
          )}
          
          <Toggle
            label="Fill Light"
            checked={sceneSettings.lighting.fillLight.enabled}
            onChange={(enabled) => sceneSettings.setLighting({ fillLight: { ...sceneSettings.lighting.fillLight, enabled } })}
          />
          
          <Toggle
            label="Rim Light"
            checked={sceneSettings.lighting.rimLight.enabled}
            onChange={(enabled) => sceneSettings.setLighting({ rimLight: { ...sceneSettings.lighting.rimLight, enabled } })}
          />
          
          <Toggle
            label="Ambient Light"
            checked={sceneSettings.lighting.ambient.enabled}
            onChange={(enabled) => sceneSettings.setLighting({ ambient: { ...sceneSettings.lighting.ambient, enabled } })}
          />
        </div>
      </Section>

      {/* Material/Toon Shader Section */}
      <Section title="Toon Shader" icon={<Palette size={18} weight="duotone" />} defaultOpen={false}>
        <p className="muted small" style={{ marginBottom: '0.75rem' }}>
          VRM material and outline customization
        </p>
        
        <PresetButtons
          presets={MATERIAL_PRESETS}
          activePreset={sceneSettings.materialPreset}
          onSelect={(preset) => {
            sceneSettings.setMaterialPreset(preset);
            // Force reapply if avatar is loaded
            if (isAvatarReady) {
              materialManager.onVRMLoaded();
            }
          }}
        />
        
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
          <Toggle
            label="Outline Enabled"
            checked={sceneSettings.material.outline.enabled}
            onChange={(enabled) => sceneSettings.setMaterial({ outline: { ...sceneSettings.material.outline, enabled } })}
          />
          {sceneSettings.material.outline.enabled && (
            <Slider
              label="Outline Width"
              value={sceneSettings.material.outline.widthFactor}
              min={0}
              max={3}
              onChange={(widthFactor) => sceneSettings.setMaterial({ outline: { ...sceneSettings.material.outline, widthFactor } })}
            />
          )}
          
          <Slider
            label="Emissive Glow"
            value={sceneSettings.material.material.emissiveIntensity}
            min={0}
            max={3}
            onChange={(emissiveIntensity) => sceneSettings.setMaterial({ material: { ...sceneSettings.material.material, emissiveIntensity } })}
          />
          
          <Slider
            label="Rim Intensity"
            value={sceneSettings.material.shading.rimIntensity}
            min={0}
            max={1}
            onChange={(rimIntensity) => sceneSettings.setMaterial({ shading: { ...sceneSettings.material.shading, rimIntensity } })}
          />
          
          <button
            className="secondary full-width"
            onClick={() => materialManager.debugMaterials()}
            style={{ marginTop: '0.75rem', fontSize: '0.75rem' }}
          >
            <MagnifyingGlass size={16} weight="duotone" /> Debug Materials (Console)
          </button>
        </div>
      </Section>

      {/* Post-Processing Section */}
      <Section title="Effects" icon={<Sparkle size={18} weight="duotone" />} defaultOpen={false}>
        <p className="muted small" style={{ marginBottom: '0.75rem' }}>
          Post-processing effects for cinematic looks
        </p>
        
        <PresetButtons
          presets={POST_PRESETS}
          activePreset={sceneSettings.postPreset}
          onSelect={(preset) => sceneSettings.setPostPreset(preset)}
        />
        
        {sceneSettings.postProcessing.enabled && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
            <Toggle
              label="Bloom"
              checked={sceneSettings.postProcessing.bloom.enabled}
              onChange={(enabled) => sceneSettings.setPostProcessing({ bloom: { ...sceneSettings.postProcessing.bloom, enabled } })}
            />
            {sceneSettings.postProcessing.bloom.enabled && (
              <>
                <Slider
                  label="Bloom Intensity"
                  value={sceneSettings.postProcessing.bloom.intensity}
                  min={0}
                  max={2}
                  onChange={(intensity) => sceneSettings.setPostProcessing({ bloom: { ...sceneSettings.postProcessing.bloom, intensity } })}
                />
                <Slider
                  label="Bloom Threshold"
                  value={sceneSettings.postProcessing.bloom.threshold}
                  min={0}
                  max={1}
                  onChange={(threshold) => sceneSettings.setPostProcessing({ bloom: { ...sceneSettings.postProcessing.bloom, threshold } })}
                />
              </>
            )}
            
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <Slider
                label="Brightness"
                value={sceneSettings.postProcessing.colorGrading.brightness}
                min={-0.5}
                max={0.5}
                onChange={(brightness) => sceneSettings.setPostProcessing({ colorGrading: { ...sceneSettings.postProcessing.colorGrading, brightness } })}
              />
              <Slider
                label="Contrast"
                value={sceneSettings.postProcessing.colorGrading.contrast}
                min={0.5}
                max={2}
                onChange={(contrast) => sceneSettings.setPostProcessing({ colorGrading: { ...sceneSettings.postProcessing.colorGrading, contrast } })}
              />
              <Slider
                label="Saturation"
                value={sceneSettings.postProcessing.colorGrading.saturation}
                min={0}
                max={2}
                onChange={(saturation) => sceneSettings.setPostProcessing({ colorGrading: { ...sceneSettings.postProcessing.colorGrading, saturation } })}
              />
            </div>
            
            <Toggle
              label="Vignette"
              checked={sceneSettings.postProcessing.vignette.enabled}
              onChange={(enabled) => sceneSettings.setPostProcessing({ vignette: { ...sceneSettings.postProcessing.vignette, enabled } })}
            />
            
            <Toggle
              label="Film Grain"
              checked={sceneSettings.postProcessing.filmGrain.enabled}
              onChange={(enabled) => sceneSettings.setPostProcessing({ filmGrain: { ...sceneSettings.postProcessing.filmGrain, enabled } })}
            />
          </div>
        )}
      </Section>

      {/* Environment/HDRI Section */}
      <Section title="Environment" icon={<Sun size={18} weight="duotone" />} defaultOpen={false}>
        <p className="muted small" style={{ marginBottom: '0.75rem' }}>
          HDRI environment maps for realistic lighting and reflections
        </p>
        
        <PresetButtons
          presets={HDRI_PRESETS}
          activePreset={sceneSettings.environmentPreset}
          onSelect={handleHdriPreset}
        />
        
        {isLoadingHdri && (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#00ffd6' }}>
            Loading environment...
          </div>
        )}
        
        <button
          className="secondary full-width"
          onClick={() => hdriInputRef.current?.click()}
          disabled={isLoadingHdri}
        >
          <UploadSimple size={16} weight="duotone" /> Upload Custom HDR
        </button>
        <input
          ref={hdriInputRef}
          type="file"
          accept=".hdr,.exr"
          onChange={handleHdriUpload}
          style={{ display: 'none' }}
        />
        
        {sceneSettings.environment.enabled && (
          <div style={{ marginTop: '0.75rem' }}>
            <Slider
              label="Environment Intensity"
              value={sceneSettings.environment.intensity}
              min={0}
              max={3}
              onChange={(intensity) => sceneSettings.setEnvironment({ intensity })}
            />
            <Slider
              label="Background Blur"
              value={sceneSettings.environment.backgroundBlur}
              min={0}
              max={1}
              onChange={(backgroundBlur) => sceneSettings.setEnvironment({ backgroundBlur })}
            />
            <Slider
              label="Rotation"
              value={sceneSettings.environment.rotation}
              min={0}
              max={360}
              step={1}
              onChange={(rotation) => sceneSettings.setEnvironment({ rotation })}
            />
          </div>
        )}
      </Section>

      {/* Backgrounds Section */}
      <Section title="Backgrounds" icon={<Image size={18} weight="duotone" />} defaultOpen={false}>
        {/* Lock toggle */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          padding: '0.5rem 0.75rem',
          background: backgroundLocked ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: backgroundLocked ? '1px solid rgba(255, 193, 7, 0.3)' : '1px solid transparent',
        }}>
          <span className="small" style={{ color: backgroundLocked ? '#ffc107' : 'var(--text-muted)' }}>
            {backgroundLocked ? <><Lock size={14} weight="fill" /> Background locked</> : <><LockOpen size={14} weight="duotone" /> Background unlocked</>}
          </span>
          <button
            className={`secondary small ${backgroundLocked ? 'active' : ''}`}
            onClick={() => setBackgroundLocked(!backgroundLocked)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            title={backgroundLocked ? 'Unlock background (will change with poses)' : 'Lock background (won\'t change with poses)'}
          >
            {backgroundLocked ? 'Unlock' : 'Lock'}
          </button>
        </div>
        
        <div className="background-grid">
          <button
            className={`background-thumbnail ${selectedBackground === 'custom' ? 'active' : ''}`}
            onClick={() => customBackground ? handleBackgroundSelect('custom') : bgInputRef.current?.click()}
            title="Upload Custom Background"
          >
            <div className="background-thumbnail__preview" style={{
              backgroundImage: customBackground ? `url(${customBackground})` : 'none',
              backgroundColor: '#2a2a2a',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {!customBackground && <Plus size={24} weight="bold" />}
            </div>
            <span className="background-thumbnail__name">Custom</span>
          </button>

          {backgroundOptions.map((bg) => (
            <button
              key={bg.id}
              className={`background-thumbnail ${selectedBackground === bg.id ? 'active' : ''}`}
              onClick={() => handleBackgroundSelect(bg.id)}
              title={bg.label}
            >
              <div className="background-thumbnail__preview" style={{
                backgroundImage: bg.image ? `url(${bg.image})` : 'none',
                backgroundColor: bg.image ? 'transparent' : String(bg.color),
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }} />
              <span className="background-thumbnail__name">{bg.label}</span>
            </button>
          ))}
        </div>

        <button 
          className="secondary full-width"
          onClick={() => bgInputRef.current?.click()}
          style={{ marginTop: '0.75rem' }}
        >
          <UploadSimple size={16} weight="duotone" /> Upload Background
        </button>
        <input
          ref={bgInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleBackgroundUpload}
          style={{ display: 'none' }}
        />
      </Section>

      {/* FX Overlays */}
      <Section title="FX Overlays" icon={<FilmStrip size={18} weight="duotone" />} defaultOpen={false}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {['overlay-scanlines', 'overlay-vignette', 'overlay-glitch', 'overlay-crt'].map((overlay) => (
            <button
              key={overlay}
              className={activeCssOverlay === overlay ? 'secondary active' : 'secondary'}
              onClick={() => setActiveCssOverlay(activeCssOverlay === overlay ? null : overlay)}
              style={{ flex: '1 1 calc(50% - 4px)', fontSize: '0.75rem' }}
            >
              {overlay.replace('overlay-', '').charAt(0).toUpperCase() + overlay.replace('overlay-', '').slice(1)}
            </button>
          ))}
        </div>
      </Section>

      {/* Aspect Ratio */}
      <Section title="Aspect Ratio" icon={<FrameCorners size={18} weight="duotone" />} defaultOpen={false}>
        <div className="button-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['16:9', '1:1', '9:16'] as AspectRatio[]).map((ratio) => (
            <button
              key={ratio}
              className={aspectRatio === ratio ? 'secondary active' : 'secondary'}
              onClick={() => handleAspectRatioChange(ratio)}
              style={{ flex: '1 1 80px' }}
            >
              {ratio}
            </button>
          ))}
        </div>
      </Section>

      {/* Intro Sequence */}
      <IntroSection />

      {/* Co-op / Multiplayer */}
      <Section title="Co-op Session" icon={<Globe size={18} weight="duotone" />} defaultOpen={false}>
        <MultiplayerPanel />
      </Section>
    </div>
  );
}

/** Intro Sequence Settings Section */
function IntroSection() {
  const { 
    enabled, 
    sequenceId, 
    autoCapture, 
    isPlaying,
    randomSnapshotInterval,
    autoCaptures,
    setEnabled, 
    setSequenceId, 
    setAutoCapture,
    setRandomSnapshotInterval,
    clearAutoCaptures,
    downloadAutoCapture,
  } = useIntroStore();
  
  const isAvatarReady = useReactionStore((s) => s.isAvatarReady);
  const addToast = useToastStore((s) => s.addToast);
  
  const sequenceIds = introSequence.getSequenceIds();
  
  const handlePlayNow = async () => {
    if (!isAvatarReady) {
      addToast('Load an avatar first!', 'warning');
      return;
    }
    
    useIntroStore.getState().setPlaying(true);
    await introSequence.play(sequenceId);
    useIntroStore.getState().setPlaying(false);
  };
  
  return (
    <Section title="Sequence" icon={<FilmSlate size={18} weight="duotone" />} defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Enable Toggle */}
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            Play intro on avatar load
          </span>
        </label>
        
        {/* Sequence Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Intro Style
          </label>
          <select
            value={sequenceId}
            onChange={(e) => setSequenceId(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: 'var(--color-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          >
            {sequenceIds.map((id) => {
              const info = introSequence.getSequenceInfo(id);
              return (
                <option key={id} value={id}>
                  {info?.name || id} ({info?.duration}s)
                </option>
              );
            })}
          </select>
        </div>
        
        {/* Auto-Capture Toggle */}
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={autoCapture}
            onChange={(e) => setAutoCapture(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            Auto-capture at key moments
          </span>
        </label>
        
        {/* Random Snapshot Interval */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Random Auto-Snapshot ({randomSnapshotInterval === 0 ? 'Off' : `Every ${randomSnapshotInterval}s`})
          </label>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={randomSnapshotInterval}
            onChange={(e) => setRandomSnapshotInterval(parseInt(e.target.value))}
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>
        
        {/* Play Now Button */}
        <button
          onClick={handlePlayNow}
          disabled={!isAvatarReady || isPlaying}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: isPlaying 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'linear-gradient(135deg, rgba(0, 255, 214, 0.2), rgba(0, 200, 180, 0.15))',
            border: '1px solid rgba(0, 255, 214, 0.3)',
            color: '#00ffd6',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: isAvatarReady && !isPlaying ? 'pointer' : 'not-allowed',
            opacity: isAvatarReady ? 1 : 0.5,
          }}
        >
          {isPlaying ? <><FilmSlate size={16} weight="duotone" /> Playing...</> : <><Play size={16} weight="fill" /> Play Intro Now</>}
        </button>
        
        {/* Auto-Captured Gallery */}
        {autoCaptures.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.5rem' 
            }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                Auto-Captured ({autoCaptures.length})
              </span>
              <button
                onClick={clearAutoCaptures}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(255, 100, 100, 0.2)',
                  border: '1px solid rgba(255, 100, 100, 0.3)',
                  color: '#ff8888',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Clear All
              </button>
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              overflowX: 'auto',
              padding: '0.25rem 0',
            }}>
              {autoCaptures.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Capture ${i + 1}`}
                  onClick={() => downloadAutoCapture(i)}
                  style={{
                    width: '60px',
                    height: '60px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Click to download"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
