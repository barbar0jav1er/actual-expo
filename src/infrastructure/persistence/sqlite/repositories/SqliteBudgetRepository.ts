import { Budget } from '@domain/entities/Budget'
import { EntityId, Money, BudgetMonth } from '@domain/value-objects'
import type { BudgetRepository } from '@domain/repositories/BudgetRepository'
import type { AppDatabase } from '../db'

interface BudgetRow {
  id: string
  month: number | null
  category: string | null
  amount: number | null
  carryover: number | null
  goal: number | null
}

export class SqliteBudgetRepository implements BudgetRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: EntityId): Promise<Budget | null> {
    const row = await this.db.first<BudgetRow>(
      'SELECT * FROM zero_budgets WHERE id = ?',
      [id.toString()],
    )
    return row ? this.toDomain(row) : null
  }

  async findByMonthAndCategory(month: BudgetMonth, categoryId: EntityId): Promise<Budget | null> {
    const row = await this.db.first<BudgetRow>(
      'SELECT * FROM zero_budgets WHERE month = ? AND category = ?',
      [month.toNumber(), categoryId.toString()],
    )
    return row ? this.toDomain(row) : null
  }

  async findByMonth(month: BudgetMonth): Promise<Budget[]> {
    const rows = await this.db.all<BudgetRow>(
      'SELECT * FROM zero_budgets WHERE month = ?',
      [month.toNumber()],
    )
    return rows.map(r => this.toDomain(r))
  }

  async save(budget: Budget): Promise<void> {
    await this.db.run(
      `INSERT INTO zero_budgets (id, month, category, amount, carryover, goal)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         amount    = excluded.amount,
         carryover = excluded.carryover,
         goal      = excluded.goal`,
      [
        budget.id.toString(),
        budget.month.toNumber(),
        budget.categoryId.toString(),
        budget.budgeted.toCents(),
        budget.carryover.toCents(),
        budget.goal?.toCents() ?? null,
      ],
    )
  }

  async saveMany(budgets: Budget[]): Promise<void> {
    for (const b of budgets) {
      await this.save(b)
    }
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'DELETE FROM zero_budgets WHERE id = ?',
      [id.toString()],
    )
  }

  async isMonthCreated(month: BudgetMonth): Promise<boolean> {
    const row = await this.db.first(
      'SELECT month FROM created_budgets WHERE month = ?',
      [month.toNumber()],
    )
    return row !== null
  }

  async markMonthCreated(month: BudgetMonth): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO created_budgets (month) VALUES (?)',
      [month.toNumber()],
    )
  }

  private toDomain(row: BudgetRow): Budget {
    return Budget.reconstitute({
      id:         EntityId.fromString(row.id),
      month:      BudgetMonth.fromNumber(row.month ?? 0),
      categoryId: EntityId.fromString(row.category ?? ''),
      budgeted:   Money.fromCents(row.amount ?? 0),
      carryover:  Money.fromCents(row.carryover ?? 0),
      goal:       row.goal !== null && row.goal !== undefined ? Money.fromCents(row.goal) : undefined,
    })
  }
}
