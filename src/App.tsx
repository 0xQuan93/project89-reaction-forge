import './App.css';
import './components/overlays.css';
import { useState, useEffect } from 'react';
import { AppHeader } from './components/AppHeader';
import { CanvasStage } from './components/CanvasStage';
import { ViewportOverlay } from './components/ViewportOverlay';
import { ControlPanel } from './components/ControlPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastHost } from './ui/Toast';
import { useUIStore } from './state/useUIStore';
import { useSettingsStore } from './state/useSettingsStore';
import { projectManager } from './persistence/projectManager';
import { autosaveManager } from './persistence/autosaveManager';
import { initAvatarBridge } from './multiplayer/avatarBridge';
import { ConnectionProgressPanel } from './components/ConnectionProgressPanel';
import { AIAgentWidget } from './components/AIAgentWidget';
import { SessionHUD } from './components/SessionHUD';

// import { LobbyPanel } from './components/LobbyPanel';

// Initialize multiplayer avatar bridge on app startup
initAvatarBridge();

function App() {
  const { mode, setMode, mobileDrawerOpen, setMobileDrawerOpen } = useUIStore();
  const { theme, locale, textScale, autosaveEnabled, autosaveIntervalMinutes, autosaveMaxEntries } = useSettingsStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 960);

  useEffect(() => {
    // Apply theme to HTML element
    const root = document.documentElement;
    if (theme !== 'system') {
      root.setAttribute('data-theme', theme);
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => {
      root.setAttribute('data-theme', mediaQuery.matches ? 'light' : 'dark');
    };

    applyTheme();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }

    mediaQuery.addListener(applyTheme);
    return () => mediaQuery.removeListener(applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const baseSize = 16;
    document.documentElement.style.fontSize = `${baseSize * textScale}px`;
  }, [textScale]);

  useEffect(() => {
    if (!autosaveEnabled) return undefined;
    const intervalMs = autosaveIntervalMinutes * 60 * 1000;
    if (intervalMs <= 0) return undefined;

    const saveSnapshot = () => {
      const project = projectManager.serializeProject('Autosave');
      autosaveManager.addAutosave(project, autosaveMaxEntries);
    };

    saveSnapshot();
    const intervalId = window.setInterval(saveSnapshot, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [autosaveEnabled, autosaveIntervalMinutes, autosaveMaxEntries]);

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
          <ErrorBoundary>
            <CanvasStage />
            <ViewportOverlay mode={mode} />
          </ErrorBoundary>
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
      <ConnectionProgressPanel />
      <AIAgentWidget />
      <SessionHUD />
      {/* <LobbyPanel /> */}
    </div>
  );
}

export default App;
