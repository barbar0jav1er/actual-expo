import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../__tests__/createTestDb'
import { DrizzleBudgetRepository } from './DrizzleBudgetRepository'
import { DrizzleCategoryGroupRepository } from './DrizzleCategoryGroupRepository'
import { DrizzleCategoryRepository } from './DrizzleCategoryRepository'
import { Budget } from '@domain/entities/Budget'
import { CategoryGroup } from '@domain/entities/CategoryGroup'
import { Category } from '@domain/entities/Category'
import { EntityId, Money, BudgetMonth } from '@domain/value-objects'

describe('DrizzleBudgetRepository', () => {
  let repo: DrizzleBudgetRepository
  let categoryId: EntityId
  const month = BudgetMonth.fromString('2024-02')

  beforeEach(async () => {
    const db = createTestDb()
    repo = new DrizzleBudgetRepository(db as any)

    // Create prerequisite category and group (FK constraint)
    const groupRepo = new DrizzleCategoryGroupRepository(db as any)
    const catRepo   = new DrizzleCategoryRepository(db as any)

    const group    = CategoryGroup.create({ name: 'Expenses' })
    const category = Category.create({ name: 'Groceries', groupId: group.id })
    await groupRepo.save(group)
    await catRepo.save(category)
    categoryId = category.id
  })

  it('saves and retrieves a budget by id', async () => {
    const budget = Budget.create({
      month,
      categoryId,
      budgeted: Money.fromCents(50000),
    })
    await repo.save(budget)

    const found = await repo.findById(budget.id)
    expect(found).not.toBeNull()
    expect(found!.budgeted.toCents()).toBe(50000)
    expect(found!.month.equals(month)).toBe(true)
  })

  it('findByMonthAndCategory returns the correct budget', async () => {
    const budget = Budget.create({ month, categoryId, budgeted: Money.fromCents(30000) })
    await repo.save(budget)

    const found = await repo.findByMonthAndCategory(month, categoryId)
    expect(found).not.toBeNull()
    expect(found!.budgeted.toCents()).toBe(30000)
  })

  it('findByMonthAndCategory returns null when not found', async () => {
    const found = await repo.findByMonthAndCategory(month, EntityId.create())
    expect(found).toBeNull()
  })

  it('findByMonth returns all budgets for that month', async () => {
    const b1 = Budget.create({ month, categoryId, budgeted: Money.fromCents(10000) })
    await repo.save(b1)

    const results = await repo.findByMonth(month)
    expect(results).toHaveLength(1)
  })

  it('save performs upsert by id', async () => {
    const budget = Budget.create({ month, categoryId, budgeted: Money.fromCents(10000) })
    await repo.save(budget)

    budget.setBudgeted(Money.fromCents(25000))
    await repo.save(budget)

    const found = await repo.findById(budget.id)
    expect(found!.budgeted.toCents()).toBe(25000)
  })

  it('saves and retrieves carryover and goal', async () => {
    const budget = Budget.create({ month, categoryId })
    budget.setCarryover(Money.fromCents(5000))
    budget.setGoal(Money.fromCents(100000))
    await repo.save(budget)

    const found = await repo.findById(budget.id)
    expect(found!.carryover.toCents()).toBe(5000)
    expect(found!.goal?.toCents()).toBe(100000)
  })

  it('isMonthCreated returns false initially', async () => {
    expect(await repo.isMonthCreated(month)).toBe(false)
  })

  it('markMonthCreated sets month as created', async () => {
    await repo.markMonthCreated(month)
    expect(await repo.isMonthCreated(month)).toBe(true)
  })

  it('markMonthCreated is idempotent', async () => {
    await repo.markMonthCreated(month)
    await repo.markMonthCreated(month) // should not throw
    expect(await repo.isMonthCreated(month)).toBe(true)
  })
})
