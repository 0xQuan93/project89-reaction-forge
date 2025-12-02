import { useState } from 'react';
import './App.css';
import { AppHeader } from './components/AppHeader';
import { CanvasStage } from './components/CanvasStage';
import { ViewportOverlay } from './components/ViewportOverlay';
import { ControlPanel } from './components/ControlPanel';

function App() {
  const [mode, setMode] = useState<'reactions' | 'poselab'>('reactions');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  console.log('[App] Rendering App component, mode:', mode);

  return (
    <div className="app-shell">
      <AppHeader mode={mode} onModeChange={setMode} />
      
      <main className="layout">
        <section className="viewport">
          <CanvasStage />
          <ViewportOverlay mode={mode} />
        </section>

        <ControlPanel mode={mode} />
      </main>

      {/* Mobile drawer toggle */}
      <button
        className="control-toggle"
        onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
      >
        {mobileDrawerOpen ? 'Close' : 'Controls'}
      </button>

      {/* Mobile drawer */}
      <div className={`control-drawer ${mobileDrawerOpen ? 'open' : ''}`}>
        <ControlPanel mode={mode} />
      </div>
    </div>
  );
}

export default App;
