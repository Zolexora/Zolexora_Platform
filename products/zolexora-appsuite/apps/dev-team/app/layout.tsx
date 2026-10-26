import type { Metadata } from 'next'
import './globals.css'
import { TeamAuthProvider } from '@/components/providers/auth-provider'

export const metadata: Metadata = {
  title: {
    default: 'DevTeam Panel | Zolexora AppSuite',
    template: '%s | DevTeam Panel',
  },
  description: 'Internal operations, request review, and contract dispatch console for Zolexora engineering team.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-surface-dark)] text-[var(--color-text-primary)] min-h-screen antialiased">
        <TeamAuthProvider>
          {children}
        </TeamAuthProvider>
      </body>
    </html>
  )
}
