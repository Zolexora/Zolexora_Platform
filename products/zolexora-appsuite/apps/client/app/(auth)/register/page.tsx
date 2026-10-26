import { ClientAuthCard } from '@/components/auth/client-auth-card'

export const metadata = { title: 'Create Account | Zolexora AppSuite' }

export default function RegisterPage() {
  return <ClientAuthCard initialMode="email_register" />
}
