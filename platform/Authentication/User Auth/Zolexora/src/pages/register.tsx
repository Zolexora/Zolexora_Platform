'use client'

import { useActionState } from 'react'
import type { AuthActionState, SignUpAction, VerifyOtpAction } from './types'
import { ErrorBanner } from './login'

interface RegisterPageProps {
  signUpAction: SignUpAction
  verifyOtpAction?: VerifyOtpAction
  /** Link href for "Sign in". Default: "/login" */
  loginHref?: string
  /** Minimum password length hint shown to users. Default: 12 */
  minPasswordLength?: number
}

export function RegisterPage({
  signUpAction,
  verifyOtpAction,
  loginHref = '/login',
  minPasswordLength = 12,
}: RegisterPageProps) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    signUpAction,
    {},
  )

  const [otpState, otpFormAction, otpPending] = useActionState<AuthActionState, FormData>(
    verifyOtpAction || (async () => ({})),
    {},
  )

  // Success — show OTP code verification screen
  if (state.success || otpState.email) {
    const targetEmail = state.email || otpState.email

    if (otpState.success) {
      return (
        <div style={{ width: '100%', maxWidth: '24rem' }}>
          <div style={cardStyle}>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  border: '1px solid rgba(74,222,128,0.2)',
                  backgroundColor: 'rgba(74,222,128,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <svg width="24" height="24" fill="none" stroke="rgb(74,222,128)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-fg, oklch(0.96 0.01 270))', margin: '0 0 0.5rem' }}>
                Email Verified!
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted, oklch(0.60 0.03 270))', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                Your account is now activated. You can sign in immediately.
              </p>
              <a
                href={loginHref}
                style={{
                  display: 'inline-block',
                  padding: '0.625rem 1.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--color-brand, oklch(0.62 0.25 280))',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Continue to Sign In →
              </a>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ width: '100%', maxWidth: '24rem' }}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--color-fg, oklch(0.96 0.01 270))',
                margin: '0 0 0.5rem',
              }}
            >
              Verify Your Email
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-muted, oklch(0.60 0.03 270))',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              We sent a 6-digit OTP and verification link to{' '}
              <strong style={{ color: 'var(--color-fg, oklch(0.96 0.01 270))' }}>
                {targetEmail}
              </strong>
            </p>
          </div>

          {verifyOtpAction && (
            <form action={otpFormAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="hidden" name="email" value={targetEmail} />
              
              <Field label="Enter 6-digit OTP code">
                <input
                  name="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  style={{
                    ...inputStyle,
                    fontSize: '1.5rem',
                    textAlign: 'center',
                    letterSpacing: '0.5rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                />
              </Field>

              {otpState.error && <ErrorBanner message={otpState.error} />}

              <button
                type="submit"
                disabled={otpPending}
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
                  cursor: otpPending ? 'not-allowed' : 'pointer',
                  opacity: otpPending ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {otpPending ? 'Verifying OTP…' : 'Verify & Activate'}
              </button>
            </form>
          )}

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted, oklch(0.60 0.03 270))', marginBottom: '0.75rem' }}>
              Didn&apos;t get the email? Check your spam folder or click the magic link directly in the email.
            </p>
            <a
              href={loginHref}
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-brand, oklch(0.62 0.25 280))',
                textDecoration: 'none',
              }}
            >
              ← Back to Sign In
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: '24rem' }}>
      <div style={cardStyle}>
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
            Create your account
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-muted, oklch(0.60 0.03 270))',
              marginTop: '0.25rem',
              marginBottom: 0,
            }}
          >
            Start commissioning your custom application
          </p>
        </div>

        {/* Form */}
        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Work Email">
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
              style={inputStyle}
            />
          </Field>

          <Field label={`Password (min. ${minPasswordLength} characters)`}>
            <input
              name="password"
              type="password"
              placeholder="••••••••••••"
              required
              minLength={minPasswordLength}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>

          <Field label="Confirm Password">
            <input
              name="confirm"
              type="password"
              placeholder="••••••••••••"
              required
              minLength={minPasswordLength}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>

          {state.error && <ErrorBanner message={state.error} />}

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
            {pending ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        {/* Terms */}
        <p
          style={{
            marginTop: '1rem',
            fontSize: '0.75rem',
            textAlign: 'center',
            color: 'var(--color-muted, oklch(0.60 0.03 270))',
          }}
        >
          By registering you agree to our Terms of Service and Privacy Policy.
        </p>

        {/* Sign in link */}
        <p
          style={{
            marginTop: '1rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--color-muted, oklch(0.60 0.03 270))',
          }}
        >
          Already have an account?{' '}
          <a
            href={loginHref}
            style={{ color: 'var(--color-brand, oklch(0.62 0.25 280))', textDecoration: 'none' }}
          >
            Sign in
          </a>
        </p>
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

const cardStyle: React.CSSProperties = {
  borderRadius: '0.75rem',
  border: '1px solid var(--color-border-subtle, oklch(0.22 0.02 270))',
  backgroundColor: 'var(--color-card, oklch(0.13 0.02 270))',
  padding: '2rem',
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
