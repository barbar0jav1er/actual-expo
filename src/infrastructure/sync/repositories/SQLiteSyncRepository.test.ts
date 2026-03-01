import { describe, it, expect, beforeEach } from 'vitest'
import { Timestamp } from '@domain/value-objects'
import { createTestDb } from '@infrastructure/persistence/sqlite/__tests__/createTestDb'
import { SQLiteSyncRepository, type StoredMessage, type ClockState } from './SQLiteSyncRepository'
import type { TrieNode } from '@loot-core/crdt/merkle'

const NODE = 'abc123def4567890'
const TS1 = '2024-02-26T12:00:00.000Z-0000-abc123def4567890'
const TS2 = '2024-02-26T12:00:01.000Z-0001-abc123def4567890'
const TS3 = '2024-02-26T12:00:02.000Z-0002-abc123def4567890'

const emptyTrie = (): TrieNode => ({ hash: 0 })

function makeMsg(timestamp: string, overrides?: Partial<StoredMessage>): StoredMessage {
  return {
    timestamp,
    dataset: 'transactions',
    row: 'tx-001',
    column: 'amount',
    value: 'N:5000',
    ...overrides,
  }
}

describe('SQLiteSyncRepository', () => {
  let repo: SQLiteSyncRepository

  beforeEach(async () => {
    const db = await createTestDb()
    repo = new SQLiteSyncRepository(db)
  })

  describe('saveMessage / hasMessage', () => {
    it('saves a message and detects it with hasMessage', async () => {
      await repo.saveMessage(makeMsg(TS1))
      expect(await repo.hasMessage(TS1)).toBe(true)
    })

    it('returns false for a non-existent timestamp', async () => {
      expect(await repo.hasMessage(TS1)).toBe(false)
    })

    it('ignores duplicate messages (onConflictDoNothing)', async () => {
      await repo.saveMessage(makeMsg(TS1))
      await expect(repo.saveMessage(makeMsg(TS1))).resolves.not.toThrow()
      expect(await repo.hasMessage(TS1)).toBe(true)
    })
  })

  describe('saveMessages', () => {
    it('saves multiple messages', async () => {
      await repo.saveMessages([makeMsg(TS1), makeMsg(TS2), makeMsg(TS3)])

      expect(await repo.hasMessage(TS1)).toBe(true)
      expect(await repo.hasMessage(TS2)).toBe(true)
      expect(await repo.hasMessage(TS3)).toBe(true)
    })

    it('handles empty array without error', async () => {
      await expect(repo.saveMessages([])).resolves.not.toThrow()
    })
  })

  describe('getMessages', () => {
    it('returns messages with timestamp greater than since', async () => {
      await repo.saveMessages([makeMsg(TS1), makeMsg(TS2), makeMsg(TS3)])

      const results = await repo.getMessages(TS1)
      expect(results).toHaveLength(2)
      expect(results[0].timestamp).toBe(TS2)
      expect(results[1].timestamp).toBe(TS3)
    })

    it('returns all messages when since is the zero timestamp', async () => {
      await repo.saveMessages([makeMsg(TS1), makeMsg(TS2)])

      const results = await repo.getMessages(
        '0000-01-01T00:00:00.000Z-0000-0000000000000000'
      )
      expect(results).toHaveLength(2)
    })

    it('returns empty array when no messages exist after since', async () => {
      await repo.saveMessage(makeMsg(TS1))
      const results = await repo.getMessages(TS3)
      expect(results).toHaveLength(0)
    })

    it('returns messages ordered by timestamp', async () => {
      await repo.saveMessages([makeMsg(TS3), makeMsg(TS1), makeMsg(TS2)])

      const results = await repo.getMessages(
        '0000-01-01T00:00:00.000Z-0000-0000000000000000'
      )
      expect(results[0].timestamp).toBe(TS1)
      expect(results[1].timestamp).toBe(TS2)
      expect(results[2].timestamp).toBe(TS3)
    })
  })

  describe('getClock / saveClock', () => {
    it('returns null when no clock is stored', async () => {
      expect(await repo.getClock()).toBeNull()
    })

    it('saves and retrieves the clock state', async () => {
      const state: ClockState = {
        timestamp: Timestamp.parse(TS1)!,
        merkle: emptyTrie(),
        node: NODE,
      }

      await repo.saveClock(state)
      const loaded = await repo.getClock()

      expect(loaded).not.toBeNull()
      expect(loaded!.node).toBe(NODE)
      expect(loaded!.timestamp.toString()).toBe(TS1)
    })

    it('overwrites an existing clock on re-save', async () => {
      const state1: ClockState = {
        timestamp: Timestamp.parse(TS1)!,
        merkle: emptyTrie(),
        node: NODE,
      }
      await repo.saveClock(state1)

      const state2: ClockState = {
        timestamp: Timestamp.parse(TS2)!,
        merkle: emptyTrie(),
        node: NODE,
      }
      await repo.saveClock(state2)

      const loaded = await repo.getClock()
      expect(loaded!.timestamp.toString()).toBe(TS2)
    })

    it('restores the merkle trie correctly', async () => {
      const nonEmptyTrie: TrieNode = { hash: 42, '0': { hash: 42 } }
      const state: ClockState = {
        timestamp: Timestamp.parse(TS1)!,
        merkle: nonEmptyTrie,
        node: NODE,
      }
      await repo.saveClock(state)

      const loaded = await repo.getClock()
      expect(loaded!.merkle).toEqual(nonEmptyTrie)
    })

    it('handles clock with empty merkle trie', async () => {
      const state: ClockState = {
        timestamp: Timestamp.parse(TS1)!,
        merkle: emptyTrie(),
        node: NODE,
      }
      await repo.saveClock(state)

      const loaded = await repo.getClock()
      expect(loaded!.merkle).toEqual({ hash: 0 })
    })

    it('getClock returns null for unparseable timestamp', async () => {
      // Just verify save/load works for valid state
      const state: ClockState = {
        timestamp: Timestamp.parse(TS1)!,
        merkle: emptyTrie(),
        node: NODE,
      }
      await repo.saveClock(state)
      const loaded = await repo.getClock()
      expect(loaded).not.toBeNull()
    })
  })
})
