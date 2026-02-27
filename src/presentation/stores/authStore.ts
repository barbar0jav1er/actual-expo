import { create } from 'zustand'
import { SecureTokenStorage } from '@infrastructure/storage'
import { ActualServerClient } from '@infrastructure/api'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: { displayName?: string } | null
  serverUrl: string | null
  error: string | null
}

interface AuthActions {
  checkAuth: () => Promise<void>
  login: (serverUrl: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const storage = new SecureTokenStorage()

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  serverUrl: null,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      const [token, serverUrl] = await Promise.all([
        storage.getToken(),
        storage.getServerUrl(),
      ])
      if (token && serverUrl) {
        const client = new ActualServerClient(serverUrl)
        client.setToken(token)
        try {
          const userInfo = await client.auth.validate()
          set({
            isAuthenticated: true,
            isLoading: false,
            user: { displayName: userInfo.displayName || userInfo.userName },
            serverUrl,
          })
        } catch {
          await storage.clearToken()
          set({ isAuthenticated: false, isLoading: false, serverUrl: null })
        }
      } else {
        set({ isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false })
    }
  },

  login: async (serverUrl: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const client = new ActualServerClient(serverUrl)
      const token = await client.auth.login(password)
      client.setToken(token)
      const userInfo = await client.auth.validate()
      await Promise.all([
        storage.saveToken(token),
        storage.saveServerUrl(serverUrl),
      ])
      set({
        isAuthenticated: true,
        isLoading: false,
        user: { displayName: userInfo.displayName || userInfo.userName },
        serverUrl,
        error: null,
      })
    } catch (err) {
      set({
        isAuthenticated: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      })
      throw err
    }
  },

  logout: async () => {
    await Promise.all([
      storage.clearToken(),
      storage.clearActiveFile(),
    ])
    set({
      isAuthenticated: false,
      user: null,
      serverUrl: null,
      error: null,
    })
  },
}))
