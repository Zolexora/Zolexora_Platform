'use client'

export type VerifyEmailStatus = 'success' | 'error' | 'missing'

interface VerifyEmailViewProps {
  status: VerifyEmailStatus
  error?: string
  /** Link href for "Sign in". Default: "/login" */
  loginHref?: string
}

/**
 * VerifyEmailView — pure UI component.
 * The consuming app's server page calls auth.verifyEmail(token) and
 * passes the resulting status as a prop.
 *
 * @example
 * // app/(auth)/verify-email/page.tsx
 * import { VerifyEmailView } from '@zolexora/user-auth-zolexora/pages'
 * import { getZolexoraAuth } from '@/lib/auth'
 *
 * export default async function Page({ searchParams }) {
 *   const { token } = await searchParams
 *   if (!token) return <VerifyEmailView status="missing" />
 *   try {
 *     await getZolexoraAuth().verifyEmail(token as string)
 *     return <VerifyEmailView status="success" />
 *   } catch (err) {
 *     return <VerifyEmailView status="error" error={err instanceof Error ? err.message : undefined} />
 *   }
 * }
 */
export function VerifyEmailView({
  status,
  error,
  loginHref = '/login',
}: VerifyEmailViewProps) {
  const isSuccess = status === 'success'
  const isError = status === 'error' || status === 'missing'

  return (
    <div style={{ width: '100%', maxWidth: '24rem' }}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          {/* Icon */}
          <div
            style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '50%',
              border: `1px solid ${isSuccess ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
              backgroundColor: isSuccess ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            {isSuccess ? (
              <svg width="28" height="28" fill="none" stroke="rgb(74,222,128)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="28" height="28" fill="none" stroke="rgb(248,113,113)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--color-fg, oklch(0.96 0.01 270))',
              margin: '0 0 0.5rem',
            }}
          >
            {isSuccess ? 'Email verified!' : status === 'missing' ? 'Invalid link' : 'Verification failed'}
          </h1>

          {/* Body */}
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-muted, oklch(0.60 0.03 270))',
              margin: '0 0 1.5rem',
              lineHeight: 1.6,
            }}
          >
            {isSuccess
              ? 'Your email has been verified. You can now sign in to your account.'
              : status === 'missing'
              ? 'No verification token was found in the link. Please use the link from the email we sent you.'
              : (error ?? 'This verification link is invalid or has expired. Please request a new one.')}
          </p>

          {/* CTA */}
          <a
            href={loginHref}
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.5rem',
              borderRadius: '0.5rem',
              backgroundColor: isSuccess
                ? 'var(--color-brand, oklch(0.62 0.25 280))'
                : 'transparent',
              border: isSuccess
                ? 'none'
                : '1px solid var(--color-border-subtle, oklch(0.22 0.02 270))',
              color: isSuccess ? '#fff' : 'var(--color-fg, oklch(0.96 0.01 270))',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {isSuccess ? 'Sign In' : 'Back to Sign In'}
          </a>
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  borderRadius: '0.75rem',
  border: '1px solid var(--color-border-subtle, oklch(0.22 0.02 270))',
  backgroundColor: 'var(--color-card, oklch(0.13 0.02 270))',
  padding: '2.5rem 2rem',
}
