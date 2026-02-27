import { and, eq, gte, lte } from 'drizzle-orm'
import type { Transaction } from '@domain/entities/Transaction'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { TransactionDate } from '@domain/value-objects/TransactionDate'
import type { BudgetMonth } from '@domain/value-objects/BudgetMonth'
import type { TransactionRepository } from '@domain/repositories/TransactionRepository'
import { transactions } from '../schema'
import { TransactionMapper } from '../mappers/TransactionMapper'
import type { DrizzleDB } from '../types'

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: EntityId): Promise<Transaction | null> {
    const row = await (this.db as any)
      .select()
      .from(transactions)
      .where(eq(transactions.id, id.toString()))
      .get()
    return row ? TransactionMapper.toDomain(row) : null
  }

  async findByAccount(accountId: EntityId): Promise<Transaction[]> {
    const rows = await (this.db as any)
      .select()
      .from(transactions)
      .where(and(eq(transactions.acct, accountId.toString()), eq(transactions.tombstone, 0)))
      .orderBy(transactions.date, transactions.sortOrder)
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async findByDateRange(start: TransactionDate, end: TransactionDate): Promise<Transaction[]> {
    const rows = await (this.db as any)
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, start.toNumber()),
          lte(transactions.date, end.toNumber()),
          eq(transactions.tombstone, 0),
        ),
      )
      .orderBy(transactions.date)
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async findByMonth(month: BudgetMonth): Promise<Transaction[]> {
    const startDate = month.toNumber() * 100 + 1  // YYYYMM01
    const endDate   = month.toNumber() * 100 + 31 // YYYYMM31
    const rows = await (this.db as any)
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          eq(transactions.tombstone, 0),
        ),
      )
      .orderBy(transactions.date)
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async findByCategory(categoryId: EntityId): Promise<Transaction[]> {
    const rows = await (this.db as any)
      .select()
      .from(transactions)
      .where(and(eq(transactions.category, categoryId.toString()), eq(transactions.tombstone, 0)))
      .orderBy(transactions.date)
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async findByPayee(payeeId: EntityId): Promise<Transaction[]> {
    const rows = await (this.db as any)
      .select()
      .from(transactions)
      .where(and(eq(transactions.description, payeeId.toString()), eq(transactions.tombstone, 0)))
      .orderBy(transactions.date)
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async findChildren(parentId: EntityId): Promise<Transaction[]> {
    const rows = await (this.db as any)
      .select()
      .from(transactions)
      .where(and(eq(transactions.parentId, parentId.toString()), eq(transactions.tombstone, 0)))
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async save(tx: Transaction): Promise<void> {
    const row = TransactionMapper.toPersistence(tx)
    await (this.db as any)
      .insert(transactions)
      .values(row)
      .onConflictDoUpdate({ target: transactions.id, set: row })
  }

  async saveMany(txs: Transaction[]): Promise<void> {
    for (const tx of txs) {
      await this.save(tx)
    }
  }

  async delete(id: EntityId): Promise<void> {
    await (this.db as any)
      .update(transactions)
      .set({ tombstone: 1 })
      .where(eq(transactions.id, id.toString()))
  }
}
