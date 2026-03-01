import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApplyRemoteChanges, type RemoteMessage } from './ApplyRemoteChanges'

// ─── Mock SQLiteDatabase ──────────────────────────────────────────────────────

function makeDb() {
  return {
    getFirstSync: vi.fn(),
    runSync: vi.fn(),
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMsg(
  dataset: string,
  row: string,
  column: string,
  value: string,
  timestamp = '2024-01-01T00:00:00.000Z-0000-abc123def4567890',
): RemoteMessage {
  return { timestamp, dataset, row, column, value }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ApplyRemoteChanges', () => {
  let db: ReturnType<typeof makeDb>
  let useCase: ApplyRemoteChanges

  beforeEach(() => {
    db = makeDb()
    useCase = new ApplyRemoteChanges(db as any)
  })

  it('inserts a new row when none exists', async () => {
    db.getFirstSync.mockReturnValue(null)

    await useCase.execute({
      messages: [makeMsg('accounts', 'row-001', 'name', 'S:Checking')],
    })

    // New behaviour: INSERT OR IGNORE with NOT NULL defaults merged with actual value
    const call = db.runSync.mock.calls[0]
    expect(call[0]).toContain('INSERT OR IGNORE INTO "accounts"')
    expect(call[1]).toContain('row-001')
    expect(call[1]).toContain('Checking')
  })

  it('updates an existing row', async () => {
    db.getFirstSync.mockReturnValue({ id: 'row-001' })

    await useCase.execute({
      messages: [makeMsg('accounts', 'row-001', 'name', 'S:Savings')],
    })

    expect(db.runSync).toHaveBeenCalledWith(
      'UPDATE "accounts" SET "name" = ? WHERE id = ?',
      ['Savings', 'row-001'],
    )
  })

  it('deserializes null values correctly', async () => {
    db.getFirstSync.mockReturnValue({ id: 'row-001' })

    await useCase.execute({
      messages: [makeMsg('transactions', 'row-001', 'notes', '0:')],
    })

    expect(db.runSync).toHaveBeenCalledWith(
      'UPDATE "transactions" SET "notes" = ? WHERE id = ?',
      [null, 'row-001'],
    )
  })

  it('deserializes numeric values correctly', async () => {
    db.getFirstSync.mockReturnValue(null)

    await useCase.execute({
      messages: [makeMsg('transactions', 'row-001', 'amount', 'N:5000')],
    })

    // New behaviour: INSERT OR IGNORE with all NOT NULL defaults; amount overrides the default 0
    const call = db.runSync.mock.calls[0]
    expect(call[0]).toContain('INSERT OR IGNORE INTO "transactions"')
    expect(call[1]).toContain('row-001')
    expect(call[1]).toContain(5000)
  })

  it('skips prefs dataset', async () => {
    await useCase.execute({
      messages: [makeMsg('prefs', 'budgetType', 'value', 'S:envelope')],
    })

    expect(db.getFirstSync).not.toHaveBeenCalled()
    expect(db.runSync).not.toHaveBeenCalled()
  })

  it('sorts messages by timestamp before applying', async () => {
    db.getFirstSync.mockReturnValue({ id: 'row-001' })

    const calls: string[] = []
    db.runSync.mockImplementation((_sql: string, params: unknown[]) => {
      calls.push(params[0] as string)
    })

    await useCase.execute({
      messages: [
        makeMsg('accounts', 'row-001', 'name', 'S:Second', '2024-01-01T00:00:00.002Z-0000-abc123def4567890'),
        makeMsg('accounts', 'row-001', 'name', 'S:First',  '2024-01-01T00:00:00.001Z-0000-abc123def4567890'),
      ],
    })

    expect(calls).toEqual(['First', 'Second'])
  })

  it('continues processing after a per-message error', async () => {
    db.getFirstSync
      .mockReturnValueOnce(null) // first message: insert will throw
      .mockReturnValueOnce(null) // second message: insert succeeds

    db.runSync
      .mockImplementationOnce(() => { throw new Error('constraint') })
      .mockImplementationOnce(() => {})

    await expect(
      useCase.execute({
        messages: [
          makeMsg('accounts', 'bad-row', 'name', 'S:Bad'),
          makeMsg('accounts', 'ok-row', 'name', 'S:Good'),
        ],
      }),
    ).resolves.not.toThrow()

    // Second insert was attempted despite first failing
    expect(db.runSync).toHaveBeenCalledTimes(2)
  })
})
