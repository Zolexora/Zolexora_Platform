'use client'

import React from 'react'
import { ZolexoraAuthProvider, getWebFirebaseAuth, type FirebaseClientConfig } from '@zolexora/user-auth-firebase'

export const teamFirebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_DEVTEAM_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAogbrOXGDbmnUBfgMrMLtIDqT4EijJLZ8',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DEVTEAM_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zolexora-authentication.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_DEVTEAM_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zolexora-authentication',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_DEVTEAM_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zolexora-authentication.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_DEVTEAM_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '743211765178',
  appId: process.env.NEXT_PUBLIC_FIREBASE_DEVTEAM_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:743211765178:web:3e37eaa0eb22ece203a183',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_DEVTEAM_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-5QF3P8FMMW',
}

// Ensure singleton auth instance is immediately initialized with real credentials on browser load
if (typeof window !== 'undefined') {
  getWebFirebaseAuth(teamFirebaseConfig)
}

export function TeamAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ZolexoraAuthProvider config={teamFirebaseConfig}>
      {children}
    </ZolexoraAuthProvider>
  )
}
