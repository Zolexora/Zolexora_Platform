'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Check your email
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            We&apos;ve sent a confirmation link to{' '}
            <strong className="text-[var(--color-text-primary)]">{email}</strong>.
            Click the link to activate your account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex text-sm text-[var(--color-brand-primary)] hover:underline"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Create your account
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Start commissioning your custom application
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Work Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-1">
            Create Account
          </Button>
        </form>

        <p className="mt-4 text-xs text-center text-[var(--color-text-muted)]">
          By registering you agree to our{' '}
          <Link
            href="#"
            className="text-[var(--color-brand-primary)] hover:underline"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="#"
            className="text-[var(--color-brand-primary)] hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-[var(--color-brand-primary)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
