import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';
import { initializeUserDataSync, setStorageScopeUser } from '../services/storage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setStorageScopeUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setStorageScopeUser(nextUser?.uid ?? null);
      setLoading(false);

      // Do not block auth readiness on Firestore sync failures.
      if (nextUser?.uid) {
        void initializeUserDataSync(nextUser.uid).catch((error) => {
          console.error('Failed to initialize user data sync:', error);
        });
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: isFirebaseConfigured,
    async login(email: string, password: string) {
      if (!auth) throw new Error('Firebase is not configured.');
      await signInWithEmailAndPassword(auth, email, password);
    },
    async register(email: string, password: string) {
      if (!auth) throw new Error('Firebase is not configured.');
      await createUserWithEmailAndPassword(auth, email, password);
    },
    async loginWithGoogle() {
      if (!auth) throw new Error('Firebase is not configured.');
      await signInWithPopup(auth, googleProvider);
    },
    async resetPassword(email: string) {
      if (!auth) throw new Error('Firebase is not configured.');
      await sendPasswordResetEmail(auth, email);
    },
    async logout() {
      if (!auth) return;
      await signOut(auth);
      setStorageScopeUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider.');
  return ctx;
}
