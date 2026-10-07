import { Link }        from 'react-router-dom'
import { useQuery }    from '@tanstack/react-query'
import { ShieldCheck, ShieldAlert, Shield, ChevronRight } from 'lucide-react'
import { kycAPI }      from '@/services/api'

export default function KYCBanner() {
  const { data } = useQuery({
    queryKey: ['kyc-status'],
    queryFn:  () => kycAPI.getStatus() as any,
    staleTime: 1000 * 60 * 5,
  })

  const status       = (data as any)?.overall ?? 'pending'
  const pendingSteps = (data as any)?.pendingSteps ?? []

  if (status === 'verified') return null // hide when fully verified

  const config = {
    pending:   {
      icon: Shield, iconCls: 'text-amber-500',
      bg: 'bg-amber-50 border-amber-200',
      title: 'Complete verification',
      desc: 'Verify your Aadhaar to start booking rooms',
    },
    submitted: {
      icon: ShieldCheck, iconCls: 'text-blue-500',
      bg: 'bg-blue-50 border-blue-200',
      title: 'Verification in progress',
      desc: 'Your documents are being reviewed. Usually takes a few minutes.',
    },
    rejected: {
      icon: ShieldAlert, iconCls: 'text-red-500',
      bg: 'bg-red-50 border-red-200',
      title: 'Verification failed',
      desc: 'Your document was rejected. Please re-upload.',
    },
  }[status] ?? null

  if (!config) return null

  const Icon = config.icon

  return (
    <Link to="/kyc" className="block">
      <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${config.bg}`}>
        <Icon size={20} className={`${config.iconCls} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{config.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{config.desc}</p>
        </div>
        {status !== 'submitted' && (
          <ChevronRight size={16} className="text-gray-400 shrink-0" />
        )}
      </div>
    </Link>
  )
}
