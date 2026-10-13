import { VerifyEmailView } from '@zolexora/user-auth-zolexora/pages'
import { getZolexoraAuth } from '@/lib/auth'

export const metadata = { title: 'Verify Email' }

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function Page({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return <VerifyEmailView status="missing" loginHref="/login" />
  }

  try {
    await getZolexoraAuth().verifyEmail(token)
    return <VerifyEmailView status="success" loginHref="/login" />
  } catch (err) {
    return (
      <VerifyEmailView
        status="error"
        error={err instanceof Error ? err.message : undefined}
        loginHref="/login"
      />
    )
  }
}
