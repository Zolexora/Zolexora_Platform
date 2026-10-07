import { useState, useRef, useEffect }          from 'react'
import { useNavigate }                           from 'react-router-dom'
import { authAPI }                               from '@/services/api'
import { signInWithGoogle, getGoogleRedirectResult } from '@/services/firebase'
import { useAuthStore }                          from '@/store/authStore'

// Steps:
//  phone        → enter mobile number (OTP mode landing)
//  otp          → verify OTP
//  set-password → new user (phone-first): set password
//  google-phone → new user (Google-first): enter phone
//  google-otp   → new user (Google-first): verify OTP
//  google-pass  → new user (Google-first): set password
//  email        → email + password login

type Step = 'phone' | 'otp' | 'set-password' | 'google-phone' | 'google-otp' | 'google-pass' | 'email'
type AuthMode = 'otp' | 'email'

interface GoogleProfile { name: string; email: string; photo: string | null }

export default function LoginPage() {
  const navigate    = useNavigate()
  const { setAuth } = useAuthStore()

  const [mode,          setMode]          = useState<AuthMode>('otp')
  const [step,          setStep]          = useState<Step>('phone')
  const [phone,         setPhone]         = useState('')
  const [googlePhone,   setGooglePhone]   = useState('')
  const [otp,           setOtp]           = useState(['', '', '', '', '', ''])
  const [password,      setPassword]      = useState('')
  const [confirmPass,   setConfirmPass]   = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [email,         setEmail]         = useState('')
  const [emailPass,     setEmailPass]     = useState('')
  const [showEmailPass, setShowEmailPass] = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoad,    setGoogleLoad]    = useState(false)
  const [error,         setError]         = useState('')
  const [timer,         setTimer]         = useState(0)
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null)
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null)
  const [pendingTokens, setPendingTokens] = useState<{ accessToken: string; refreshToken: string; user: any } | null>(null)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    getGoogleRedirectResult().then(async (result) => {
      if (!result) return
      setGoogleLoad(true)
      try { await handleGoogleResult(result.idToken, result.name) }
      catch (e: any) { setError(e.message) }
      finally { setGoogleLoad(false) }
    })
  }, [])

  const handleGoogleResult = async (idToken: string, fallbackName?: string) => {
    const res = await authAPI.google(idToken, fallbackName) as any
    if (res.isNewUser && res.requiresPhone) {
      setGoogleProfile(res.googleProfile)
      setGoogleIdToken(idToken)
      setStep('google-phone')
      return
    }
    setAuth(res.user, res.accessToken, res.refreshToken)
    navigate('/')
  }

  const handleGoogle = async () => {
    setError(''); setGoogleLoad(true)
    try {
      const result = await signInWithGoogle()
      await handleGoogleResult(result.idToken, result.name)
    } catch (e: any) {
      if (e.message === 'REDIRECT') return
      setError(e.message)
    } finally { setGoogleLoad(false) }
  }

  // ── OTP flow ─────────────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    const clean = phone.replace(/\D/g, '').slice(-10)
    if (clean.length !== 10) { setError('Enter a valid 10-digit mobile number'); return }
    setError(''); setLoading(true)
    try {
      await authAPI.sendOTP(clean)
      setStep('otp'); startTimer()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleVerifyOTP = async () => {
    const code = otp.join('')
    if (code.length !== 6) { setError('Enter the 6-digit OTP'); return }
    setError(''); setLoading(true)
    try {
      const res = await authAPI.verifyOTP(phone.replace(/\D/g, '').slice(-10), code) as any
      if (res.isNewUser) {
        setPendingTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user })
        setStep('set-password')
        return
      }
      setAuth(res.user, res.accessToken, res.refreshToken)
      navigate('/')
    } catch (e: any) { setError(e.message); resetOtp() }
    finally { setLoading(false) }
  }

  // ── Set password (phone-first new user) ──────────────────────────────────────
  const handleSetPassword = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPass) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try {
      if (!pendingTokens) throw new Error('Session expired, please start over')
      setAuth(pendingTokens.user, pendingTokens.accessToken, pendingTokens.refreshToken)
      await authAPI.setPassword(password)
      navigate('/')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Email login ───────────────────────────────────────────────────────────────
  const handleEmailLogin = async () => {
    if (!email.trim()) { setError('Enter your email address'); return }
    if (!emailPass)    { setError('Enter your password'); return }
    setError(''); setLoading(true)
    try {
      const res = await authAPI.emailLogin(email.trim(), emailPass) as any
      setAuth(res.user, res.accessToken, res.refreshToken)
      navigate('/')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Google-first new user ─────────────────────────────────────────────────────
  const handleGoogleSendOTP = async () => {
    const clean = googlePhone.replace(/\D/g, '').slice(-10)
    if (clean.length !== 10) { setError('Enter a valid 10-digit mobile number'); return }
    setError(''); setLoading(true)
    try {
      await authAPI.sendOTP(clean)
      setStep('google-otp'); startTimer()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleGoogleVerifyOTP = async () => {
    const code = otp.join('')
    if (code.length !== 6) { setError('Enter the 6-digit OTP'); return }
    setError(''); setLoading(true)
    try {
      const res = await authAPI.verifyOTP(
        googlePhone.replace(/\D/g, '').slice(-10), code,
        googleProfile?.name, googleIdToken ?? undefined,
        googleProfile?.email, googleProfile?.photo ?? undefined,
      ) as any
      if (res.isNewUser) {
        setPendingTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user })
        setStep('google-pass')
        return
      }
      setAuth(res.user, res.accessToken, res.refreshToken)
      navigate('/')
    } catch (e: any) { setError(e.message); resetOtp() }
    finally { setLoading(false) }
  }

  const handleGoogleSetPassword = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPass) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try {
      if (!pendingTokens) throw new Error('Session expired, please start over')
      setAuth(pendingTokens.user, pendingTokens.accessToken, pendingTokens.refreshToken)
      await authAPI.setPassword(password)
      navigate('/')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const startTimer = () => {
    setTimer(60)
    const t = setInterval(() =>
      setTimer((v) => { if (v <= 1) { clearInterval(t); return 0 } return v - 1 }), 1000)
  }
  const resetOtp = () => { setOtp(['', '', '', '', '', '']); otpRefs.current[0]?.focus() }

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]; next[i] = val.slice(-1); setOtp(next)
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
  }
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
    if (e.key === 'Enter') {
      if (step === 'otp') handleVerifyOTP()
      if (step === 'google-otp') handleGoogleVerifyOTP()
    }
  }

  const OtpResend = ({ onResend }: { onResend: () => void }) => (
    <div className="text-center text-sm">
      {timer > 0
        ? <span className="text-gray-400">Resend in {timer}s</span>
        : <button className="text-violet-700 hover:underline" onClick={onResend}>Resend OTP</button>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-700 to-violet-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-4">
            <span className="text-3xl">🏠</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Rent & Stay</h1>
          <p className="text-white/70 text-sm mt-1">Owner Portal — List & manage properties</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">

          {/* ── PHONE STEP ── */}
          {step === 'phone' && <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
              <p className="text-sm text-gray-500 mt-0.5">Choose how you'd like to continue</p>
            </div>

            {/* Auth mode tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {(['otp', 'email'] as AuthMode[]).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(''); if (m === 'email') setStep('email') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {m === 'otp' ? 'Mobile OTP' : 'Email'}
                </button>
              ))}
            </div>

            <button
              onClick={handleGoogle} disabled={googleLoad}
              className="w-full flex items-center justify-center gap-3 border border-gray-200
                         rounded-xl py-3 px-4 text-sm font-medium text-gray-700
                         hover:bg-gray-50 active:scale-[0.98] transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {googleLoad
                ? <span className="w-5 h-5 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin" />
                : <GoogleIcon />}
              {googleLoad ? 'Signing in…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">or with mobile number</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium shrink-0">
                  🇮🇳 +91
                </div>
                <input
                  className="input rounded-xl flex-1"
                  type="tel" inputMode="numeric" placeholder="9876543210" maxLength={10}
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                  autoFocus
                />
              </div>
            </div>

            {error && <ErrorBox msg={error} />}

            <button
              className="w-full py-3 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm
                         font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={handleSendOTP} disabled={loading}>
              {loading ? <Spinner /> : 'Get OTP →'}
            </button>

            <p className="text-xs text-center text-gray-400">
              By continuing you agree to our{' '}
              <a href="/terms" className="underline hover:text-gray-600">Terms</a> &{' '}
              <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>
            </p>
          </>}

          {/* ── EMAIL STEP ── */}
          {step === 'email' && <>
            <div>
              <button onClick={() => { setStep('phone'); setMode('otp'); setError('') }}
                className="text-violet-700 text-sm hover:underline flex items-center gap-1 mb-3">
                ← Back
              </button>
              <h2 className="text-lg font-semibold">Sign in with Email</h2>
              <p className="text-sm text-gray-500 mt-0.5">Use your email and password</p>
            </div>

            <button
              onClick={handleGoogle} disabled={googleLoad}
              className="w-full flex items-center justify-center gap-3 border border-gray-200
                         rounded-xl py-3 px-4 text-sm font-medium text-gray-700
                         hover:bg-gray-50 active:scale-[0.98] transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {googleLoad ? <span className="w-5 h-5 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin" /> : <GoogleIcon />}
              {googleLoad ? 'Signing in…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input className="input rounded-xl w-full" type="email" placeholder="you@example.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()} autoFocus />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input className="input rounded-xl pr-10 w-full"
                  type={showEmailPass ? 'text' : 'password'} placeholder="Your password"
                  value={emailPass} onChange={(e) => { setEmailPass(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()} />
                <button type="button" onClick={() => setShowEmailPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">
                  {showEmailPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && <ErrorBox msg={error} />}

            <button
              className="w-full py-3 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm
                         font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={handleEmailLogin} disabled={loading}>
              {loading ? <Spinner /> : 'Sign In →'}
            </button>
          </>}

          {/* ── OTP STEP ── */}
          {step === 'otp' && <>
            <div>
              <button onClick={() => { setStep('phone'); resetOtp(); setError('') }}
                className="text-violet-700 text-sm hover:underline flex items-center gap-1 mb-3">
                ← Back
              </button>
              <h2 className="text-lg font-semibold">Enter OTP</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Sent to +91 {phone.replace(/\D/g, '').slice(-10)}
              </p>
            </div>

            <OtpBoxes otp={otp} refs={otpRefs} onChange={handleOtpChange} onKeyDown={handleOtpKey} />
            {error && <ErrorBox msg={error} />}

            <button
              className="w-full py-3 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm
                         font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={handleVerifyOTP} disabled={loading || otp.join('').length !== 6}>
              {loading ? <Spinner /> : 'Verify →'}
            </button>

            <OtpResend onResend={handleSendOTP} />
          </>}

          {/* ── SET PASSWORD (phone-first new user) ── */}
          {step === 'set-password' && <>
            <div>
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-lg font-semibold">Create your password</h2>
              <p className="text-sm text-gray-500 mt-0.5">Set a password to also sign in with email later</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input className="input rounded-xl pr-10 w-full"
                  type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                  value={password} onChange={(e) => { setPassword(e.target.value); setError('') }}
                  autoFocus />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <input className="input rounded-xl w-full"
                type={showPass ? 'text' : 'password'} placeholder="Repeat password"
                value={confirmPass} onChange={(e) => { setConfirmPass(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()} />
            </div>

            {password.length > 0 && <PasswordStrength password={password} />}
            {error && <ErrorBox msg={error} />}

            <button
              className="w-full py-3 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm
                         font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={handleSetPassword} disabled={loading}>
              {loading ? <Spinner /> : 'Get Started →'}
            </button>
          </>}

          {/* ── GOOGLE-PHONE STEP ── */}
          {step === 'google-phone' && <>
            <div>
              <button onClick={() => { setStep('phone'); setGoogleProfile(null); setError('') }}
                className="text-violet-700 text-sm hover:underline flex items-center gap-1 mb-3">
                ← Back
              </button>

              {googleProfile && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-3">
                  {googleProfile.photo
                    ? <img src={googleProfile.photo} className="w-10 h-10 rounded-full" alt="profile" />
                    : <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold">
                        {googleProfile.name[0]}
                      </div>}
                  <div>
                    <p className="font-medium text-sm text-gray-900">{googleProfile.name}</p>
                    <p className="text-xs text-gray-400">{googleProfile.email}</p>
                  </div>
                </div>
              )}

              <h2 className="text-lg font-semibold">Verify your number</h2>
              <p className="text-sm text-gray-500 mt-0.5">Enter your mobile number to complete signup</p>
            </div>

            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium shrink-0">
                🇮🇳 +91
              </div>
              <input className="input rounded-xl flex-1"
                type="tel" inputMode="numeric" placeholder="9876543210" maxLength={10}
                value={googlePhone}
                onChange={(e) => { setGooglePhone(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleGoogleSendOTP()}
                autoFocus />
            </div>

            {error && <ErrorBox msg={error} />}

            <button
              className="w-full py-3 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm
                         font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={handleGoogleSendOTP} disabled={loading}>
              {loading ? <Spinner /> : 'Send OTP →'}
            </button>
          </>}

          {/* ── GOOGLE-OTP STEP ── */}
          {step === 'google-otp' && <>
            <div>
              <button onClick={() => { setStep('google-phone'); resetOtp(); setError('') }}
                className="text-violet-700 text-sm hover:underline flex items-center gap-1 mb-3">
                ← Back
              </button>
              <h2 className="text-lg font-semibold">Enter OTP</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Sent to +91 {googlePhone.replace(/\D/g, '').slice(-10)}
              </p>
            </div>

            <OtpBoxes otp={otp} refs={otpRefs} onChange={handleOtpChange} onKeyDown={handleOtpKey} />
            {error && <ErrorBox msg={error} />}

            <button
              className="w-full py-3 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm
                         font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={handleGoogleVerifyOTP} disabled={loading || otp.join('').length !== 6}>
              {loading ? <Spinner /> : 'Verify →'}
            </button>

            <OtpResend onResend={handleGoogleSendOTP} />
          </>}

          {/* ── GOOGLE-PASS STEP ── */}
          {step === 'google-pass' && <>
            <div>
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-lg font-semibold">One last step</h2>
              <p className="text-sm text-gray-500 mt-0.5">Create a password to secure your account</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input className="input rounded-xl pr-10 w-full"
                  type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                  value={password} onChange={(e) => { setPassword(e.target.value); setError('') }}
                  autoFocus />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <input className="input rounded-xl w-full"
                type={showPass ? 'text' : 'password'} placeholder="Repeat password"
                value={confirmPass} onChange={(e) => { setConfirmPass(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleGoogleSetPassword()} />
            </div>

            {password.length > 0 && <PasswordStrength password={password} />}
            {error && <ErrorBox msg={error} />}

            <button
              className="w-full py-3 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm
                         font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={handleGoogleSetPassword} disabled={loading}>
              {loading ? <Spinner /> : 'Complete Setup →'}
            </button>
          </>}

        </div>
      </div>
    </div>
  )
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function OtpBoxes({ otp, refs, onChange, onKeyDown }: {
  otp: string[]
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  onChange: (i: number, val: string) => void
  onKeyDown: (i: number, e: React.KeyboardEvent) => void
}) {
  return (
    <div className="flex gap-2 justify-center">
      {otp.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el }}
          className="w-11 h-12 text-center text-xl font-bold border border-gray-200
                     rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors"
          type="tel" inputMode="numeric" maxLength={1} value={d}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          autoFocus={i === 0} />
      ))}
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ]
  return (
    <div className="flex gap-2">
      {checks.map((c) => (
        <span key={c.label} className={`text-xs px-2 py-0.5 rounded-full ${
          c.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {c.ok ? '✓' : '○'} {c.label}
        </span>
      ))}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

const Spinner = () => (
  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
)

const ErrorBox = ({ msg }: { msg: string }) => (
  <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
    <span className="text-red-400 shrink-0">⚠</span>
    <p className="text-red-600 text-sm">{msg}</p>
  </div>
)
