'use client'

import { useActionState } from 'react'
import type { AuthActionState, SignInAction } from './types'

interface LoginPageProps {
  signInAction: SignInAction
  /** Link href for "Create account". Default: "/register" */
  registerHref?: string
  /** Link href for "Forgot password". Default: "/reset-password" */
  resetHref?: string
  /** Optional heading. Default: "Welcome back" */
  heading?: string
}

export function LoginPage({
  signInAction,
  registerHref = '/register',
  resetHref = '/reset-password',
  heading = 'Welcome back',
}: LoginPageProps) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    signInAction,
    {},
  )

  return (
    <div style={{ width: '100%', maxWidth: '24rem' }}>
      <div
        style={{
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-subtle, oklch(0.22 0.02 270))',
          backgroundColor: 'var(--color-card, oklch(0.13 0.02 270))',
          padding: '2rem',
        }}
      >
        {/* Heading */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--color-fg, oklch(0.96 0.01 270))',
              margin: 0,
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-muted, oklch(0.60 0.03 270))',
              marginTop: '0.25rem',
              marginBottom: 0,
            }}
          >
            Sign in to your App Suite account
          </p>
        </div>

        {/* Form */}
        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Email">
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
              style={inputStyle}
            />
          </Field>

          <Field label="Password">
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </Field>

          {state.error && <ErrorBanner message={state.error} />}

          <SubmitButton pending={pending}>
            {pending ? 'Signing in…' : 'Sign In'}
          </SubmitButton>
        </form>

        {/* Footer links */}
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <a href={resetHref} style={mutedLinkStyle}>Forgot password?</a>
          <a href={registerHref} style={brandLinkStyle}>Create account</a>
        </div>
      </div>
    </div>
  )
}

// ── Internal primitives ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-fg, oklch(0.96 0.01 270))',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        borderRadius: '0.5rem',
        border: '1px solid rgba(239,68,68,0.3)',
        backgroundColor: 'rgba(239,68,68,0.1)',
        padding: '0.5rem 0.75rem',
        fontSize: '0.75rem',
        color: 'rgb(248,113,113)',
      }}
    >
      {message}
    </div>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: '0.25rem',
        width: '100%',
        padding: '0.625rem 1rem',
        borderRadius: '0.5rem',
        border: 'none',
        backgroundColor: 'var(--color-brand, oklch(0.62 0.25 280))',
        color: '#fff',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {children}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--color-border-subtle, oklch(0.22 0.02 270))',
  backgroundColor: 'var(--color-card, oklch(0.13 0.02 270))',
  color: 'var(--color-fg, oklch(0.96 0.01 270))',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const mutedLinkStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-muted, oklch(0.60 0.03 270))',
  textDecoration: 'none',
}

const brandLinkStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-brand, oklch(0.62 0.25 280))',
  textDecoration: 'none',
}
