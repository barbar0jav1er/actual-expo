import React, { useEffect } from 'react'
import { useAuthStore } from '../stores'
import { LoadingScreen } from '../components/common'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  if (isLoading) {
    return <LoadingScreen message="Loading..." />
  }

  return <>{children}</>
}
