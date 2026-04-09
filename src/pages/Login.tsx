import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, redirectError } = useAuth();

  // Si ya está autenticado, ir al dashboard
  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  // Mostrar error de redirect si existe (diagnóstico)
  useEffect(() => {
    if (redirectError) {
      setError('Error al retornar desde Google: ' + redirectError);
    }
  }, [redirectError]);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      // Si llegamos aquí, fue por popup (que ya autenticó)
      // El useEffect de user se encargará del redirect
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/popup-blocked') {
        setError('Ventana de Google bloqueada. Permite ventanas emergentes en tu navegador e intenta de nuevo.');
      } else if (code === 'auth/unauthorized-domain') {
        setError('Dominio no autorizado. Contacta al administrador del sistema.');
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Cerraste la ventana de Google antes de completar el inicio de sesión.');
      } else {
        setError('Error [' + code + ']: ' + (err.message || 'Inténtalo de nuevo.'));
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="material-symbols-outlined text-4xl text-primary">gavel</span>
          <h1 className="text-2xl font-bold tracking-[0.15em] text-primary">ESTUDIO MARIA FILOMENA NORIEGA</h1>
        </div>
        <p className="text-on-surface-variant mb-8">
          Administración central de expedientes y prospectos legales.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-error-container text-on-error-container text-sm rounded-lg text-left break-words">
            <strong>⚠️ Error:</strong> {error}
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

        <p className="text-xs text-outline mt-4">
          Si el botón no responde, asegúrate de que las ventanas emergentes estén permitidas para este sitio.
        </p>
      </div>
    </div>
  );
}
