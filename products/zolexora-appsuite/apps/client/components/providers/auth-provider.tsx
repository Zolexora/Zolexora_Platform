'use client'

import React from 'react'
import { ZolexoraAuthProvider, getWebFirebaseAuth, type FirebaseClientConfig } from '@zolexora/user-auth-firebase'

export const clientFirebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
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
