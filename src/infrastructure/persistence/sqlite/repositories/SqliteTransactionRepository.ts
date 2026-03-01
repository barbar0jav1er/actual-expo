import type { Transaction } from '@domain/entities/Transaction'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { TransactionDate } from '@domain/value-objects/TransactionDate'
import type { BudgetMonth } from '@domain/value-objects/BudgetMonth'
import type { TransactionRepository } from '@domain/repositories/TransactionRepository'
import { TransactionMapper } from '../mappers/TransactionMapper'
import type { AppDatabase } from '../db'

export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: EntityId): Promise<Transaction | null> {
    const row = await this.db.first(
      'SELECT * FROM transactions WHERE id = ?',
      [id.toString()],
    )
    return row ? TransactionMapper.toDomain(row as any) : null
  }

  async findByAccount(accountId: EntityId): Promise<Transaction[]> {
    const rows = await this.db.all(
      'SELECT * FROM transactions WHERE acct = ? AND tombstone = 0 ORDER BY date DESC, sort_order DESC, id',
      [accountId.toString()],
    )
    return rows.map(r => TransactionMapper.toDomain(r as any))
  }

  async findByDateRange(start: TransactionDate, end: TransactionDate): Promise<Transaction[]> {
    const rows = await this.db.all(
      'SELECT * FROM transactions WHERE date >= ? AND date <= ? AND tombstone = 0 ORDER BY date DESC',
      [start.toNumber(), end.toNumber()],
    )
    return rows.map(r => TransactionMapper.toDomain(r as any))
  }

  async findByMonth(month: BudgetMonth): Promise<Transaction[]> {
    const m = month.toNumber()
    const start = m * 100 + 1
    const end   = m * 100 + 31
    const rows = await this.db.all(
      'SELECT * FROM transactions WHERE date >= ? AND date <= ? AND tombstone = 0 ORDER BY date DESC',
      [start, end],
    )
    return rows.map(r => TransactionMapper.toDomain(r as any))
  }

  async findAll(): Promise<Transaction[]> {
    const rows = await this.db.all(
      'SELECT * FROM transactions WHERE tombstone = 0 ORDER BY date DESC, sort_order DESC, id',
    )
    return rows.map(r => TransactionMapper.toDomain(r as any))
  }

  async findByCategory(categoryId: EntityId): Promise<Transaction[]> {
    const rows = await this.db.all(
      'SELECT * FROM transactions WHERE category = ? AND tombstone = 0 ORDER BY date DESC',
      [categoryId.toString()],
    )
    return rows.map(r => TransactionMapper.toDomain(r as any))
  }

  async findByPayee(payeeId: EntityId): Promise<Transaction[]> {
    const rows = await this.db.all(
      'SELECT * FROM transactions WHERE description = ? AND tombstone = 0 ORDER BY date DESC',
      [payeeId.toString()],
    )
    return rows.map(r => TransactionMapper.toDomain(r as any))
  }

  async findChildren(parentId: EntityId): Promise<Transaction[]> {
    const rows = await this.db.all(
      'SELECT * FROM transactions WHERE parent_id = ? AND tombstone = 0',
      [parentId.toString()],
    )
    return rows.map(r => TransactionMapper.toDomain(r as any))
  }

  async save(tx: Transaction): Promise<void> {
    const r = TransactionMapper.toPersistence(tx)
    await this.db.run(
      `INSERT INTO transactions
         (id, acct, category, amount, description, notes, date,
          cleared, reconciled, tombstone, isParent, isChild, parent_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         acct        = excluded.acct,
         category    = excluded.category,
         amount      = excluded.amount,
         description = excluded.description,
         notes       = excluded.notes,
         date        = excluded.date,
         cleared     = excluded.cleared,
         reconciled  = excluded.reconciled,
         tombstone   = excluded.tombstone,
         isParent    = excluded.isParent,
         isChild     = excluded.isChild,
         parent_id   = excluded.parent_id,
         sort_order  = excluded.sort_order`,
      [
        r.id, r.acct, r.category, r.amount, r.description, r.notes, r.date,
        r.cleared, r.reconciled, r.tombstone, r.isParent, r.isChild, r.parent_id, r.sort_order,
      ],
    )
  }

  async saveMany(txs: Transaction[]): Promise<void> {
    for (const tx of txs) {
      await this.save(tx)
    }
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'UPDATE transactions SET tombstone = 1 WHERE id = ?',
      [id.toString()],
    )
  }
}
