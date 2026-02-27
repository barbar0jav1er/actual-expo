import { and, eq } from 'drizzle-orm'
import type { Account } from '@domain/entities/Account'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { AccountRepository } from '@domain/repositories/AccountRepository'
import { accounts } from '../schema'
import { AccountMapper } from '../mappers/AccountMapper'
import type { DrizzleDB } from '../types'

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: EntityId): Promise<Account | null> {
    const row = await (this.db as any)
      .select()
      .from(accounts)
      .where(eq(accounts.id, id.toString()))
      .get()
    return row ? AccountMapper.toDomain(row) : null
  }

  async findAll(): Promise<Account[]> {
    const rows = await (this.db as any)
      .select()
      .from(accounts)
      .where(eq(accounts.tombstone, 0))
      .orderBy(accounts.sortOrder)
      .all()
    return rows.map(AccountMapper.toDomain)
  }

  async findActive(): Promise<Account[]> {
    const rows = await (this.db as any)
      .select()
      .from(accounts)
      .where(and(eq(accounts.tombstone, 0), eq(accounts.closed, 0)))
      .orderBy(accounts.sortOrder)
      .all()
    return rows.map(AccountMapper.toDomain)
  }

  async save(account: Account): Promise<void> {
    const row = AccountMapper.toPersistence(account)
    await (this.db as any)
      .insert(accounts)
      .values(row)
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          name:      row.name,
          offbudget: row.offbudget,
          closed:    row.closed,
          sortOrder: row.sortOrder,
          tombstone: row.tombstone,
        },
      })
  }

  async delete(id: EntityId): Promise<void> {
    await (this.db as any)
      .update(accounts)
      .set({ tombstone: 1 })
      .where(eq(accounts.id, id.toString()))
  }
}
