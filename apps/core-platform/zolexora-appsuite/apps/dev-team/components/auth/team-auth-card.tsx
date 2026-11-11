'use client'

import { useState } from 'react'
import { ZolexoraAuthCard, type ZolexoraAuthSession } from '@zolexora/user-auth-firebase'

export function TeamAuthCard() {
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
        throw new Error(data.error || 'Failed to authenticate team session.')
      }

      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setSyncing(false)
      setError(err instanceof Error ? err.message : 'Team authentication error')
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
          Authenticating engineer credentials...
        </div>
      )}
      <ZolexoraAuthCard
        brandName="Zolexora AppSuite"
        brandTagline="Internal Staff & Engineering Console"
        theme="dark"
        initialMode="email_login"
        requiresOrg={false}
        allowGoogle={true}
        allowPhone={true}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
