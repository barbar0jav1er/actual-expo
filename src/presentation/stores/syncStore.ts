import { create } from 'zustand'

interface SyncState {
  isSyncing: boolean
  lastSyncAt: Date | null
  error: string | null
}

interface SyncActions {
  triggerSync: () => Promise<void>
}

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  error: null,

  triggerSync: async () => {
    set({ isSyncing: true, error: null })
    try {
      // Placeholder for future sync integration
      await new Promise<void>((resolve) => setTimeout(resolve, 500))
      set({ isSyncing: false, lastSyncAt: new Date() })
    } catch (err) {
      set({
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      })
    }
  },
}))
