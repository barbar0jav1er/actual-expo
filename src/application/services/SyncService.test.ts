import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CrdtSyncService } from './SyncService'
import { setClock, makeClock, Timestamp } from '@loot-core/crdt/timestamp'
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
  beforeEach(() => {
    // Initialize the loot-core global clock so Timestamp.send() works
    setClock(makeClock(new Timestamp(0, 0, 'a1b2c3d4e5f6a7b8')))
  })

  it('generates one message per field with correct shape', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(repo as any)

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
    const service = new CrdtSyncService(repo as any)

    await service.trackChanges([
      { table: 'accounts', row: 'r1', data: { a: 1, b: 2, c: 3 } },
    ])

    const saved: StoredMessage[] = repo.saveMessages.mock.calls[0][0]
    const timestamps = saved.map(m => m.timestamp)
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] >= timestamps[i - 1]).toBe(true)
    }
    expect(new Set(timestamps).size).toBe(timestamps.length)
  })

  it('does NOT save clock to DB', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(repo as any)

    await service.trackChanges([
      { table: 'accounts', row: 'r1', data: { name: 'Test' } },
    ])

    expect(repo.saveClock).not.toHaveBeenCalled()
  })

  it('generates timestamps in loot-core UPPERCASE counter format', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(repo as any)

    await service.trackChanges([
      { table: 'accounts', row: 'r1', data: { name: 'Test' } },
    ])

    const saved: StoredMessage[] = repo.saveMessages.mock.calls[0][0]
    // loot-core format: 2024-01-01T00:00:00.000Z-0001-nodexxxxxxxxxxxxxxx
    // only the counter is uppercase hex; node preserves its original case
    const ts = saved[0].timestamp
    const parts = ts.split('-')
    expect(parts).toHaveLength(5) // ISO date has 2 dashes + counter + node = 5 parts
    const counter = parts[3]
    expect(counter).toBe(counter.toUpperCase())
  })

  it('handles multiple entity changes in a single call', async () => {
    const repo = makeRepo()
    const service = new CrdtSyncService(repo as any)

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
