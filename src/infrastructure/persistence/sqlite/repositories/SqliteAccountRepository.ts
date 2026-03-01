import type { Account } from '@domain/entities/Account'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { AccountRepository } from '@domain/repositories/AccountRepository'
import { AccountMapper } from '../mappers/AccountMapper'
import type { AppDatabase } from '../db'

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: EntityId): Promise<Account | null> {
    const row = await this.db.first(
      'SELECT * FROM accounts WHERE id = ?',
      [id.toString()],
    )
    return row ? AccountMapper.toDomain(row as any) : null
  }

  async findAll(): Promise<Account[]> {
    const rows = await this.db.all(
      'SELECT * FROM accounts WHERE tombstone = 0 ORDER BY sort_order, id',
    )
    return rows.map(r => AccountMapper.toDomain(r as any))
  }

  async findActive(): Promise<Account[]> {
    const rows = await this.db.all(
      'SELECT * FROM accounts WHERE tombstone = 0 AND closed = 0 ORDER BY sort_order, id',
    )
    return rows.map(r => AccountMapper.toDomain(r as any))
  }

  async save(account: Account): Promise<void> {
    const r = AccountMapper.toPersistence(account)
    await this.db.run(
      `INSERT INTO accounts (id, name, offbudget, closed, sort_order, tombstone)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name      = excluded.name,
         offbudget = excluded.offbudget,
         closed    = excluded.closed,
         sort_order = excluded.sort_order,
         tombstone = excluded.tombstone`,
      [r.id, r.name, r.offbudget, r.closed, r.sort_order, r.tombstone],
    )
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'UPDATE accounts SET tombstone = 1 WHERE id = ?',
      [id.toString()],
    )
  }
}
