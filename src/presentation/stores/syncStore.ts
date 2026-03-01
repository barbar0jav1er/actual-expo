import { create } from 'zustand'
import { FullSync } from '@application/use-cases/sync'

const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000] // ms
let retryTimer: ReturnType<typeof setTimeout> | null = null

interface SyncState {
  isSyncing: boolean
  lastSyncAt: Date | null
  error: string | null
  retryCount: number
  nextRetryAt: Date | null
}

interface SyncActions {
  triggerSync: () => Promise<void>
  cancelRetry: () => void
  setError: (message: string | null) => void
}

let fullSyncUseCase: FullSync
let refreshStores: (() => Promise<void>) | null = null

export function initializeSyncStore(fullSync: FullSync) {
  fullSyncUseCase = fullSync
}

export function setSyncRefreshCallback(fn: () => Promise<void>) {
  refreshStores = fn
}

export const useSyncStore = create<SyncState & SyncActions>((set, get) => ({
  isSyncing: false,
  lastSyncAt: null,
  error: null,
  retryCount: 0,
  nextRetryAt: null,

  setError: (message) => set({ error: message }),

  cancelRetry: () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    set({ retryCount: 0, nextRetryAt: null, error: null })
  },

  triggerSync: async () => {
    // Guard: skip if already syncing
    if (get().isSyncing) return
    if (!fullSyncUseCase) {
      console.warn('Sync store not initialized')
      return
    }

    // Cancel any pending retry before starting
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }

    set({ isSyncing: true, error: null, nextRetryAt: null })
    try {
      await fullSyncUseCase.execute()
      if (refreshStores) await refreshStores()
      set({ isSyncing: false, lastSyncAt: new Date(), retryCount: 0, error: null })
    } catch (err) {
      const { retryCount } = get()
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)]
      const nextRetryAt = new Date(Date.now() + delay)

      retryTimer = setTimeout(() => {
        retryTimer = null
        void useSyncStore.getState().triggerSync()
      }, delay)

      set({
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
        retryCount: retryCount + 1,
        nextRetryAt,
      })
    }
  },
}))
