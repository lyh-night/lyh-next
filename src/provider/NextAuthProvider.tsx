'use client'

import { SessionProvider } from 'next-auth/react'
import type React from 'react'
import { type ReactElement } from 'react'

interface Props {
  children: React.ReactNode
}

export default function NextAuthProvider({ children }: Props): ReactElement {
  return <SessionProvider>{children}</SessionProvider>
}
