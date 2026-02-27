import { describe, it, expect, beforeEach } from 'vitest'
import { SetBudgetAmount } from './SetBudgetAmount'
import { Budget } from '@domain/entities/Budget'
import { EntityId, Money, BudgetMonth } from '@domain/value-objects'
import type { BudgetRepository } from '@domain/repositories/BudgetRepository'
import type { SyncService, EntityChange } from '@application/services/SyncService'

class InMemoryBudgetRepository implements BudgetRepository {
  public budgets: Budget[] = []
  public createdMonths = new Set<number>()

  async findById(id: EntityId) {
    return this.budgets.find(b => b.id.equals(id)) ?? null
  }
  async findByMonthAndCategory(month: BudgetMonth, categoryId: EntityId) {
    return this.budgets.find(
      b => b.month.equals(month) && b.categoryId.equals(categoryId)
    ) ?? null
  }
  async findByMonth(month: BudgetMonth) {
    return this.budgets.filter(b => b.month.equals(month))
  }
  async save(budget: Budget) {
    const idx = this.budgets.findIndex(b => b.id.equals(budget.id))
    if (idx >= 0) this.budgets[idx] = budget
    else this.budgets.push(budget)
  }
  async saveMany(budgets: Budget[]) {
    for (const b of budgets) await this.save(b)
  }
  async delete(id: EntityId) {
    this.budgets = this.budgets.filter(b => !b.id.equals(id))
  }
  async isMonthCreated(month: BudgetMonth) {
    return this.createdMonths.has(month.toNumber())
  }
  async markMonthCreated(month: BudgetMonth) {
    this.createdMonths.add(month.toNumber())
  }
}

class MockSyncService implements SyncService {
  public trackedChanges: EntityChange[] = []
  async trackChanges(changes: EntityChange[]) { this.trackedChanges.push(...changes) }
}

describe('SetBudgetAmount', () => {
  let budgetRepo: InMemoryBudgetRepository
  let syncService: MockSyncService
  let useCase: SetBudgetAmount
  const categoryId = EntityId.create().toString()
  const month = '2024-02'

  beforeEach(() => {
    budgetRepo  = new InMemoryBudgetRepository()
    syncService = new MockSyncService()
    useCase     = new SetBudgetAmount(budgetRepo, syncService)
  })

  it('creates a new budget when none exists', async () => {
    await useCase.execute({ month, categoryId, amount: 50000 })

    expect(budgetRepo.budgets).toHaveLength(1)
    expect(budgetRepo.budgets[0].budgeted.toCents()).toBe(50000)
  })

  it('updates an existing budget', async () => {
    await useCase.execute({ month, categoryId, amount: 50000 })
    await useCase.execute({ month, categoryId, amount: 75000 })

    expect(budgetRepo.budgets).toHaveLength(1)
    expect(budgetRepo.budgets[0].budgeted.toCents()).toBe(75000)
  })

  it('tracks changes for sync', async () => {
    await useCase.execute({ month, categoryId, amount: 50000 })

    expect(syncService.trackedChanges).toHaveLength(1)
    expect(syncService.trackedChanges[0].table).toBe('zero_budgets')
    expect(syncService.trackedChanges[0].data['amount']).toBe(50000)
  })

  it('allows setting amount to zero', async () => {
    await useCase.execute({ month, categoryId, amount: 50000 })
    await useCase.execute({ month, categoryId, amount: 0 })

    expect(budgetRepo.budgets[0].budgeted.toCents()).toBe(0)
  })
})
