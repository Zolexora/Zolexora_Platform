import { useState, FormEvent } from 'react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { useAdminAuth } from './useAdminAuth';

export function LoginPage() {
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      const msg: string = err.message ?? '';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setError('Invalid email or password.');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(msg || 'Sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-black px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Zolexora TMS" className="h-14 w-14 rounded-2xl object-contain" />
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-white">Zolexora TMS</h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-silver-600 mt-0.5">Platform Admin</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-silver-900/60 bg-brand-near/60 p-8 shadow-xl backdrop-blur">
          <h2 className="mb-1 text-base font-semibold text-white">Sign in to Admin Panel</h2>
          <p className="mb-6 text-xs text-silver-500">Platform administrators only.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-silver-400">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-silver-800 bg-brand-black px-3.5 py-2.5 text-sm text-white placeholder-silver-700 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
                placeholder="admin@zolexora.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-silver-400">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-silver-800 bg-brand-black px-3.5 py-2.5 text-sm text-white placeholder-silver-700 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-silver-800 bg-silver-900/40 px-3 py-2.5 text-xs text-silver-300">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-silver-400" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-60 transition"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-silver-700">
          Zolexora Platform · Admin Portal
        </p>
      </div>
    </div>
  );
}
