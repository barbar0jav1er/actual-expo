import { Money } from '@domain/value-objects'
import type { BudgetMonth } from '@domain/value-objects'
import type { Budget, Category, CategoryGroup, Transaction } from '@domain/entities'
import type {
  MonthBudgetSummaryDTO,
  GroupBudgetDTO,
  CategoryBudgetDTO,
} from '@application/dtos/BudgetDTO'

export class BudgetCalculationService {
  calculateMonthSummary(
    month: BudgetMonth,
    budgets: Budget[],
    categories: Category[],
    groups: CategoryGroup[],
    transactions: Transaction[],
    previousCarryover: Money = Money.zero()
  ): MonthBudgetSummaryDTO {
    const spentByCategory = this.calculateSpentByCategory(transactions)
    const income = this.calculateIncome(transactions, categories)

    const groupMap = new Map(groups.map(g => [g.id.toString(), g]))

    const categoryBudgets: CategoryBudgetDTO[] = []
    let totalBudgeted  = Money.zero()
    let totalSpent     = Money.zero()
    let totalAvailable = Money.zero()
    let totalOverspent = Money.zero()

    for (const category of categories) {
      if (category.isIncome) continue

      const budget    = budgets.find(b => b.categoryId.equals(category.id))
      const spent     = spentByCategory.get(category.id.toString()) ?? Money.zero()
      const budgeted  = budget?.budgeted ?? Money.zero()
      const carryover = budget?.carryover ?? Money.zero()
      const available = budgeted.add(carryover).subtract(spent.abs())
      const group     = groupMap.get(category.groupId.toString())

      categoryBudgets.push({
        categoryId:   category.id.toString(),
        categoryName: category.name,
        groupId:      category.groupId.toString(),
        groupName:    group?.name ?? 'Unknown',
        budgeted:     budgeted.toCents(),
        spent:        spent.toCents(),
        available:    available.toCents(),
        carryover:    carryover.toCents(),
        goal:         budget?.goal?.toCents(),
        goalProgress: budget?.hasGoal() ? budget.getGoalProgress(spent) : undefined,
        isOverBudget: available.isNegative(),
      })

      totalBudgeted  = totalBudgeted.add(budgeted)
      totalSpent     = totalSpent.add(spent.abs())
      totalAvailable = totalAvailable.add(available.isNegative() ? Money.zero() : available)
      if (available.isNegative()) {
        totalOverspent = totalOverspent.add(available.abs())
      }
    }

    const groupBudgets = this.groupByCategory(categoryBudgets, groups)
    const toBeBudgeted = income.add(previousCarryover).subtract(totalBudgeted)

    return {
      month:          month.toString(),
      income:         income.toCents(),
      toBeBudgeted:   toBeBudgeted.toCents(),
      totalBudgeted:  totalBudgeted.toCents(),
      totalSpent:     totalSpent.toCents(),
      totalAvailable: totalAvailable.toCents(),
      overspent:      totalOverspent.toCents(),
      groups:         groupBudgets,
    }
  }

  private calculateSpentByCategory(transactions: Transaction[]): Map<string, Money> {
    const result = new Map<string, Money>()

    for (const tx of transactions) {
      if (tx.tombstone || !tx.categoryId || tx.isParent) continue

      const key     = tx.categoryId.toString()
      const current = result.get(key) ?? Money.zero()
      result.set(key, current.add(tx.amount))
    }

    return result
  }

  private calculateIncome(transactions: Transaction[], categories: Category[]): Money {
    const incomeCategories = new Set(
      categories.filter(c => c.isIncome).map(c => c.id.toString())
    )

    return transactions
      .filter(tx =>
        !tx.tombstone &&
        !tx.isParent &&
        tx.categoryId &&
        incomeCategories.has(tx.categoryId.toString())
      )
      .reduce((sum, tx) => sum.add(tx.amount), Money.zero())
  }

  private groupByCategory(
    categoryBudgets: CategoryBudgetDTO[],
    groups: CategoryGroup[]
  ): GroupBudgetDTO[] {
    const groupMap = new Map<string, CategoryBudgetDTO[]>()
    for (const cat of categoryBudgets) {
      if (!groupMap.has(cat.groupId)) groupMap.set(cat.groupId, [])
      groupMap.get(cat.groupId)!.push(cat)
    }

    return groups
      .filter(g => !g.isIncome && !g.tombstone)
      .map(group => {
        const cats = groupMap.get(group.id.toString()) ?? []
        return {
          groupId:   group.id.toString(),
          groupName: group.name,
          budgeted:  cats.reduce((s, c) => s + c.budgeted, 0),
          spent:     cats.reduce((s, c) => s + c.spent, 0),
          available: cats.reduce((s, c) => s + c.available, 0),
          categories: cats,
        }
      })
  }
}
