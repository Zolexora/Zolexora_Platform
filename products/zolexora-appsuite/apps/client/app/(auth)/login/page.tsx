import { ClientAuthCard } from '@/components/auth/client-auth-card'

export const metadata = { title: 'Sign In | Zolexora AppSuite' }

export default function LoginPage() {
  return <ClientAuthCard initialMode="select" />
}
