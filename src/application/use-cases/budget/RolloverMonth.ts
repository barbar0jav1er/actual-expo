import { Money, BudgetMonth } from '@domain/value-objects'
import type { BudgetRepository } from '@domain/repositories/BudgetRepository'
import type { TransactionRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface RolloverMonthInput {
  month: string // YYYY-MM — the month whose leftover carries forward
}

export class RolloverMonth {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: RolloverMonthInput): Promise<void> {
    const month     = BudgetMonth.fromString(input.month)
    const nextMonth = month.next()

    const [budgets, transactions] = await Promise.all([
      this.budgetRepo.findByMonth(month),
      this.transactionRepo.findByMonth(month),
    ])

    const spentByCategory = new Map<string, Money>()
    for (const tx of transactions) {
      if (tx.tombstone || !tx.categoryId || tx.isParent) continue
      const key     = tx.categoryId.toString()
      const current = spentByCategory.get(key) ?? Money.zero()
      spentByCategory.set(key, current.add(tx.amount))
    }

    const syncChanges: Array<{ table: string; row: string; data: Record<string, string | number | null> }> = []

    for (const budget of budgets) {
      const spent     = spentByCategory.get(budget.categoryId.toString()) ?? Money.zero()
      const available = budget.getAvailable(spent)

      // Only carry over positive leftover
      const carryover = available.isPositive() ? available : Money.zero()

      if (carryover.isZero()) continue

      let nextBudget = await this.budgetRepo.findByMonthAndCategory(
        nextMonth,
        budget.categoryId
      )

      if (nextBudget) {
        nextBudget.setCarryover(carryover)
      } else {
        const { Budget } = await import('@domain/entities/Budget')
        nextBudget = Budget.create({ month: nextMonth, categoryId: budget.categoryId })
        nextBudget.setCarryover(carryover)
      }

      await this.budgetRepo.save(nextBudget)

      syncChanges.push({
        table: 'zero_budgets',
        row:   nextBudget.id.toString(),
        data: {
          id:        nextBudget.id.toString(),
          month:     nextBudget.month.toNumber(),
          category:  nextBudget.categoryId.toString(),
          amount:    nextBudget.budgeted.toCents(),
          carryover: carryover.toCents(),
          goal:      nextBudget.goal?.toCents() ?? null,
        },
      })
    }

    if (syncChanges.length > 0) {
      await this.syncService.trackChanges(syncChanges)
    }
  }
}
