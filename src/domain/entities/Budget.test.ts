import { describe, it, expect } from 'vitest'
import { Budget } from './Budget'
import { EntityId, Money, BudgetMonth } from '../value-objects'

function makeMonth() { return BudgetMonth.fromString('2024-02') }
function makeCategoryId() { return EntityId.create() }

describe('Budget entity', () => {
  it('creates with zero budgeted by default', () => {
    const budget = Budget.create({ month: makeMonth(), categoryId: makeCategoryId() })
    expect(budget.budgeted.toCents()).toBe(0)
    expect(budget.carryover.toCents()).toBe(0)
  })

  it('getAvailable = budgeted + carryover - |spent|', () => {
    const budget = Budget.create({
      month: makeMonth(),
      categoryId: makeCategoryId(),
      budgeted: Money.fromCents(50000),
    })
    const spent = Money.fromCents(-30000)
    expect(budget.getAvailable(spent).toCents()).toBe(20000)
  })

  it('getAvailable with carryover', () => {
    const budget = Budget.create({
      month: makeMonth(),
      categoryId: makeCategoryId(),
      budgeted: Money.fromCents(30000),
    })
    budget.setCarryover(Money.fromCents(10000))
    const spent = Money.fromCents(-20000)
    expect(budget.getAvailable(spent).toCents()).toBe(20000) // 30k + 10k - 20k
  })

  it('isOverBudget returns true when spent > budgeted + carryover', () => {
    const budget = Budget.create({
      month: makeMonth(),
      categoryId: makeCategoryId(),
      budgeted: Money.fromCents(10000),
    })
    expect(budget.isOverBudget(Money.fromCents(-15000))).toBe(true)
    expect(budget.isOverBudget(Money.fromCents(-5000))).toBe(false)
  })

  it('getOverspent returns the overage amount', () => {
    const budget = Budget.create({
      month: makeMonth(),
      categoryId: makeCategoryId(),
      budgeted: Money.fromCents(10000),
    })
    expect(budget.getOverspent(Money.fromCents(-15000)).toCents()).toBe(5000)
    expect(budget.getOverspent(Money.fromCents(-5000)).toCents()).toBe(0)
  })

  it('hasGoal returns false when no goal set', () => {
    const budget = Budget.create({ month: makeMonth(), categoryId: makeCategoryId() })
    expect(budget.hasGoal()).toBe(false)
  })

  it('getGoalProgress clamps to 1 when available >= goal', () => {
    const budget = Budget.create({
      month: makeMonth(),
      categoryId: makeCategoryId(),
      budgeted: Money.fromCents(50000),
    })
    budget.setGoal(Money.fromCents(30000))
    expect(budget.getGoalProgress(Money.fromCents(0))).toBe(1)
  })

  it('getGoalProgress is proportional', () => {
    const budget = Budget.create({
      month: makeMonth(),
      categoryId: makeCategoryId(),
      budgeted: Money.fromCents(50000),
    })
    budget.setGoal(Money.fromCents(100000))
    expect(budget.getGoalProgress(Money.fromCents(0))).toBeCloseTo(0.5)
  })

  it('setBudgeted updates the amount', () => {
    const budget = Budget.create({ month: makeMonth(), categoryId: makeCategoryId() })
    budget.setBudgeted(Money.fromCents(25000))
    expect(budget.budgeted.toCents()).toBe(25000)
  })
})
