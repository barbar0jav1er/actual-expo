import { Budget } from '@domain/entities/Budget'
import { BudgetMonth } from '@domain/value-objects'
import type { BudgetRepository } from '@domain/repositories/BudgetRepository'
import type { SyncService } from '@application/services/SyncService'

export interface CopyBudgetMonthInput {
  fromMonth: string // YYYY-MM
  toMonth: string   // YYYY-MM
}

export class CopyBudgetMonth {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: CopyBudgetMonthInput): Promise<void> {
    const fromMonth = BudgetMonth.fromString(input.fromMonth)
    const toMonth   = BudgetMonth.fromString(input.toMonth)

    const sourceBudgets = await this.budgetRepo.findByMonth(fromMonth)

    const newBudgets = sourceBudgets.map(source =>
      Budget.create({
        month:      toMonth,
        categoryId: source.categoryId,
        budgeted:   source.budgeted,
      })
    )

    await this.budgetRepo.saveMany(newBudgets)
    await this.budgetRepo.markMonthCreated(toMonth)

    await this.syncService.trackChanges(
      newBudgets.map(b => ({
        table: 'zero_budgets',
        row:   b.id.toString(),
        data: {
          id:        b.id.toString(),
          month:     b.month.toNumber(),
          category:  b.categoryId.toString(),
          amount:    b.budgeted.toCents(),
          carryover: b.carryover.toCents(),
          goal:      b.goal?.toCents() ?? null,
        },
      }))
    )
  }
}
