import { eq, gt } from 'drizzle-orm'
import { Timestamp } from '@domain/value-objects'
import { messagesCrdt, messagesClock } from '@infrastructure/persistence/sqlite/schema'
import type { DrizzleDB } from '@infrastructure/persistence/sqlite/types'
import type { ClockState } from '../crdt/Clock'
import type { TrieNode } from '../crdt/MerkleTree'

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
  constructor(private db: DrizzleDB) {}

  async getMessages(since: string): Promise<StoredMessage[]> {
    return (this.db as any)
      .select({
        timestamp: messagesCrdt.timestamp,
        dataset: messagesCrdt.dataset,
        row: messagesCrdt.row,
        column: messagesCrdt.column,
        value: messagesCrdt.value,
      })
      .from(messagesCrdt)
      .where(gt(messagesCrdt.timestamp, since))
      .orderBy(messagesCrdt.timestamp)
      .all()
  }

  async saveMessage(message: StoredMessage): Promise<void> {
    await (this.db as any)
      .insert(messagesCrdt)
      .values({
        timestamp: message.timestamp,
        dataset: message.dataset,
        row: message.row,
        column: message.column,
        value: message.value,
      })
      .onConflictDoNothing()
  }

  async saveMessages(messages: StoredMessage[]): Promise<void> {
    if (messages.length === 0) return

    for (const msg of messages) {
      await this.saveMessage(msg)
    }
  }

  async hasMessage(timestamp: string): Promise<boolean> {
    const row = await (this.db as any)
      .select({ timestamp: messagesCrdt.timestamp })
      .from(messagesCrdt)
      .where(eq(messagesCrdt.timestamp, timestamp))
      .get()
    return row !== undefined
  }

  async getClock(): Promise<ClockState | null> {
    const row = await (this.db as any)
      .select({ clock: messagesClock.clock })
      .from(messagesClock)
      .where(eq(messagesClock.id, 1))
      .get()

    if (!row) return null

    const data = JSON.parse(row.clock) as {
      timestamp: string
      merkle: TrieNode
      node: string
    }

    const ts = Timestamp.parse(data.timestamp)
    if (!ts) return null

    return {
      timestamp: ts,
      merkle: data.merkle,
      node: data.node,
    }
  }

  async saveClock(clock: ClockState): Promise<void> {
    const json = JSON.stringify({
      timestamp: clock.timestamp.toString(),
      merkle: clock.merkle,
      node: clock.node,
    })

    await (this.db as any)
      .insert(messagesClock)
      .values({ id: 1, clock: json })
      .onConflictDoUpdate({
        target: messagesClock.id,
        set: { clock: json },
      })
  }
}
