import { RegisterPage } from '@zolexora/user-auth-zolexora/pages'
import { signUpAction, verifyOtpAction } from '@/lib/actions/auth'

export const metadata = { title: 'Create Account' }

export default function Page() {
  return (
    <RegisterPage
      signUpAction={signUpAction}
      verifyOtpAction={verifyOtpAction}
      loginHref="/login"
      minPasswordLength={12}
    />
  )
}
