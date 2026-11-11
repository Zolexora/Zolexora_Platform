import { initializeApp, getApps }         from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth           = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

googleProvider.addScope('profile')
googleProvider.addScope('email')
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle(): Promise<{
  idToken: string; email: string; name: string; photo: string | null
}> {
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)
  if (isMobile) {
    await signInWithRedirect(auth, googleProvider)
    throw new Error('REDIRECT')
  }
  const result  = await signInWithPopup(auth, googleProvider)
  const idToken = await result.user.getIdToken()
  return { idToken, email: result.user.email!, name: result.user.displayName ?? '', photo: result.user.photoURL }
}

export async function getGoogleRedirectResult(): Promise<{
  idToken: string; email: string; name: string; photo: string | null
} | null> {
  try {
    const result = await getRedirectResult(auth)
    if (!result) return null
    const idToken = await result.user.getIdToken()
    return { idToken, email: result.user.email!, name: result.user.displayName ?? '', photo: result.user.photoURL }
  } catch { return null }
}
