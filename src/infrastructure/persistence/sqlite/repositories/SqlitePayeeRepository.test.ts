import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../__tests__/createTestDb'
import { SqlitePayeeRepository } from './SqlitePayeeRepository'
import { SqliteAccountRepository } from './SqliteAccountRepository'
import { Payee } from '@domain/entities/Payee'
import { Account } from '@domain/entities/Account'
import type { AppDatabase } from '../db'

describe('SqlitePayeeRepository', () => {
  let repo: SqlitePayeeRepository
  let accountRepo: SqliteAccountRepository

  beforeEach(async () => {
    const db: AppDatabase = await createTestDb()
    repo = new SqlitePayeeRepository(db)
    accountRepo = new SqliteAccountRepository(db)
  })

  it('saves and retrieves a payee', async () => {
    const payee = Payee.create({ name: 'Amazon' })

    await repo.save(payee)
    const found = await repo.findById(payee.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('Amazon')
  })

  it('findAll excludes deleted payees', async () => {
    const p1 = Payee.create({ name: 'Amazon' })
    const p2 = Payee.create({ name: 'Old' })
    p2.delete()

    await repo.save(p1)
    await repo.save(p2)

    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Amazon')
  })

  it('findByName returns a payee by name', async () => {
    const payee = Payee.create({ name: 'Amazon' })
    await repo.save(payee)

    const found = await repo.findByName('Amazon')
    expect(found).not.toBeNull()
    expect(found!.id.equals(payee.id)).toBe(true)
  })

  it('findByName returns null when not found', async () => {
    const found = await repo.findByName('Nobody')
    expect(found).toBeNull()
  })

  it('findTransferPayee returns the payee linked to an account', async () => {
    const account = Account.create({ name: 'Savings' })
    await accountRepo.save(account)

    const payee = Payee.createTransferPayee({ name: 'Transfer: Savings', accountId: account.id })
    await repo.save(payee)

    const found = await repo.findTransferPayee(account.id)
    expect(found).not.toBeNull()
    expect(found!.isTransferPayee).toBe(true)
  })

  it('updates a payee (upsert)', async () => {
    const payee = Payee.create({ name: 'Amazon' })
    await repo.save(payee)

    payee.rename('Amazon Prime')
    await repo.save(payee)

    const found = await repo.findById(payee.id)
    expect(found!.name).toBe('Amazon Prime')
  })

  it('soft-deletes a payee', async () => {
    const payee = Payee.create({ name: 'Amazon' })
    await repo.save(payee)

    await repo.delete(payee.id)

    const all = await repo.findAll()
    expect(all).toHaveLength(0)
  })
})
