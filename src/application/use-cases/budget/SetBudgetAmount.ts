import { Budget } from '@domain/entities/Budget'
import { EntityId, Money, BudgetMonth } from '@domain/value-objects'
import type { BudgetRepository } from '@domain/repositories/BudgetRepository'
import type { SyncService } from '@application/services/SyncService'

export interface SetBudgetAmountInput {
  month: string      // YYYY-MM
  categoryId: string
  amount: number     // cents
}

export class SetBudgetAmount {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: SetBudgetAmountInput): Promise<void> {
    const month      = BudgetMonth.fromString(input.month)
    const categoryId = EntityId.fromString(input.categoryId)
    const amount     = Money.fromCents(input.amount)

    let budget = await this.budgetRepo.findByMonthAndCategory(month, categoryId)

    if (budget) {
      budget.setBudgeted(amount)
    } else {
      budget = Budget.create({ month, categoryId, budgeted: amount })
    }

    await this.budgetRepo.save(budget)

    await this.syncService.trackChanges([{
      table: 'zero_budgets',
      row:   budget.id.toString(),
      data: {
        id:        budget.id.toString(),
        month:     budget.month.toNumber(),
        category:  budget.categoryId.toString(),
        amount:    budget.budgeted.toCents(),
        carryover: budget.carryover.toCents(),
        goal:      budget.goal?.toCents() ?? null,
      },
    }])
  }
}
