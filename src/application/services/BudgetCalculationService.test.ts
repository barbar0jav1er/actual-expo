import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetCalculationService } from './BudgetCalculationService'
import { Budget } from '@domain/entities/Budget'
import { Account, Transaction, Category, CategoryGroup } from '@domain/entities'
import { EntityId, Money, BudgetMonth, TransactionDate } from '@domain/value-objects'

function makeGroup(name: string, isIncome = false) {
  return CategoryGroup.create({ name, isIncome })
}

function makeCategory(name: string, groupId: EntityId, isIncome = false) {
  return Category.create({ name, groupId, isIncome })
}

function makeTx(accountId: EntityId, amount: number, date: string, categoryId?: EntityId) {
  return Transaction.create({
    accountId,
    amount: Money.fromCents(amount),
    date: TransactionDate.fromString(date),
    categoryId,
  })
}

describe('BudgetCalculationService', () => {
  let service: BudgetCalculationService
  const month = BudgetMonth.fromString('2024-02')
  let accountId: EntityId

  beforeEach(() => {
    service = new BudgetCalculationService()
    accountId = EntityId.create()
  })

  it('calculates available correctly', () => {
    const group    = makeGroup('Expenses')
    const category = makeCategory('Groceries', group.id)
    const budget   = Budget.create({
      month,
      categoryId: category.id,
      budgeted: Money.fromCents(50000),
    })
    const txs = [
      makeTx(accountId, -30000, '2024-02-15', category.id),
    ]

    const summary = service.calculateMonthSummary(month, [budget], [category], [group], txs)

    const catBudget = summary.groups[0]?.categories[0]
    expect(catBudget?.available).toBe(20000)
    expect(catBudget?.spent).toBe(-30000)
    expect(catBudget?.budgeted).toBe(50000)
    expect(catBudget?.isOverBudget).toBe(false)
  })

  it('detects overspending', () => {
    const group    = makeGroup('Expenses')
    const category = makeCategory('Dining', group.id)
    const budget   = Budget.create({
      month,
      categoryId: category.id,
      budgeted: Money.fromCents(10000),
    })
    const txs = [makeTx(accountId, -15000, '2024-02-10', category.id)]

    const summary = service.calculateMonthSummary(month, [budget], [category], [group], txs)

    const catBudget = summary.groups[0]?.categories[0]
    expect(catBudget?.isOverBudget).toBe(true)
    expect(catBudget?.available).toBe(-5000)
    expect(summary.overspent).toBe(5000)
  })

  it('calculates income from income categories only', () => {
    const incomeGroup    = makeGroup('Income', true)
    const incomeCategory = makeCategory('Salary', incomeGroup.id, true)
    const expGroup       = makeGroup('Expenses')
    const expCategory    = makeCategory('Rent', expGroup.id)

    const txs = [
      makeTx(accountId, 300000, '2024-02-01', incomeCategory.id),  // income
      makeTx(accountId, -100000, '2024-02-05', expCategory.id),     // expense
    ]

    const summary = service.calculateMonthSummary(
      month,
      [],
      [incomeCategory, expCategory],
      [incomeGroup, expGroup],
      txs
    )

    expect(summary.income).toBe(300000)
  })

  it('calculates toBeBudgeted as income - totalBudgeted', () => {
    const incomeGroup    = makeGroup('Income', true)
    const incomeCategory = makeCategory('Salary', incomeGroup.id, true)
    const expGroup       = makeGroup('Expenses')
    const expCategory    = makeCategory('Rent', expGroup.id)
    const budget         = Budget.create({
      month,
      categoryId: expCategory.id,
      budgeted: Money.fromCents(100000),
    })
    const txs = [makeTx(accountId, 300000, '2024-02-01', incomeCategory.id)]

    const summary = service.calculateMonthSummary(
      month,
      [budget],
      [incomeCategory, expCategory],
      [incomeGroup, expGroup],
      txs
    )

    expect(summary.toBeBudgeted).toBe(200000) // 300k income - 100k budgeted
  })

  it('includes carryover in available calculation', () => {
    const group    = makeGroup('Expenses')
    const category = makeCategory('Groceries', group.id)
    const budget   = Budget.create({
      month,
      categoryId: category.id,
      budgeted: Money.fromCents(20000),
    })
    budget.setCarryover(Money.fromCents(10000))

    const summary = service.calculateMonthSummary(month, [budget], [category], [group], [])

    const catBudget = summary.groups[0]?.categories[0]
    expect(catBudget?.available).toBe(30000) // 20k + 10k carryover
    expect(catBudget?.carryover).toBe(10000)
  })

  it('skips income categories from group budgets', () => {
    const incomeGroup    = makeGroup('Income', true)
    const incomeCategory = makeCategory('Salary', incomeGroup.id, true)

    const summary = service.calculateMonthSummary(
      month,
      [],
      [incomeCategory],
      [incomeGroup],
      []
    )

    // Income groups should not appear in expense groups
    expect(summary.groups).toHaveLength(0)
  })
})
