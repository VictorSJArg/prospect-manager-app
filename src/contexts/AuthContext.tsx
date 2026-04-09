import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, processRedirectResult } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      // Primero procesamos el resultado del redirect (si viene de Google)
      // Esto actualiza auth.currentUser internamente antes de que
      // onAuthStateChanged lo detecte
      try {
        await processRedirectResult();
      } catch (err) {
        console.error('Redirect result error:', err);
      }

      // Ahora escuchamos los cambios de auth (ya tiene el usuario actualizado)
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
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
