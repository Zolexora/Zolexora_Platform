import { LoginPage } from '@zolexora/user-auth-zolexora/pages'
import { signInAction } from '@/lib/actions/auth'

export const metadata = { title: 'Sign In' }

export default function Page() {
  return (
    <LoginPage
      signInAction={signInAction}
      registerHref="/register"
      resetHref="/reset-password"
    />
  )
}
