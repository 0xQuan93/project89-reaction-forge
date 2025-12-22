import './App.css';
import './components/overlays.css';
import { useState, useEffect } from 'react';
import { AppHeader } from './components/AppHeader';
import { CanvasStage } from './components/CanvasStage';
import { ViewportOverlay } from './components/ViewportOverlay';
import { ControlPanel } from './components/ControlPanel';
import { ToastHost } from './ui/Toast';
import { useUIStore } from './state/useUIStore';

function App() {
  const { mode, setMode, mobileDrawerOpen, setMobileDrawerOpen } = useUIStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 960);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 960);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-shell">
      <AppHeader mode={mode} onModeChange={setMode} />
      
      <main className="layout">
        <section className="viewport">
          <CanvasStage />
          <ViewportOverlay mode={mode} />
        </section>

        {!isMobile && <ControlPanel mode={mode} />}
      </main>

      {/* Mobile drawer toggle */}
      {isMobile && (
        <button
          className="control-toggle"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        >
          {mobileDrawerOpen ? 'Close' : 'Controls'}
        </button>
      )}

      {/* Mobile Backdrop */}
      {isMobile && mobileDrawerOpen && (
        <div 
          className="drawer-backdrop" 
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <div className={`control-drawer ${mobileDrawerOpen ? 'open' : ''}`}>
          <ControlPanel mode={mode} />
        </div>
      )}

      <ToastHost />
    </div>
  );
}

export default App;
