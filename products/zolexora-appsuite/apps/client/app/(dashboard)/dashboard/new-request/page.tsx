'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_CATEGORIES, BUDGET_RANGES } from '@/lib/types'
import { createApplicationRequest } from '@/lib/actions/requests'
import { Send } from 'lucide-react'

export default function NewRequestPage() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createApplicationRequest, {})

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Submit a New Request
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Tell us about the application you want built. Be as detailed as
          possible — it helps us give you an accurate proposal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <Input
            label="Project Title"
            name="title"
            placeholder="e.g. Customer Support Ticketing System"
            required
            hint="A short, descriptive name for your project."
          />

          <Select
            label="App Category"
            name="category"
            placeholder="Select a category..."
            options={APP_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />

          <Select
            label="Budget Range"
            name="budget_range"
            placeholder="Select your budget..."
            options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
          />

          <Textarea
            label="Project Description"
            name="description"
            placeholder="Describe your project in detail. Include the problem it solves, target users, key features, integrations, and any technical preferences..."
            required
            rows={8}
            hint="The more detail you provide, the more accurate our proposal will be."
          />

          {state.error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {state.error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              loading={pending}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Request
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
