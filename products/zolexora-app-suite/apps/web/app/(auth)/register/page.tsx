import { RegisterPage } from '@zolexora/user-auth-zolexora/pages'
import { signUpAction } from '@/lib/actions/auth'

export const metadata = { title: 'Create Account' }

export default function Page() {
  return (
    <RegisterPage
      signUpAction={signUpAction}
      loginHref="/login"
      minPasswordLength={12}
    />
  )
}
