import type { FullSync } from '@application/use-cases/sync/FullSync'

export class SyncCoordinator {
  private syncTimer: ReturnType<typeof setTimeout> | null = null
  private isSyncing = false
  private pendingSync = false

  constructor(private readonly fullSync: FullSync) {}

  scheduleSync(delayMs: number = 1000): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
    }

    this.syncTimer = setTimeout(() => {
      void this.performSync()
    }, delayMs)
  }

  async performSync(): Promise<void> {
    if (this.isSyncing) {
      this.pendingSync = true
      return
    }

    this.isSyncing = true

    try {
      const result = await this.fullSync.execute()

      if (!result.success) {
        // Retry if merkle divergence detected
        this.scheduleSync(5000)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      this.scheduleSync(30000)
    } finally {
      this.isSyncing = false

      if (this.pendingSync) {
        this.pendingSync = false
        this.scheduleSync(1000)
      }
    }
  }

  stopSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
      this.syncTimer = null
    }
    this.pendingSync = false
  }

  get isRunning(): boolean {
    return this.syncTimer !== null || this.isSyncing
  }
}
