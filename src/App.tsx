import { useState } from 'react';
import './App.css';
import { AppHeader } from './components/AppHeader';
import { CanvasStage } from './components/CanvasStage';
import { ViewportOverlay } from './components/ViewportOverlay';
import { ControlPanel } from './components/ControlPanel';
import { ToastHost } from './ui/Toast';
import { useUIStore } from './state/useUIStore';

function App() {
  const { mode, setMode, mobileDrawerOpen, setMobileDrawerOpen } = useUIStore();

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

      {/* Mobile Backdrop */}
      {mobileDrawerOpen && (
        <div 
          className="drawer-backdrop" 
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`control-drawer ${mobileDrawerOpen ? 'open' : ''}`}>
        <ControlPanel mode={mode} />
      </div>

      <ToastHost />
    </div>
  );
}

export default App;
