import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  import('./App.tsx').then(({ default: App }) => {
    import('./components/ErrorBoundary').then(({ ErrorBoundary }) => {
      const root = createRoot(rootElement);
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>,
      );
    });
  }).catch((error) => {
    console.error('[ESTUDIO MARIA FILOMENA NORIEGA] Fatal error during app initialization:', error);
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;padding:2rem;">
        <div style="max-width:500px;text-align:center;">
          <h1 style="color:#ba1a1a;font-size:1.5rem;margin-bottom:1rem;">Error al iniciar la aplicación</h1>
          <p style="color:#444;margin-bottom:1rem;">Se produjo un error durante la carga:</p>
          <pre style="background:#f5f5f5;padding:1rem;border-radius:8px;text-align:left;overflow:auto;font-size:0.8rem;color:#333;">${error instanceof Error ? error.message : String(error)}</pre>
          <button onclick="window.location.reload()" style="margin-top:1rem;padding:0.75rem 2rem;background:#000666;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Recargar</button>
        </div>
      </div>
    `;
  });
}
