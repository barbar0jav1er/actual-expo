import { Timestamp } from '@domain/value-objects'
import type { AppDatabase } from '@infrastructure/persistence/sqlite/db'
import type { TrieNode } from '@loot-core/crdt/merkle'

export interface ClockState {
  timestamp: Timestamp
  merkle: TrieNode
  node: string
}

export interface StoredMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string
}

export interface SyncRepository {
  getMessages(since: string): Promise<StoredMessage[]>
  saveMessage(message: StoredMessage): Promise<void>
  saveMessages(messages: StoredMessage[]): Promise<void>
  hasMessage(timestamp: string): Promise<boolean>
  getClock(): Promise<ClockState | null>
  saveClock(clock: ClockState): Promise<void>
}

export class SQLiteSyncRepository implements SyncRepository {
  constructor(private readonly db: AppDatabase) {}

  async getMessages(since: string): Promise<StoredMessage[]> {
    return this.db.all<StoredMessage>(
      'SELECT timestamp, dataset, row, column, value FROM messages_crdt WHERE timestamp > ? ORDER BY timestamp',
      [since],
    )
  }

  async saveMessage(message: StoredMessage): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO messages_crdt (timestamp, dataset, row, column, value)
       VALUES (?, ?, ?, ?, ?)`,
      [message.timestamp, message.dataset, message.row, message.column, message.value],
    )
  }

  async saveMessages(messages: StoredMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.saveMessage(msg)
    }
  }

  async hasMessage(timestamp: string): Promise<boolean> {
    const row = await this.db.first(
      'SELECT timestamp FROM messages_crdt WHERE timestamp = ?',
      [timestamp],
    )
    return row !== null
  }

  async getClock(): Promise<ClockState | null> {
    const row = await this.db.first<{ clock: string }>(
      'SELECT clock FROM messages_clock WHERE id = 1',
    )
    if (!row) return null

    const data = JSON.parse(row.clock) as {
      timestamp: string
      merkle: TrieNode
      node: string
    }
    const ts = Timestamp.parse(data.timestamp)
    if (!ts) return null

    return { timestamp: ts, merkle: data.merkle, node: data.node }
  }

  async saveClock(clock: ClockState): Promise<void> {
    const json = JSON.stringify({
      timestamp: clock.timestamp.toString(),
      merkle: clock.merkle,
      node: clock.node,
    })
    await this.db.run(
      `INSERT INTO messages_clock (id, clock) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET clock = excluded.clock`,
      [json],
    )
  }
}
