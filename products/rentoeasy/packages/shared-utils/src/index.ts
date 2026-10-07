// ─── API CLIENT ──────────────────────────────────────────────────────────────
const BASE_URL = (globalThis as any).process?.env?.API_URL ?? ''

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken()
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

// ─── TOKEN HELPERS ───────────────────────────────────────────────────────────
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('access_token', accessToken)
  localStorage.setItem('refresh_token', refreshToken)
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  return phone
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ─── AADHAAR PDF PASSWORD GENERATOR ─────────────────────────────────────────
export function generateAadhaarPasswords(name: string, dob: string): string[] {
  const year = dob.slice(0, 4)                               // "1995"
  const clean = name.replace(/[^a-zA-Z]/g, '').toUpperCase() // "RAHULSHARMA"
  const firstWord = name.trim().split(/\s+/)[0]
    .replace(/[^a-zA-Z]/g, '').toUpperCase()                 // "RAHUL"

  const candidates = new Set<string>([
    clean.substring(0, 4) + year,       // RAHU1995
    firstWord.substring(0, 4) + year,   // RAHU1995 (same if one word)
    clean + year,                       // RAHULSHARMA1995 (short names: RIA1995)
    firstWord + year,                   // RAHUL1995
    clean.substring(0, 3) + year,       // RAH1995 (3-char fallback)
  ])

  return Array.from(candidates).filter(Boolean)
}

// ─── VALIDATORS ──────────────────────────────────────────────────────────────
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''))
}

export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())
}

export function isValidIFSC(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())
}

export function isValidPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode)
}

// ─── MISC ────────────────────────────────────────────────────────────────────
export function generateReceiptNumber(): string {
  const date = new Date()
  const yymm = `${date.getFullYear().toString().slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}`
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `RAS-${yymm}-${random}`
}

export function calculatePlatformFee(amount: number, feePercent = 2): number {
  return Math.round(amount * (feePercent / 100))
}

export function maskAadhaar(aadhaar: string): string {
  return `XXXX XXXX ${aadhaar.slice(-4)}`
}

export function maskAccount(account: string): string {
  return `XXXX${account.slice(-4)}`
}
