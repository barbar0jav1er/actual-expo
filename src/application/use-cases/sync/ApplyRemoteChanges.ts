import type { SQLiteDatabase } from 'expo-sqlite'
import { applyMessage } from '@loot-core/sync/apply'
import { deserializeValue } from '@loot-core/sync/encoder'

export interface RemoteMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string // serialized: '0:', 'N:x', 'S:text'
}

export class ApplyRemoteChanges {
  constructor(private readonly db: SQLiteDatabase) {}

  async execute(input: { messages: RemoteMessage[] }): Promise<void> {
    const sorted = [...input.messages].sort((a, b) =>
      a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
    )

    for (const msg of sorted) {
      try {
        applyMessage(this.db, {
          dataset: msg.dataset,
          row: msg.row,
          column: msg.column,
          value: deserializeValue(msg.value),
        })
      } catch (err) {
        console.warn(
          `[ApplyRemoteChanges] ${msg.dataset}/${msg.row}/${msg.column}:`,
          err,
        )
        // Error per message → continue with next
      }
    }
  }
}
