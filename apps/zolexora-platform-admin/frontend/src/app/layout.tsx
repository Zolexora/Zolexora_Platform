import './globals.css';
import AuthGate from '@/components/AuthGate';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zolexora Command Center | Platform Admin',
  description: 'Centralized Fleet & Multi-Tenant Infrastructure Control Plane',
};

// Read sign-in config per request (from the Infisical-injected container env), not at build time,
// so one image works in every environment.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        <AuthGate
          authUrl={process.env.AUTH_SERVICE_PUBLIC_URL ?? ''}
          turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ''}
        >
          {children}
        </AuthGate>
      </body>
    </html>
  );
}
