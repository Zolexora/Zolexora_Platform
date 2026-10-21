import './globals.css';
import Header from '@/components/Header';
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
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
          Zolexora Platform Admin Control Plane • Port 3082 • Next.js 14 App Router
        </footer>
      </body>
    </html>
  );
}
