import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PublicSignIn } from '@zolexora/shop-sign-in';
import { useAuth } from '../context/AuthContext';
import { firebaseAuth } from '../utils/firebase';
import { config } from '../utils/runtime';

/** Sign in with a Zolexora account (auth service). */
export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : '/';
  if (user) return <Navigate to={from} replace />;
  return (
    <div style={{ padding: '40px 16px' }}>
      <PublicSignIn
        authUrl={config('AUTH_SERVICE_PUBLIC_URL')}
        turnstileSiteKey={config('TURNSTILE_SITE_KEY')}
        firebaseAuth={firebaseAuth}
        brand="Mahila Madel"
        accent="#B5445A"
        onSignedIn={() => navigate(from, { replace: true })}
      />
    </div>
  );
}
