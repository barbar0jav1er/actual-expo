import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FullSync } from './FullSync'
import { ApplyRemoteChanges } from './ApplyRemoteChanges'
import { Timestamp } from '@domain/value-objects'
import type { TrieNode } from '@loot-core/crdt/merkle'
import type { SyncRepository, StoredMessage, ClockState } from '@infrastructure/sync/repositories/SQLiteSyncRepository'

const emptyTrie = (): TrieNode => ({ hash: 0 })

class MockSyncRepository implements SyncRepository {
  public messages: StoredMessage[] = []
  public clockState: ClockState | null = null

  async getMessages(since: string): Promise<StoredMessage[]> {
    return this.messages.filter(m => m.timestamp > since)
  }

  async saveMessage(message: StoredMessage): Promise<void> {
    this.messages.push(message)
  }

  async saveMessages(messages: StoredMessage[]): Promise<void> {
    this.messages.push(...messages)
  }

  async hasMessage(timestamp: string): Promise<boolean> {
    return this.messages.some(m => m.timestamp === timestamp)
  }

  async getClock(): Promise<ClockState | null> {
    return this.clockState
  }

  async saveClock(clock: ClockState): Promise<void> {
    this.clockState = clock
  }
}

const makeEmptyApplyRemoteChanges = () =>
  ({
    execute: vi.fn().mockResolvedValue(undefined),
  }) as unknown as ApplyRemoteChanges

describe('FullSync', () => {
  let syncRepo: MockSyncRepository
  let applyRemoteChanges: ApplyRemoteChanges
  const fileId = 'test-file-id'
  const groupId = 'test-group-id'

  beforeEach(() => {
    syncRepo = new MockSyncRepository()
    applyRemoteChanges = makeEmptyApplyRemoteChanges()
  })

  it('should initialize clock if none exists', async () => {
    const mockEncoder = { encode: vi.fn().mockReturnValue(new Uint8Array()) }
    const mockDecoder = {
      decode: vi.fn().mockReturnValue({ messages: [], merkle: emptyTrie() }),
    }
    const mockEndpoints = { sync: vi.fn().mockResolvedValue(new Uint8Array()) }

    const fullSync = new FullSync(
      syncRepo,
      mockEndpoints as any,
      mockEncoder as any,
      mockDecoder as any,
      applyRemoteChanges,
      fileId,
      groupId
    )

    await fullSync.execute()

    expect(syncRepo.clockState).not.toBeNull()
  })

  it('should return zero messages when in sync', async () => {
    const mockEncoder = { encode: vi.fn().mockReturnValue(new Uint8Array()) }
    const mockDecoder = {
      decode: vi.fn().mockReturnValue({ messages: [], merkle: emptyTrie() }),
    }
    const mockEndpoints = { sync: vi.fn().mockResolvedValue(new Uint8Array()) }

    const fullSync = new FullSync(
      syncRepo,
      mockEndpoints as any,
      mockEncoder as any,
      mockDecoder as any,
      applyRemoteChanges,
      fileId,
      groupId
    )

    const result = await fullSync.execute()

    expect(result.messagesReceived).toBe(0)
    expect(result.messagesSent).toBe(0)
    expect(result.success).toBe(true)
  })

  it('should converge after sending pending local messages to server', async () => {
    // Simulate a previous FullSync: clock saved with emptyTrie (hash=0) so since=epoch
    syncRepo.clockState = {
      timestamp: Timestamp.create(0, 0, 'a1b2c3d4e5f6a7b8'),
      merkle: emptyTrie(),
      node: 'a1b2c3d4e5f6a7b8',
    }

    // Local message created after the last sync (CrdtSyncService saved it)
    const localMessage: StoredMessage = {
      timestamp: '2026-01-02T10:00:00.000Z-0000-A1B2C3D4E5F6A7B8',
      dataset: 'accounts',
      row: '00000000-0000-4000-8000-000000000099',
      column: 'name',
      value: 'S:My Account',
    }
    syncRepo.messages = [localMessage]

    // Server's Merkle after absorbing our message
    const serverMerkleAfterSync: TrieNode = { hash: 42 }

    const mockEncoder = { encode: vi.fn().mockReturnValue(new Uint8Array()) }
    const mockDecoder = {
      decode: vi.fn()
        // Iter 1: server absorbed our message, echoes it back + returns updated Merkle
        .mockReturnValueOnce({ messages: [localMessage], merkle: serverMerkleAfterSync })
        // Iter 2: nothing new — same Merkle → converged
        .mockReturnValue({ messages: [], merkle: serverMerkleAfterSync }),
    }
    const mockEndpoints = { sync: vi.fn().mockResolvedValue(new Uint8Array()) }

    const fullSync = new FullSync(
      syncRepo,
      mockEndpoints as any,
      mockEncoder as any,
      mockDecoder as any,
      applyRemoteChanges,
      fileId,
      groupId
    )

    const result = await fullSync.execute()

    expect(result.success).toBe(true)
    expect(result.messagesReceived).toBe(0)
    expect(applyRemoteChanges.execute).not.toHaveBeenCalled()
    expect(mockEndpoints.sync).toHaveBeenCalledTimes(2)
    expect(syncRepo.clockState?.merkle).toEqual(serverMerkleAfterSync)
  })

  it('should call applyRemoteChanges when remote messages received', async () => {
    const remoteMessages = [
      {
        timestamp: '2024-02-26T12:00:00.000Z-0000-ABC123DEF4567890',
        dataset: 'accounts',
        row: '00000000-0000-4000-8000-000000000001',
        column: 'name',
        value: 'S:Checking',
        isEncrypted: false,
      },
    ]

    const mockEncoder = { encode: vi.fn().mockReturnValue(new Uint8Array()) }
    const mockDecoder = {
      decode: vi.fn()
        .mockReturnValueOnce({ messages: remoteMessages, merkle: emptyTrie() })
        .mockReturnValue({ messages: [], merkle: emptyTrie() }),
    }
    const mockEndpoints = { sync: vi.fn().mockResolvedValue(new Uint8Array()) }

    const fullSync = new FullSync(
      syncRepo,
      mockEndpoints as any,
      mockEncoder as any,
      mockDecoder as any,
      applyRemoteChanges,
      fileId,
      groupId
    )

    const result = await fullSync.execute()

    expect(result.messagesReceived).toBe(1)
    expect(applyRemoteChanges.execute).toHaveBeenCalledWith({
      messages: remoteMessages,
    })
  })
})
