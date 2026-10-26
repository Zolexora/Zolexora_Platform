'use client'

import { useActionState, useState } from 'react'
import { signInTeamAction, type AuthActionState } from '@/lib/actions/team-actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'

export default function TeamLoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    signInTeamAction,
    {}
  )

  return (
    <div className="w-full max-w-sm">
      <Card className="p-7 bg-[#0A0A0A] border border-[#404040]">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#CBD5E1]" /> Internal Staff Access
          </div>
          <h1 className="text-xl font-bold text-white">
            Team Authentication
          </h1>
          <p className="text-xs text-[#CBD5E1]/70 mt-1">
            Sign in with your Zolexora engineer credentials.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]/70">
              Team Email
            </label>
            <input
              name="email"
              type="email"
              placeholder="engineer@zolexora.com"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 text-sm text-white placeholder:text-[#71717A] outline-none focus:border-[#CBD5E1]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]/70">
              Password
            </label>
            <div className="relative w-full">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 pr-10 text-sm text-white placeholder:text-[#71717A] outline-none focus:border-[#CBD5E1]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#CBD5E1]/60 hover:text-white cursor-pointer p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {state.error && (
            <div className="rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 text-xs text-[#CBD5E1]">
              {state.error}
            </div>
          )}

          <Button type="submit" loading={pending} className="w-full mt-2">
            Authenticate to Console
          </Button>
        </form>
      </Card>
    </div>
  )
}
