import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, webAuth } from '../../lib/firebase';
import { Loader2 } from 'lucide-react';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there was a redirect result from Google OAuth
    webAuth.getGoogleRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        // Continue to state observer
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/authentication', { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Completing authentication...</span>
      </div>
    </div>
  );
}
