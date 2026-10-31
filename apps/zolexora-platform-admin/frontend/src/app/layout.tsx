import './globals.css';
import AppShell from '@/components/AppShell';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zolexora Command Center | Platform Admin',
  description: 'Centralized Fleet & Multi-Tenant Infrastructure Control Plane',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
