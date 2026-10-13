import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'DevTeam Panel | Zolexora App Suite',
    template: '%s | DevTeam Panel',
  },
  description: 'Internal operations, request review, and contract dispatch console for Zolexora engineering team.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-surface-dark)] text-[var(--color-text-primary)] min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
