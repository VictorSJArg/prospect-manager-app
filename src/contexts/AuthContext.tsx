import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, processRedirectResult, db } from '../firebase';

export interface UserData {
  previousLogin: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  redirectError: string | null;
  userData: UserData | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, redirectError: null, userData: null });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    // Procesar resultado de redirect primero antes de suscribir al estado
    const init = async () => {
      const err = await processRedirectResult();
      if (err) setRedirectError(err);

      // Suscribir DESPUÉS de procesar redirect
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
           try {
             const userRef = doc(db, 'users', firebaseUser.uid);
             const snap = await getDoc(userRef);
             const now = new Date();
             let prevTime = now.getTime();
             
             if (!snap.exists()) {
               await setDoc(userRef, { lastLogin: now, previousLogin: now });
               setUserData({ previousLogin: prevTime });
             } else {
               const data = snap.data();
               const val = data.lastLogin;
               // Get time securely
               const lastLoginTime = val ? (val.toDate ? val.toDate().getTime() : new Date(val).getTime()) : 0;
               // 5 minutes of inactivity means session resets
               if (now.getTime() - lastLoginTime > 5 * 60 * 1000) {
                 await updateDoc(userRef, { previousLogin: val, lastLogin: now });
                 prevTime = lastLoginTime;
               } else {
                 await updateDoc(userRef, { lastLogin: now });
                 const pVal = data.previousLogin;
                 prevTime = pVal ? (pVal.toDate ? pVal.toDate().getTime() : new Date(pVal).getTime()) : lastLoginTime;
               }
               setUserData({ previousLogin: prevTime });
             }
           } catch (dbErr) {
             console.error("Error managing user session data:", dbErr);
             setUserData({ previousLogin: 0 }); // Fallback
           }
        } else {
           setUserData(null);
        }
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
    <AuthContext.Provider value={{ user, loading, redirectError, userData }}>
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
