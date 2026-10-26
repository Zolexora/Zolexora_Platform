'use client'

import React from 'react'
import { ZolexoraAuthProvider, getWebFirebaseAuth, type FirebaseClientConfig } from '@zolexora/user-auth-firebase'

export const clientFirebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAogbrOXGDbmnUBfgMrMLtIDqT4EijJLZ8',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zolexora-authentication.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zolexora-authentication',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zolexora-authentication.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '743211765178',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:743211765178:web:d655fa9a2cfb612203a183',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-PCFKXVVFHJ',
}

// Ensure singleton auth instance is immediately initialized with real credentials on browser load
if (typeof window !== 'undefined') {
  getWebFirebaseAuth(clientFirebaseConfig)
}

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ZolexoraAuthProvider config={clientFirebaseConfig}>
      {children}
    </ZolexoraAuthProvider>
  )
}
