import { Money, BudgetMonth } from '@domain/value-objects'
import type { BudgetRepository } from '@domain/repositories/BudgetRepository'
import type { CategoryRepository, CategoryGroupRepository, TransactionRepository } from '@domain/repositories'
import type { BudgetCalculationService } from '@application/services/BudgetCalculationService'
import type { MonthBudgetSummaryDTO } from '@application/dtos/BudgetDTO'

export interface GetBudgetSummaryInput {
  month: string // YYYY-MM
}

export interface GetBudgetSummaryOutput {
  summary: MonthBudgetSummaryDTO
}

export class GetBudgetSummary {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly calculationService: BudgetCalculationService
  ) {}

  async execute(input: GetBudgetSummaryInput): Promise<GetBudgetSummaryOutput> {
    const month = BudgetMonth.fromString(input.month)

    const [budgets, categories, groups, transactions] = await Promise.all([
      this.budgetRepo.findByMonth(month),
      this.categoryRepo.findAll(),
      this.categoryGroupRepo.findAll(),
      this.transactionRepo.findByMonth(month),
    ])

    const prevCarryover = await this.calculatePreviousCarryover(month)

    const summary = this.calculationService.calculateMonthSummary(
      month,
      budgets,
      categories.filter(c => !c.tombstone),
      groups.filter(g => !g.tombstone),
      transactions.filter(t => !t.tombstone),
      prevCarryover
    )

    return { summary }
  }

  private async calculatePreviousCarryover(month: BudgetMonth): Promise<Money> {
    const prevMonth = month.previous()
    const [prevBudgets, prevCategories, prevGroups, prevTransactions] = await Promise.all([
      this.budgetRepo.findByMonth(prevMonth),
      this.categoryRepo.findAll(),
      this.categoryGroupRepo.findAll(),
      this.transactionRepo.findByMonth(prevMonth),
    ])

    const categories = prevCategories.filter(c => !c.tombstone && !c.isIncome)
    const groups     = prevGroups.filter(g => !g.tombstone)

    let toBeBudgeted = Money.zero()

    for (const cat of categories) {
      const budget    = prevBudgets.find(b => b.categoryId.equals(cat.id))
      const spent     = prevTransactions
        .filter(t => !t.tombstone && !t.isParent && t.categoryId?.equals(cat.id))
        .reduce((sum, t) => sum.add(t.amount), Money.zero())
      const available = (budget?.budgeted ?? Money.zero())
        .add(budget?.carryover ?? Money.zero())
        .subtract(spent.abs())

      if (available.isPositive()) {
        toBeBudgeted = toBeBudgeted.add(available)
      }
    }

    return toBeBudgeted
  }
}
