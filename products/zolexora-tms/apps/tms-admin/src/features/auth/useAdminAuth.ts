import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, webAuth } from '../../lib/firebase';

export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await webAuth.signInWithEmail(auth, email, password);
    } catch (e: any) {
      setError(e.message ?? 'Sign-in failed');
      throw e;
    }
  };

  const signOut = async () => {
    await webAuth.signOut(auth);
  };

  return { user, isLoading, error, signIn, signOut };
}
