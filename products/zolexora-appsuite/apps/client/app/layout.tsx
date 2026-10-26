import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppAuthProvider } from '@/components/providers/auth-provider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Zolexora AppSuite',
    template: '%s | Zolexora AppSuite',
  },
  description:
    'Commission custom software applications built by the Zolexora development team. Describe your idea, we build it.',
  keywords: ['custom software', 'app development', 'Zolexora', 'on-demand apps'],
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-[var(--font-geist-sans)] bg-[var(--color-surface-dark)] text-[var(--color-text-primary)] min-h-screen">
        <AppAuthProvider>
          {children}
        </AppAuthProvider>
      </body>
    </html>
  )
}
