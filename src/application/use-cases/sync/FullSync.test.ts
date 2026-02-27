import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FullSync } from './FullSync'
import { ApplyRemoteChanges } from './ApplyRemoteChanges'
import { Clock } from '@infrastructure/sync/crdt/Clock'
import { MerkleTree } from '@infrastructure/sync/crdt/MerkleTree'
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
