import { initializeApp, getApps }         from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect,
  getRedirectResult, OAuthCredential,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Prevent duplicate initialisation (hot reload safe)
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth           = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Request profile + email scopes
googleProvider.addScope('profile')
googleProvider.addScope('email')

// Always prompt account picker (even if already signed in)
googleProvider.setCustomParameters({ prompt: 'select_account' })

// ─── SIGN IN WITH GOOGLE ──────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<{
  idToken: string
  email: string
  name: string
  photo: string | null
}> {
  // Mobile: redirect flow avoids popup blockers
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)

  if (isMobile) {
    await signInWithRedirect(auth, googleProvider)
    // Execution resumes after redirect back — handled by getGoogleRedirectResult()
    throw new Error('REDIRECT') // signal to caller
  }

  // Desktop: popup
  const result     = await signInWithPopup(auth, googleProvider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  const idToken    = await result.user.getIdToken()

  return {
    idToken,
    email: result.user.email!,
    name:  result.user.displayName ?? '',
    photo: result.user.photoURL,
  }
}

// Called on page load to check if we're returning from a Google redirect
export async function getGoogleRedirectResult(): Promise<{
  idToken: string
  email: string
  name: string
  photo: string | null
} | null> {
  try {
    const result = await getRedirectResult(auth)
    if (!result) return null

    const idToken = await result.user.getIdToken()
    return {
      idToken,
      email: result.user.email!,
      name:  result.user.displayName ?? '',
      photo: result.user.photoURL,
    }
  } catch {
    return null
  }
}

// ─── FCM TOKEN (reuse Firebase app) ─────────────────────────────────────────

export { app as firebaseApp }
