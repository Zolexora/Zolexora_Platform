'use client'

import React from 'react'
import { ZolexoraAuthProvider } from '@zolexora/user-auth-firebase'

export function TeamAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ZolexoraAuthProvider>
      {children}
    </ZolexoraAuthProvider>
  )
}
