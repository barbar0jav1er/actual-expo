import { and, eq } from 'drizzle-orm'
import { EntityId, Money, BudgetMonth } from '@domain/value-objects'
import { Budget } from '@domain/entities/Budget'
import type { BudgetRepository } from '@domain/repositories/BudgetRepository'
import { zeroBudgets, createdBudgets } from '../schema'
import type { DrizzleDB } from '../types'

export class DrizzleBudgetRepository implements BudgetRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findById(id: EntityId): Promise<Budget | null> {
    const row = await (this.db as any)
      .select()
      .from(zeroBudgets)
      .where(eq(zeroBudgets.id, id.toString()))
      .get()
    return row ? this.toDomain(row) : null
  }

  async findByMonthAndCategory(
    month: BudgetMonth,
    categoryId: EntityId
  ): Promise<Budget | null> {
    const row = await (this.db as any)
      .select()
      .from(zeroBudgets)
      .where(
        and(
          eq(zeroBudgets.month, month.toNumber()),
          eq(zeroBudgets.category, categoryId.toString())
        )
      )
      .get()
    return row ? this.toDomain(row) : null
  }

  async findByMonth(month: BudgetMonth): Promise<Budget[]> {
    const rows = await (this.db as any)
      .select()
      .from(zeroBudgets)
      .where(eq(zeroBudgets.month, month.toNumber()))
      .all()
    return rows.map((r: any) => this.toDomain(r))
  }

  async save(budget: Budget): Promise<void> {
    const row = this.toPersistence(budget)
    await (this.db as any)
      .insert(zeroBudgets)
      .values(row)
      .onConflictDoUpdate({
        target: zeroBudgets.id,
        set: {
          amount:    row.amount,
          carryover: row.carryover,
          goal:      row.goal,
        },
      })
  }

  async saveMany(budgets: Budget[]): Promise<void> {
    for (const budget of budgets) {
      await this.save(budget)
    }
  }

  async delete(id: EntityId): Promise<void> {
    await (this.db as any)
      .delete(zeroBudgets)
      .where(eq(zeroBudgets.id, id.toString()))
  }

  async isMonthCreated(month: BudgetMonth): Promise<boolean> {
    const row = await (this.db as any)
      .select()
      .from(createdBudgets)
      .where(eq(createdBudgets.month, month.toNumber()))
      .get()
    return row !== undefined
  }

  async markMonthCreated(month: BudgetMonth): Promise<void> {
    await (this.db as any)
      .insert(createdBudgets)
      .values({ month: month.toNumber() })
      .onConflictDoNothing()
  }

  private toDomain(row: {
    id: string
    month: number
    category: string
    amount: number
    carryover: number
    goal: number | null
  }): Budget {
    return Budget.reconstitute({
      id:         EntityId.fromString(row.id),
      month:      BudgetMonth.fromNumber(row.month),
      categoryId: EntityId.fromString(row.category),
      budgeted:   Money.fromCents(row.amount),
      carryover:  Money.fromCents(row.carryover),
      goal:       row.goal !== null ? Money.fromCents(row.goal) : undefined,
    })
  }

  private toPersistence(budget: Budget) {
    return {
      id:        budget.id.toString(),
      month:     budget.month.toNumber(),
      category:  budget.categoryId.toString(),
      amount:    budget.budgeted.toCents(),
      carryover: budget.carryover.toCents(),
      goal:      budget.goal?.toCents() ?? null,
      longGoal:  null,
    }
  }
}
