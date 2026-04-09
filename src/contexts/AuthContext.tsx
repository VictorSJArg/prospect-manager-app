import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, processRedirectResult } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  redirectError: string | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, redirectError: null });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    // Procesar resultado de redirect primero antes de suscribir al estado
    const init = async () => {
      const err = await processRedirectResult();
      if (err) setRedirectError(err);

      // Suscribir DESPUÉS de procesar redirect
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });

      return unsubscribe;
    };

    let cleanup: (() => void) | undefined;
    init().then(unsub => { cleanup = unsub; });
    return () => { if (cleanup) cleanup(); };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, redirectError }}>
      {loading ? (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-secondary text-sm">Verificando sesión...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
