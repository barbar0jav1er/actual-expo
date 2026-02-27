import type { EntityId, BudgetMonth } from '../value-objects'
import type { Budget } from '../entities/Budget'

export interface BudgetRepository {
  findById(id: EntityId): Promise<Budget | null>
  findByMonthAndCategory(month: BudgetMonth, categoryId: EntityId): Promise<Budget | null>
  findByMonth(month: BudgetMonth): Promise<Budget[]>
  save(budget: Budget): Promise<void>
  saveMany(budgets: Budget[]): Promise<void>
  delete(id: EntityId): Promise<void>
  isMonthCreated(month: BudgetMonth): Promise<boolean>
  markMonthCreated(month: BudgetMonth): Promise<void>
}
