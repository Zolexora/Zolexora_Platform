import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { TeamSidebar } from '@/components/dashboard/team-sidebar'

export default async function TeamDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <TeamSidebar user={user} />
      <main className="flex-1 overflow-y-auto bg-[var(--color-surface-dark)]">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
