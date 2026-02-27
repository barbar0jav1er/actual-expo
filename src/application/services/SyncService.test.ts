import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CrdtSyncService } from './SyncService'
import { Clock } from '@infrastructure/sync/crdt/Clock'
import { MerkleTree } from '@infrastructure/sync/crdt/MerkleTree'
import { ValueSerializer } from '@infrastructure/sync/ValueSerializer'
import type { StoredMessage } from '@infrastructure/sync/repositories/SQLiteSyncRepository'

const makeRepo = () => ({
  saveMessages: vi.fn().mockResolvedValue(undefined),
  saveClock: vi.fn().mockResolvedValue(undefined),
  getMessages: vi.fn().mockResolvedValue([]),
  saveMessage: vi.fn().mockResolvedValue(undefined),
  hasMessage: vi.fn().mockResolvedValue(false),
  getClock: vi.fn().mockResolvedValue(null),
})

describe('CrdtSyncService.trackChanges', () => {
  let clock: Clock
  let initialMerkle: ReturnType<typeof MerkleTree.emptyTrie>

  beforeEach(() => {
    clock = Clock.initialize('a1b2c3d4e5f6a7b8')
    initialMerkle = clock.getMerkle()
  })

  it('generates one message per field with correct shape', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(clock, repo as any)

    await service.trackChanges([
      {
        table: 'accounts',
        row: 'row-uuid-1',
        data: { name: 'Checking', offbudget: 0 },
      },
    ])

    expect(repo.saveMessages).toHaveBeenCalledOnce()
    const saved: StoredMessage[] = repo.saveMessages.mock.calls[0][0]
    expect(saved).toHaveLength(2)

    const nameMsg = saved.find(m => m.column === 'name')!
    expect(nameMsg.dataset).toBe('accounts')
    expect(nameMsg.row).toBe('row-uuid-1')
    expect(nameMsg.value).toBe(ValueSerializer.serialize('Checking'))

    const offbudgetMsg = saved.find(m => m.column === 'offbudget')!
    expect(offbudgetMsg.value).toBe(ValueSerializer.serialize(0))
  })

  it('assigns monotonically increasing timestamps across fields', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(clock, repo as any)

    await service.trackChanges([
      { table: 'accounts', row: 'r1', data: { a: 1, b: 2, c: 3 } },
    ])

    const saved: StoredMessage[] = repo.saveMessages.mock.calls[0][0]
    const timestamps = saved.map(m => m.timestamp)
    // Each timestamp must be >= the previous one
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] >= timestamps[i - 1]).toBe(true)
    }
    // All timestamps must be unique
    expect(new Set(timestamps).size).toBe(timestamps.length)
  })

  it('does NOT save clock to DB', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(clock, repo as any)

    await service.trackChanges([
      { table: 'accounts', row: 'r1', data: { name: 'Test' } },
    ])

    expect(repo.saveClock).not.toHaveBeenCalled()
  })

  it('does NOT mutate the clock Merkle', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(clock, repo as any)

    await service.trackChanges([
      { table: 'accounts', row: 'r1', data: { name: 'Test', offbudget: 0 } },
    ])

    // Merkle should be identical to what it was before trackChanges
    expect(clock.getMerkle()).toEqual(initialMerkle)
  })

  it('handles multiple entity changes in a single call', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(clock, repo as any)

    await service.trackChanges([
      { table: 'accounts', row: 'acc-1', data: { name: 'Savings', offbudget: 0 } },
      { table: 'payees', row: 'pay-1', data: { name: 'Transfer: Savings', transfer_acct: 'acc-1' } },
    ])

    const saved: StoredMessage[] = repo.saveMessages.mock.calls[0][0]
    expect(saved).toHaveLength(4)
    expect(saved.filter(m => m.dataset === 'accounts')).toHaveLength(2)
    expect(saved.filter(m => m.dataset === 'payees')).toHaveLength(2)
  })
})
