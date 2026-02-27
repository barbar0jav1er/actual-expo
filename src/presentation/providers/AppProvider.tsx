import React from 'react'
import { DatabaseProvider } from './DatabaseProvider'
import { AuthProvider } from './AuthProvider'

interface AppProviderProps {
  children: React.ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  return (
    <DatabaseProvider>
      <AuthProvider>{children}</AuthProvider>
    </DatabaseProvider>
  )
}
