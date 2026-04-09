import React, { useState } from 'react';
import { signInWithGoogle } from '../firebase';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    
    // Timeout de seguridad de 15 segundos
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('Tiempo de espera agotado. Revisa si la ventana de Google quedó oculta detrás de esta.');
    }, 15000);

    try {
      await signInWithGoogle();
      clearTimeout(timeoutId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setError('Cancelaste el inicio de sesión o la ventana se cerró.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Tu navegador bloqueó la ventana de Google. Por favor, desactiva tu bloqueador de anuncios o permite ventanas emergentes.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Firebase bloqueó el acceso. Asegúrate de haber agregado este dominio a Firebase.');
      } else {
        setError('Error: ' + (err.message || 'Inténtalo de nuevo.'));
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] max-w-md w-full text-center relative">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="material-symbols-outlined text-4xl text-primary">gavel</span>
          <h1 className="text-2xl font-bold tracking-[0.15em] text-primary">ESTUDIO MARIA FILOMENA NORIEGA</h1>
        </div>
        <p className="text-on-surface-variant mb-8">
          Administración central de expedientes y prospectos legales.
        </p>
        
        {error && (
          <div className="mb-6 p-3 bg-error-container text-on-error-container text-sm rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 signature-gradient text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-3 disabled:opacity-70"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
          )}
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}
        </button>
      </div>
    </div>
  );
}
