import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../__tests__/createTestDb'
import { SqliteAccountRepository } from './SqliteAccountRepository'
import { Account } from '@domain/entities/Account'
import type { AppDatabase } from '../db'

describe('SqliteAccountRepository', () => {
  let repo: SqliteAccountRepository

  beforeEach(async () => {
    const db: AppDatabase = await createTestDb()
    repo = new SqliteAccountRepository(db)
  })

  it('saves and retrieves an account by id', async () => {
    const account = Account.create({ name: 'Checking' })

    await repo.save(account)
    const found = await repo.findById(account.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('Checking')
    expect(found!.id.equals(account.id)).toBe(true)
  })

  it('findAll returns only non-deleted accounts', async () => {
    const a1 = Account.create({ name: 'Checking' })
    const a2 = Account.create({ name: 'Savings' })
    a2.delete()

    await repo.save(a1)
    await repo.save(a2)

    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Checking')
  })

  it('findActive excludes closed and deleted accounts', async () => {
    const active  = Account.create({ name: 'Checking' })
    const closed  = Account.create({ name: 'Savings' })
    const deleted = Account.create({ name: 'Old' })
    closed.close()
    deleted.delete()

    await repo.save(active)
    await repo.save(closed)
    await repo.save(deleted)

    const result = await repo.findActive()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Checking')
  })

  it('updates an existing account (upsert)', async () => {
    const account = Account.create({ name: 'Checking' })
    await repo.save(account)

    account.rename('Main Checking')
    await repo.save(account)

    const found = await repo.findById(account.id)
    expect(found!.name).toBe('Main Checking')
  })

  it('soft-deletes an account (tombstone)', async () => {
    const account = Account.create({ name: 'Checking' })
    await repo.save(account)

    await repo.delete(account.id)

    const all = await repo.findAll()
    expect(all).toHaveLength(0)
  })

  it('returns null for non-existent id', async () => {
    const account = Account.create({ name: 'Ghost' })
    const found = await repo.findById(account.id)
    expect(found).toBeNull()
  })
})
