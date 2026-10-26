import Image from 'next/image'
import {
  ArrowRight,
  MessageSquare,
  FileCheck,
  Rocket,
  Globe,
  Smartphone,
  LayoutDashboard,
  Cpu,
  Server,
  ShoppingCart,
  Shield,
  Star,
  CheckCircle2,
} from 'lucide-react'
import { LinkButton } from '@/components/ui/link-button'

const steps = [
  {
    number: '01',
    icon: MessageSquare,
    title: 'Describe Your Idea',
    description:
      'Tell us what you want to build. Share your vision, features, and requirements in plain language — no technical jargon needed.',
  },
  {
    number: '02',
    icon: FileCheck,
    title: 'Review & Proposal',
    description:
      'Our team reviews your request and sends a detailed proposal with scope, timeline, and cost — within 48 hours.',
  },
  {
    number: '03',
    icon: Shield,
    title: 'Contract & NDA',
    description:
      'Sign the agreement digitally. All contracts include NDAs and clear IP ownership terms protecting your idea.',
  },
  {
    number: '04',
    icon: Rocket,
    title: 'We Build & Deliver',
    description:
      'Our engineers build your application with regular updates and milestone check-ins. You receive full source code on delivery.',
  },
]

const services = [
  {
    icon: Globe,
    title: 'Web Application',
    desc: 'Full-stack web apps, portals, and platforms built for scale.',
  },
  {
    icon: Smartphone,
    title: 'Mobile App',
    desc: 'Native iOS, Android, or cross-platform React Native apps.',
  },
  {
    icon: ShoppingCart,
    title: 'E-Commerce',
    desc: 'Custom storefronts with inventory, payments, and analytics.',
  },
  {
    icon: Server,
    title: 'API & Backend',
    desc: 'Robust REST/GraphQL APIs, microservices, and integrations.',
  },
  {
    icon: Cpu,
    title: 'AI Integration',
    desc: 'Embed LLMs, vision models, and ML pipelines into your product.',
  },
  {
    icon: LayoutDashboard,
    title: 'Admin Dashboard',
    desc: 'Data-rich dashboards and CMS platforms for your operations.',
  },
]

const stats = [
  { value: '50+', label: 'Projects Delivered' },
  { value: '98%', label: 'Client Satisfaction' },
  { value: '<48h', label: 'First Response' },
  { value: 'NDA', label: 'Protected Always' },
]

export default function HomePage() {
  return (
    <div className="relative overflow-hidden bg-[#080C14]">
      {/* Background Glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-25"
          style={{
            background:
              'radial-gradient(ellipse at center, #0B1F3A 0%, rgba(11,31,58,0.4) 40%, transparent 70%)',
          }}
        />
      </div>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pt-24 pb-20 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative p-2.5 rounded-2xl bg-gradient-to-b from-[#0B1F3A]/60 to-[#0A0A0A] border border-[#CBD5E1]/20 shadow-2xl backdrop-blur-sm">
            <Image
              src="/logo.png"
              alt="Zolexora AppSuite Emblem"
              width={80}
              height={80}
              className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-[0_12px_24px_rgba(11,31,58,0.6)]"
              priority
            />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#404040] bg-[#0A0A0A] px-4 py-1.5 text-xs text-[#CBD5E1] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1] animate-pulse" />
          Accepting New Projects — Response within 48h
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
          Your App Idea,
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 50%, #94A3B8 100%)',
            }}
          >
            Built by Experts.
          </span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-[#CBD5E1]/80 mb-10 leading-relaxed">
          Zolexora AppSuite connects you with our dedicated development team.
          Describe what you need, we handle everything — from proposal and
          contracts to delivery and beyond.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <LinkButton size="lg" href="/dashboard/new-request" className="flex items-center gap-2">
            Start Your Project <ArrowRight className="w-4 h-4" />
          </LinkButton>
          <LinkButton variant="outline" size="lg" href="/dashboard">
            Sign In to Dashboard
          </LinkButton>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="text-center p-4 rounded-xl bg-[#0A0A0A]/80 border border-[#404040]/50">
              <p className="text-3xl font-bold text-white">
                {s.value}
              </p>
              <p className="text-sm text-[#CBD5E1]/70 mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-widest mb-3">
            Process
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            From Idea to Shipped App
          </h2>
          <p className="mt-4 text-[#CBD5E1]/70 max-w-xl mx-auto">
            A transparent, structured process so you always know what&apos;s
            happening with your project.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="relative rounded-xl border border-[#404040] bg-[#0A0A0A] p-6 hover:border-[#CBD5E1]/50 hover:bg-[#121824] transition-all group"
            >
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 right-0 w-6 h-px bg-[#404040] translate-x-full" />
              )}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] border border-[#CBD5E1]/30 flex items-center justify-center group-hover:border-[#CBD5E1]/60 transition-colors">
                  <step.icon className="w-5 h-5 text-[#CBD5E1]" />
                </div>
                <span className="text-4xl font-bold text-[#404040] group-hover:text-[#CBD5E1]/40 transition-colors">
                  {step.number}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-[#CBD5E1]/70 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-widest mb-3">
            What We Build
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Every Kind of Application
          </h2>
          <p className="mt-4 text-[#CBD5E1]/70 max-w-xl mx-auto">
            From simple tools to complex enterprise platforms — if you can
            describe it, we can build it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((svc) => (
            <div
              key={svc.title}
              className="group rounded-xl border border-[#404040] bg-[#0A0A0A] p-6 hover:border-[#CBD5E1]/50 hover:bg-[#121824] transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] border border-[#CBD5E1]/20 flex items-center justify-center mb-4 group-hover:border-[#CBD5E1]/50 transition-colors">
                <svc.icon className="w-5 h-5 text-[#CBD5E1]" />
              </div>
              <h3 className="font-semibold text-white mb-2">
                {svc.title}
              </h3>
              <p className="text-sm text-[#CBD5E1]/70">{svc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="rounded-2xl border border-[#CBD5E1]/20 bg-gradient-to-b from-[#0B1F3A]/40 to-[#0A0A0A] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl">
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              background:
                'radial-gradient(ellipse at center, #0B1F3A 0%, transparent 70%)',
            }}
          />
          <div className="relative">
            <div className="flex justify-center gap-1.5 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="w-5 h-5 fill-[#CBD5E1] text-[#CBD5E1]"
                />
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to build your next app?
            </h2>
            <p className="text-[#CBD5E1]/80 mb-8 max-w-lg mx-auto">
              Join teams who trust Zolexora to turn their ideas into powerful
              software products.
            </p>
            <LinkButton
              size="lg"
              href="/dashboard/new-request"
              className="inline-flex items-center gap-2"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </LinkButton>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[#CBD5E1]/80">
              {[
                'No commitment required',
                'NDA available',
                'Fixed-price contracts',
                'Source code ownership',
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#CBD5E1]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
