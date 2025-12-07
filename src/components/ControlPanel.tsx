import { useState } from 'react';
import { PresetsTab } from './tabs/PresetsTab';
import { PoseExpressionTab } from './tabs/PoseExpressionTab';
import { SceneTab } from './tabs/SceneTab';
import { ExportTab } from './tabs/ExportTab';
import { AnimationsTab } from './tabs/AnimationsTab';
import { PosesTab } from './tabs/PosesTab';
import { AIGeneratorTab } from './tabs/AIGeneratorTab';
import { TimelineTab } from './tabs/TimelineTab';

interface ControlPanelProps {
  mode: 'reactions' | 'poselab';
}

type ReactionTab = 'presets' | 'pose' | 'scene' | 'export';
type PoseLabTab = 'animations' | 'poses' | 'ai' | 'timeline' | 'export';

export function ControlPanel({ mode }: ControlPanelProps) {
  const [reactionTab, setReactionTab] = useState<ReactionTab>('presets');
  const [poseLabTab, setPoseLabTab] = useState<PoseLabTab>('animations');

  if (mode === 'reactions') {
    return (
      <aside className="control-panel">
        <div className="control-panel__tabs">
          <button
            className={reactionTab === 'presets' ? 'active' : ''}
            onClick={() => setReactionTab('presets')}
          >
            Presets
          </button>
          <button
            className={reactionTab === 'pose' ? 'active' : ''}
            onClick={() => setReactionTab('pose')}
          >
            Pose & Expression
          </button>
          <button
            className={reactionTab === 'scene' ? 'active' : ''}
            onClick={() => setReactionTab('scene')}
          >
            Scene
          </button>
          <button
            className={reactionTab === 'export' ? 'active' : ''}
            onClick={() => setReactionTab('export')}
          >
            Export
          </button>
        </div>

        <div className="control-panel__content">
          {reactionTab === 'presets' && <PresetsTab />}
          {reactionTab === 'pose' && <PoseExpressionTab />}
          {reactionTab === 'scene' && <SceneTab />}
          {reactionTab === 'export' && <ExportTab />}
        </div>
      </aside>
    );
  }

  // Pose Lab mode
  return (
    <aside className="control-panel">
      <div className="control-panel__tabs">
        <button
          className={poseLabTab === 'animations' ? 'active' : ''}
          onClick={() => setPoseLabTab('animations')}
        >
          Animations
        </button>
        <button
          className={poseLabTab === 'poses' ? 'active' : ''}
          onClick={() => setPoseLabTab('poses')}
        >
          Poses
        </button>
        <button
          className={poseLabTab === 'ai' ? 'active' : ''}
          onClick={() => setPoseLabTab('ai')}
        >
          AI Gen
        </button>
        <button
          className={poseLabTab === 'timeline' ? 'active' : ''}
          onClick={() => setPoseLabTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={poseLabTab === 'export' ? 'active' : ''}
          onClick={() => setPoseLabTab('export')}
        >
          Export
        </button>
      </div>

      <div className="control-panel__content">
        {poseLabTab === 'animations' && <AnimationsTab />}
        {poseLabTab === 'poses' && <PosesTab />}
        {poseLabTab === 'ai' && <AIGeneratorTab />}
        {poseLabTab === 'timeline' && <TimelineTab />}
        {poseLabTab === 'export' && <ExportTab mode="poselab" />}
      </div>
    </aside>
  );
}

