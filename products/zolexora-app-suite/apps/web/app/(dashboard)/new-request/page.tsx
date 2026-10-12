'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_CATEGORIES, BUDGET_RANGES } from '@/lib/types'
import { Send } from 'lucide-react'

export default function NewRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [budgetRange, setBudgetRange] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in to submit a request.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('app_requests').insert({
      user_id: user.id,
      title,
      description,
      category: category || null,
      budget_range: budgetRange || null,
      status: 'submitted',
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/requests')
    router.refresh()
  }

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

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            label="Project Title"
            placeholder="e.g. Customer Support Ticketing System"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            hint="A short, descriptive name for your project."
          />

          <Select
            label="App Category"
            placeholder="Select a category..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={APP_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />

          <Select
            label="Budget Range"
            placeholder="Select your budget..."
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
          />

          <Textarea
            label="Project Description"
            placeholder="Describe your project in detail. Include the problem it solves, target users, key features, integrations, and any technical preferences..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={8}
            hint="The more detail you provide, the more accurate our proposal will be."
          />

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              loading={loading}
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
