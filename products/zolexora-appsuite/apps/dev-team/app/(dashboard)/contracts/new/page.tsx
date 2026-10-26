import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createContractAction } from '@/lib/actions/team-actions'
import { INDIAN_STATES } from '@/lib/types'
import { ArrowLeft, ShieldCheck, FileCheck } from 'lucide-react'

export const metadata = { title: 'New Contract | DevTeam Console' }

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; userId?: string; title?: string }>
}) {
  const { requestId, userId, title: initialTitle } = await searchParams

  const [{ rows: clients }, { rows: requests }] = await Promise.all([
    query<{ id: string; email: string }>(
      `SELECT id, email FROM public.zolexora_auth_users ORDER BY email ASC`
    ),
    query<{ id: string; title: string; user_id: string }>(
      `SELECT id, title, user_id FROM public.app_requests ORDER BY created_at DESC`
    ),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#CBD5E1]/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Contracts
      </Link>

      <div className="border-b border-[#404040] pb-4">
        <h1 className="text-2xl font-bold text-white">
          Author &amp; Dispatch Legal Agreement
        </h1>
        <p className="text-xs text-[#CBD5E1]/70 mt-1">
          Generate an enforceable agreement compliant with the Indian Information Technology Act 2000.
        </p>
      </div>

      <Card className="p-6 bg-[#0A0A0A] border border-[#404040]">
        <form action={createContractAction as unknown as (formData: FormData) => void} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Select Client */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]/70">
                Client Signatory Account *
              </label>
              <select
                name="userId"
                defaultValue={userId || ''}
                required
                className="w-full rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 text-sm text-white outline-none focus:border-[#CBD5E1]"
              >
                <option value="" disabled className="bg-[#080C14] text-[#71717A]">Select client user</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#080C14] text-white">
                    {c.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Associated Request */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]/70">
                Linked App Request (Optional)
              </label>
              <select
                name="requestId"
                defaultValue={requestId || ''}
                className="w-full rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 text-sm text-white outline-none focus:border-[#CBD5E1]"
              >
                <option value="" className="bg-[#080C14] text-white">-- Standalone Agreement --</option>
                {requests.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#080C14] text-white">
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              name="title"
              label="Agreement Title *"
              placeholder="e.g. Master Services Agreement (MSA) - Phase 1"
              defaultValue={initialTitle || ''}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]/70">
                Contract Type *
              </label>
              <select
                name="contractType"
                defaultValue="MSA"
                className="w-full rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 text-sm text-white outline-none focus:border-[#CBD5E1]"
              >
                <option value="MSA" className="bg-[#080C14] text-white">Master Services Agreement (MSA)</option>
                <option value="SOW" className="bg-[#080C14] text-white">Statement of Work (SOW)</option>
                <option value="NDA" className="bg-[#080C14] text-white">Non-Disclosure Agreement (NDA)</option>
                <option value="AMC" className="bg-[#080C14] text-white">Annual Maintenance Contract (AMC)</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              name="totalValueInr"
              type="number"
              label="Total Value (INR ₹)"
              placeholder="e.g. 150000"
              hint="Excluding applicable GST"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]/70">
                Signing Method
              </label>
              <select
                name="signingMode"
                defaultValue="CLICKWRAP_OTP"
                className="w-full rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 text-sm text-white outline-none focus:border-[#CBD5E1]"
              >
                <option value="CLICKWRAP_OTP" className="bg-[#080C14] text-white">Clickwrap with 6-Digit Email OTP</option>
                <option value="AADHAAR_ESIGN" className="bg-[#080C14] text-white">Aadhaar eSign (Digio / Leegality)</option>
                <option value="DSC_TOKEN" className="bg-[#080C14] text-white">Class 3 USB Hardware Token (DSC)</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]/70">
                Stamp Duty Jurisdiction State
              </label>
              <select
                name="stampState"
                defaultValue="Maharashtra"
                className="w-full rounded-lg border border-[#404040] bg-[#080C14] px-3 py-2 text-sm text-white outline-none focus:border-[#CBD5E1]"
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state} className="bg-[#080C14] text-white">
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <Input
              name="stampDutyRef"
              label="E-Stamp Certificate Reference"
              placeholder="e.g. IN-MH12345678901234V"
              hint="Optional e-Stamping GRAS / StockHolding certificate number"
            />
          </div>

          <Textarea
            name="scopeSummary"
            label="Scope Summary &amp; Key Deliverables"
            rows={4}
            placeholder="Outline deliverables, milestone payments, source code ownership transfer terms, and delivery timeline."
          />

          <div className="p-4 rounded-lg bg-[#080C14] border border-[#404040] flex items-start gap-3 text-xs text-[#CBD5E1]/80">
            <ShieldCheck className="w-5 h-5 text-[#CBD5E1] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Legal Compliance Guarantee</p>
              <p className="mt-0.5">
                Dispatching will register this agreement with cryptographic SHA-256 integrity checks, Section 10A IT Act statutory acceptance clauses, and activate digital signing in the client portal.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Link
              href="/contracts"
              className="text-xs text-[#CBD5E1]/70 hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <Button type="submit">
              <FileCheck className="w-4 h-4 text-[#CBD5E1]" /> Dispatch Agreement to Client
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
