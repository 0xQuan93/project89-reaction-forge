import type { ReactionPreset } from '../types/reactions';

export const reactionPresets: ReactionPreset[] = [
  {
    id: 'dawn-runner',
    label: 'Dawn Runner',
    description: 'Dynamic action pose for reconnaissance briefs.',
    pose: 'dawn-runner',
    expression: 'calm',
    background: 'protocol-dawn',
  },
  {
    id: 'sunset-call',
    label: 'Sunset Call',
    description: 'Confident standing pose for incoming intel.',
    pose: 'sunset-call',
    expression: 'surprise',
    background: 'protocol-sunset',
  },
  {
    id: 'cipher-whisper',
    label: 'Cipher Whisper',
    description: 'Thoughtful sitting pose for strategic planning.',
    pose: 'cipher-whisper',
    expression: 'calm',
    background: 'midnight-circuit',
  },
  {
    id: 'nebula-drift',
    label: 'Nebula Drift',
    description: 'Fluid locomotion for meditative uplinks.',
    pose: 'nebula-drift',
    expression: 'joy',
    background: 'cyber-waves',
  },
  {
    id: 'signal-reverie',
    label: 'Signal Reverie',
    description: 'Crouching stance with focused energy.',
    pose: 'signal-reverie',
    expression: 'surprise',
    background: 'signal-breach',
  },
  {
    id: 'typing',
    label: 'Typing',
    description: 'Focused data entry for intelligence processing.',
    pose: 'typing',
    expression: 'calm',
    background: 'neural-grid',
  },
  {
    id: 'agent-taunt',
    label: 'Agent Taunt',
    description: 'Playful provocation for psychological operations.',
    pose: 'agent-taunt',
    expression: 'joy',
    background: 'quantum-field',
  },
  {
    id: 'agent-dance',
    label: 'Agent Dance',
    description: 'Celebratory moves for mission success.',
    pose: 'agent-dance',
    expression: 'joy',
    background: 'green-loom-matrix',
  },
];

const defaultPreset = reactionPresets[0];

export function pickPresetForName(name: string): ReactionPreset {
  if (!name) return defaultPreset;
  const normalized = name.trim().toLowerCase();
  const hit = reactionPresets.find((preset) => normalized.includes(preset.id.replace('-', ' ')));
  if (hit) return hit;
  const hash = normalized
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return reactionPresets[hash % reactionPresets.length];
}

export function randomPreset(): ReactionPreset {
  const index = Math.floor(Math.random() * reactionPresets.length);
  return reactionPresets[index];
}

export function findPresetById(id: string): ReactionPreset | undefined {
  return reactionPresets.find((preset) => preset.id === id);
}

export { defaultPreset };

