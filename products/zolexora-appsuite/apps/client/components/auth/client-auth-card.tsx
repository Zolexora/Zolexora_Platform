'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZolexoraAuthCard, type ZolexoraAuthSession, type AuthMode } from '@zolexora/user-auth-firebase'

interface ClientAuthCardProps {
  initialMode?: AuthMode
}

export function ClientAuthCard({ initialMode = 'select' }: ClientAuthCardProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const handleSuccess = async (session: ZolexoraAuthSession) => {
    setSyncing(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: session.token,
          user: session.user,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to establish AppSuite session.')
      }

      // Hard redirect to dashboard to ensure fresh server session evaluation
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setSyncing(false)
      setError(err instanceof Error ? err.message : 'Authentication synchronization error')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-[#404040] bg-[#080C14] text-xs text-[#CBD5E1]">
          {error}
        </div>
      )}
      {syncing && (
        <div className="mb-4 p-3 rounded-lg border border-[#CBD5E1]/30 bg-[#0B1F3A] text-xs text-white text-center animate-pulse">
          Establishing secure AppSuite session...
        </div>
      )}
      <ZolexoraAuthCard
        brandName="Zolexora AppSuite"
        brandTagline="Commission Custom Software from Zolexora"
        theme="dark"
        initialMode={initialMode}
        requiresOrg={false}
        allowGoogle={true}
        allowPhone={true}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
