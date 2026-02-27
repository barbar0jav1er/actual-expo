import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FullSync } from './FullSync'
import { ApplyRemoteChanges } from './ApplyRemoteChanges'
import { Clock } from '@infrastructure/sync/crdt/Clock'
import { MerkleTree } from '@infrastructure/sync/crdt/MerkleTree'
import type { TrieNode } from '@infrastructure/sync/crdt/MerkleTree'
import type { SyncRepository, StoredMessage } from '@infrastructure/sync/repositories/SQLiteSyncRepository'
import type { ClockState } from '@infrastructure/sync/crdt/Clock'

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
    const emptyMerkle = MerkleTree.serialize(MerkleTree.emptyTrie())

    const mockEncoder = { encode: vi.fn().mockReturnValue(new Uint8Array()) }
    const mockDecoder = {
      decode: vi.fn().mockReturnValue({
        messages: [],
        merkle: MerkleTree.emptyTrie(),
      }),
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
      decode: vi.fn().mockReturnValue({
        messages: [],
        merkle: MerkleTree.emptyTrie(),
      }),
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
    const syncClock = Clock.initialize('a1b2c3d4e5f6a7b8')
    syncRepo.clockState = syncClock.getState()

    // Local message created after the last sync (CrdtSyncService saved it but did NOT update DB clock)
    const localMessage: StoredMessage = {
      timestamp: '2026-01-02T10:00:00.000Z-0000-a1b2c3d4e5f6a7b8',
      dataset: 'accounts',
      row: '00000000-0000-4000-8000-000000000099',
      column: 'name',
      value: 'S:My Account',
    }
    syncRepo.messages = [localMessage]

    // Server's Merkle after absorbing our message (non-zero, distinct from emptyTrie)
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

    // Must converge in two iterations
    expect(result.success).toBe(true)
    // Our local message is NOT "new" — we already have it
    expect(result.messagesReceived).toBe(0)
    // applyRemoteChanges never called (nothing new to apply)
    expect(applyRemoteChanges.execute).not.toHaveBeenCalled()
    // Two sync requests: iter 1 (send local msg) + iter 2 (confirm convergence)
    expect(mockEndpoints.sync).toHaveBeenCalledTimes(2)
    // Saved clock Merkle should now be the server's updated Merkle
    expect(syncRepo.clockState?.merkle).toEqual(serverMerkleAfterSync)
  })

  it('should call applyRemoteChanges when remote messages received', async () => {
    const remoteMessages = [
      {
        timestamp: '2024-02-26T12:00:00.000Z-0000-abc123def4567890',
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
        .mockReturnValueOnce({ messages: remoteMessages, merkle: MerkleTree.emptyTrie() })
        .mockReturnValue({ messages: [], merkle: MerkleTree.emptyTrie() }),
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
