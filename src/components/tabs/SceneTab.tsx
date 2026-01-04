import { useState, useEffect, useRef } from 'react';
import { sceneManager } from '../../three/sceneManager';
import { backgroundOptions } from '../../three/backgrounds';
import { avatarManager } from '../../three/avatarManager';
import { useReactionStore } from '../../state/useReactionStore';
import { useToastStore } from '../../state/useToastStore';
import { useUIStore } from '../../state/useUIStore';
import { useSceneSettingsStore } from '../../state/useSceneSettingsStore';
import { LIGHT_PRESETS } from '../../three/lightingManager';
import { POST_PRESETS } from '../../three/postProcessingManager';
import { HDRI_PRESETS, environmentManager } from '../../three/environmentManager';
import { MATERIAL_PRESETS, materialManager } from '../../three/materialManager';
import type { BackgroundId } from '../../types/reactions';

type AspectRatio = '16:9' | '1:1' | '9:16';

// Collapsible Section Component
function Section({ 
  title, 
  icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: string; 
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
          background: 'rgba(17, 21, 32, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          color: '#e6f3ff',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{icon}</span>
          <span>{title}</span>
        </span>
        <span style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}>▼</span>
      </button>
      {isOpen && (
        <div style={{ 
          padding: '1rem',
          background: 'rgba(17, 21, 32, 0.3)',
          borderRadius: '0 0 8px 8px',
          marginTop: '-4px',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
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
        color: 'rgba(230, 243, 255, 0.7)'
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
          background: 'rgba(17, 21, 32, 0.8)',
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
  const { addToast } = useToastStore();
  const { activeCssOverlay, setActiveCssOverlay } = useUIStore();
  const sceneSettings = useSceneSettingsStore();
  
  const [selectedBackground, setSelectedBackground] = useState('midnight-circuit');
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isLoadingHdri, setIsLoadingHdri] = useState(false);
  
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const hdriInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentRatio = sceneManager.getAspectRatio();
    setAspectRatio(currentRatio);
  }, []);

  const handleVRMUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAvatarReady(false);
    try {
      await avatarManager.load(url);
      setAvatarReady(true);
      addToast('Avatar loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to load VRM:', error);
      addToast('Failed to load VRM file', 'error');
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
    if (backgroundId === 'custom' && customBackground) {
      await sceneManager.setBackground(customBackground);
    } else {
      await sceneManager.setBackground(backgroundId as BackgroundId);
    }
  };

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    sceneManager.setAspectRatio(ratio);
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

  return (
    <div className="tab-content" style={{ gap: '0.5rem' }}>
      {/* Avatar Section */}
      <Section title="Avatar" icon="🎭" defaultOpen={!isAvatarReady}>
        <p className="muted small">Load or change the VRM avatar</p>
        <button
          className={isAvatarReady ? 'secondary full-width' : 'primary full-width'}
          onClick={() => vrmInputRef.current?.click()}
        >
          {isAvatarReady ? '🔄 Change Avatar' : '📦 Load VRM Avatar'}
        </button>
        
        {isAvatarReady && (
          <button
            className="secondary full-width"
            onClick={() => {
              const vrm = avatarManager.getVRM();
              if (vrm) sceneManager.frameObject(vrm.scene);
            }}
            style={{ marginTop: '0.5rem' }}
          >
            🔍 Fit Avatar to Screen
          </button>
        )}
        
        <input
          ref={vrmInputRef}
          type="file"
          accept=".vrm"
          onChange={handleVRMUpload}
          style={{ display: 'none' }}
        />
      </Section>

      {/* Lighting Section */}
      <Section title="Lighting" icon="💡" defaultOpen={false}>
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
      <Section title="Toon Shader" icon="🎨" defaultOpen={false}>
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
            🔍 Debug Materials (Console)
          </button>
        </div>
      </Section>

      {/* Post-Processing Section */}
      <Section title="Effects" icon="✨" defaultOpen={false}>
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
      <Section title="Environment" icon="🌍" defaultOpen={false}>
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
          📤 Upload Custom HDR
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
      <Section title="Backgrounds" icon="🎨" defaultOpen={true}>
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
              {!customBackground && <span style={{ fontSize: '1.5rem' }}>➕</span>}
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
          📤 Upload Background
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
      <Section title="FX Overlays" icon="🎞️" defaultOpen={false}>
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
      <Section title="Aspect Ratio" icon="📐" defaultOpen={false}>
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
    </div>
  );
}
