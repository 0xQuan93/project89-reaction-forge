import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PoseLab from './pose-lab/PoseLab'
import { setupAvatarBridge } from './bridge/avatarBridge'

console.log('[main] Starting Project 89 Reaction Forge');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[main] Root element not found!');
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

const render = () => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  console.log('[main] Render mode:', mode || 'main-app');

  root.render(
    <StrictMode>
      {mode === 'pose-lab' ? <PoseLab /> : <App />}
    </StrictMode>
  );
};

setupAvatarBridge();
render();
