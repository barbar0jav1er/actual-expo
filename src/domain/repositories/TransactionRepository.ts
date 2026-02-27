import { Transaction } from '../entities'
import { EntityId, TransactionDate, BudgetMonth } from '../value-objects'

export interface TransactionRepository {
  findById(id: EntityId): Promise<Transaction | null>
  findByAccount(accountId: EntityId): Promise<Transaction[]>
  findByDateRange(
    start: TransactionDate,
    end: TransactionDate
  ): Promise<Transaction[]>
  findByMonth(month: BudgetMonth): Promise<Transaction[]>
  findChildren(parentId: EntityId): Promise<Transaction[]>
  findByCategory(categoryId: EntityId): Promise<Transaction[]>
  findAll(): Promise<Transaction[]>
  findByPayee(payeeId: EntityId): Promise<Transaction[]>
  save(transaction: Transaction): Promise<void>
  saveMany(transactions: Transaction[]): Promise<void>
  delete(id: EntityId): Promise<void>
}
