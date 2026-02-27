import { create } from 'zustand'
import { FullSync } from '@application/use-cases/sync'

interface SyncState {
  isSyncing: boolean
  lastSyncAt: Date | null
  error: string | null
}

interface SyncActions {
  triggerSync: () => Promise<void>
}

let fullSyncUseCase: FullSync

export function initializeSyncStore(fullSync: FullSync) {
  fullSyncUseCase = fullSync
}

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  error: null,

  triggerSync: async () => {
    if (!fullSyncUseCase) {
      console.warn('Sync store not initialized')
      return
    }

    set({ isSyncing: true, error: null })
    try {
      await fullSyncUseCase.execute()
      set({ isSyncing: false, lastSyncAt: new Date() })
    } catch (err) {
      set({
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      })
    }
  },
}))
