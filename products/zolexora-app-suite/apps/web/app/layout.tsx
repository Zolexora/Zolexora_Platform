import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

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
    default: 'Zolexora App Suite',
    template: '%s | Zolexora App Suite',
  },
  description:
    'Commission custom software applications built by the Zolexora development team. Describe your idea, we build it.',
  keywords: ['custom software', 'app development', 'Zolexora', 'on-demand apps'],
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
        {children}
      </body>
    </html>
  )
}
