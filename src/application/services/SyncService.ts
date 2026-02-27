import { Clock } from '@infrastructure/sync/crdt/Clock'
import { ValueSerializer } from '@infrastructure/sync/ValueSerializer'
import type { SyncRepository } from '@infrastructure/sync/repositories/SQLiteSyncRepository'

export interface EntityChange {
  table: string
  row: string
  data: Record<string, string | number | null>
}

export interface SyncService {
  trackChanges(changes: EntityChange[]): Promise<void>
}

export class CrdtSyncService implements SyncService {
  constructor(
    private readonly clock: Clock,
    private readonly syncRepo: SyncRepository
  ) {}

  async trackChanges(changes: EntityChange[]): Promise<void> {
    const messages: Array<{
      timestamp: string
      dataset: string
      row: string
      column: string
      value: string
    }> = []

    for (const change of changes) {
      for (const [column, value] of Object.entries(change.data)) {
        const ts = this.clock.send()
        messages.push({
          timestamp: ts.toString(),
          dataset: change.table,
          row: change.row,
          column,
          value: ValueSerializer.serialize(value),
        })
      }
    }

    await this.syncRepo.saveMessages(messages)
  }
}
