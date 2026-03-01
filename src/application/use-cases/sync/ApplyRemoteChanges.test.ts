import { describe, it, expect, beforeEach } from 'vitest'
import { ApplyRemoteChanges, type RemoteMessage } from './ApplyRemoteChanges'
import { Account } from '@domain/entities'
import { Transaction } from '@domain/entities'
import { Category } from '@domain/entities'
import { CategoryGroup } from '@domain/entities'
import { Payee } from '@domain/entities'
import { Budget } from '@domain/entities/Budget'
import { EntityId, Money, BudgetMonth, TransactionDate } from '@domain/value-objects'
import { ValueSerializer } from '@infrastructure/sync/ValueSerializer'
import type { AccountRepository } from '@domain/repositories'
import type { TransactionRepository } from '@domain/repositories'
import type { CategoryRepository } from '@domain/repositories'
import type { CategoryGroupRepository } from '@domain/repositories'
import type { PayeeRepository } from '@domain/repositories'
import type { BudgetRepository } from '@domain/repositories'

// ─── Mock Repositories ───────────────────────────────────────────────────────

class InMemoryAccountRepository implements AccountRepository {
  public items: Account[] = []
  async findById(id: EntityId) { return this.items.find(a => a.id.equals(id)) ?? null }
  async findAll() { return this.items }
  async findActive() { return this.items.filter(a => a.isActive) }
  async save(item: Account) {
    const idx = this.items.findIndex(a => a.id.equals(item.id))
    if (idx >= 0) this.items[idx] = item
    else this.items.push(item)
  }
  async delete(id: EntityId) { this.items = this.items.filter(a => !a.id.equals(id)) }
}

class InMemoryTransactionRepository implements TransactionRepository {
  public items: Transaction[] = []
  async findById(id: EntityId) { return this.items.find(t => t.id.equals(id)) ?? null }
  async findAll() { return this.items }
  async findByAccount(accountId: EntityId) { return this.items.filter(t => t.accountId.equals(accountId)) }
  async findByDateRange() { return this.items }
  async findByMonth() { return this.items }
  async findChildren(parentId: EntityId) { return this.items.filter(t => t.id.equals(parentId)) }
  async findByCategory() { return this.items }
  async findByPayee() { return this.items }
  async saveMany(items: Transaction[]) { for (const t of items) await this.save(t) }
  async save(item: Transaction) {
    const idx = this.items.findIndex(t => t.id.equals(item.id))
    if (idx >= 0) this.items[idx] = item
    else this.items.push(item)
  }
  async delete(id: EntityId) { this.items = this.items.filter(t => !t.id.equals(id)) }
}

class InMemoryCategoryRepository implements CategoryRepository {
  public items: Category[] = []
  async findById(id: EntityId) { return this.items.find(c => c.id.equals(id)) ?? null }
  async findAll() { return this.items }
  async findActive() { return this.items.filter(c => !c.tombstone) }
  async findByGroup(groupId: EntityId) { return this.items.filter(c => c.groupId.equals(groupId)) }
  async save(item: Category) {
    const idx = this.items.findIndex(c => c.id.equals(item.id))
    if (idx >= 0) this.items[idx] = item
    else this.items.push(item)
  }
  async delete(id: EntityId) { this.items = this.items.filter(c => !c.id.equals(id)) }
}

class InMemoryCategoryGroupRepository implements CategoryGroupRepository {
  public items: CategoryGroup[] = []
  async findById(id: EntityId) { return this.items.find(g => g.id.equals(id)) ?? null }
  async findAll() { return this.items }
  async findActive() { return this.items.filter(g => !g.tombstone) }
  async save(item: CategoryGroup) {
    const idx = this.items.findIndex(g => g.id.equals(item.id))
    if (idx >= 0) this.items[idx] = item
    else this.items.push(item)
  }
  async delete(id: EntityId) { this.items = this.items.filter(g => !g.id.equals(id)) }
}

class InMemoryPayeeRepository implements PayeeRepository {
  public items: Payee[] = []
  async findById(id: EntityId) { return this.items.find(p => p.id.equals(id)) ?? null }
  async findAll() { return this.items }
  async findActive() { return this.items.filter(p => !p.tombstone) }
  async findByName(name: string) { return this.items.find(p => p.name === name) ?? null }
  async findTransferPayee() { return null }
  async save(item: Payee) {
    const idx = this.items.findIndex(p => p.id.equals(item.id))
    if (idx >= 0) this.items[idx] = item
    else this.items.push(item)
  }
  async delete(id: EntityId) { this.items = this.items.filter(p => !p.id.equals(id)) }
}

class InMemoryBudgetRepository implements BudgetRepository {
  public items: Budget[] = []
  async findById(id: EntityId) { return this.items.find(b => b.id.equals(id)) ?? null }
  async findByMonthAndCategory(month: BudgetMonth, categoryId: EntityId) {
    return this.items.find(b => b.month.equals(month) && b.categoryId.equals(categoryId)) ?? null
  }
  async findByMonth(month: BudgetMonth) { return this.items.filter(b => b.month.equals(month)) }
  async save(item: Budget) {
    const idx = this.items.findIndex(b => b.id.equals(item.id))
    if (idx >= 0) this.items[idx] = item
    else this.items.push(item)
  }
  async saveMany(budgets: Budget[]) { for (const b of budgets) await this.save(b) }
  async delete(id: EntityId) { this.items = this.items.filter(b => !b.id.equals(id)) }
  async isMonthCreated(_month: BudgetMonth) { return false }
  async markMonthCreated(_month: BudgetMonth) { /* noop */ }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMsg(
  dataset: string,
  row: string,
  column: string,
  value: unknown,
  timestamp = '2024-01-01T00:00:00.000Z-0000-node'
): RemoteMessage {
  return { timestamp, dataset, row, column, value: ValueSerializer.serialize(value) }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ApplyRemoteChanges — zero_budgets', () => {
  let budgetRepo: InMemoryBudgetRepository
  let useCase: ApplyRemoteChanges

  const rowId = '11111111-1111-1111-1111-111111111111'
  const catId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const month = 202401 // January 2024

  beforeEach(() => {
    budgetRepo = new InMemoryBudgetRepository()
    useCase = new ApplyRemoteChanges(
      new InMemoryAccountRepository(),
      new InMemoryTransactionRepository(),
      new InMemoryCategoryRepository(),
      new InMemoryCategoryGroupRepository(),
      new InMemoryPayeeRepository(),
      budgetRepo
    )
  })

  it('creates a new budget row from month + category + amount messages', async () => {
    await useCase.execute({
      messages: [
        makeMsg('zero_budgets', rowId, 'month',    month,  '2024-01-01T00:00:00.000Z-0001-node'),
        makeMsg('zero_budgets', rowId, 'category', catId,  '2024-01-01T00:00:00.000Z-0002-node'),
        makeMsg('zero_budgets', rowId, 'amount',   5000,   '2024-01-01T00:00:00.000Z-0003-node'),
      ],
    })

    expect(budgetRepo.items).toHaveLength(1)
    const saved = budgetRepo.items[0]
    expect(saved.id.toString()).toBe(rowId)
    expect(saved.month.toNumber()).toBe(month)
    expect(saved.categoryId.toString()).toBe(catId)
    expect(saved.budgeted.toCents()).toBe(5000)
    expect(saved.carryover.toCents()).toBe(0)
    expect(saved.goal).toBeUndefined()
  })

  it('updates budgeted amount on an existing budget row', async () => {
    // Pre-populate the repo with an existing budget
    const existingId = EntityId.fromString(rowId)
    const existing = Budget.reconstitute({
      id: existingId,
      month: BudgetMonth.fromNumber(month),
      categoryId: EntityId.fromString(catId),
      budgeted: Money.fromCents(1000),
      carryover: Money.zero(),
      goal: undefined,
    })
    await budgetRepo.save(existing)

    await useCase.execute({
      messages: [
        makeMsg('zero_budgets', rowId, 'amount', 9999, '2024-01-01T00:00:00.000Z-0001-node'),
      ],
    })

    expect(budgetRepo.items).toHaveLength(1)
    expect(budgetRepo.items[0].budgeted.toCents()).toBe(9999)
  })

  it('skips creating a budget when month is missing', async () => {
    await useCase.execute({
      messages: [
        makeMsg('zero_budgets', rowId, 'category', catId, '2024-01-01T00:00:00.000Z-0001-node'),
        makeMsg('zero_budgets', rowId, 'amount',   5000,  '2024-01-01T00:00:00.000Z-0002-node'),
      ],
    })

    expect(budgetRepo.items).toHaveLength(0)
  })

  it('skips creating a budget when category is missing', async () => {
    await useCase.execute({
      messages: [
        makeMsg('zero_budgets', rowId, 'month',  month, '2024-01-01T00:00:00.000Z-0001-node'),
        makeMsg('zero_budgets', rowId, 'amount', 5000,  '2024-01-01T00:00:00.000Z-0002-node'),
      ],
    })

    expect(budgetRepo.items).toHaveLength(0)
  })

  it('sets goal to undefined when goal message value is null', async () => {
    const existingId = EntityId.fromString(rowId)
    const existing = Budget.reconstitute({
      id: existingId,
      month: BudgetMonth.fromNumber(month),
      categoryId: EntityId.fromString(catId),
      budgeted: Money.fromCents(1000),
      carryover: Money.zero(),
      goal: Money.fromCents(5000),
    })
    await budgetRepo.save(existing)

    await useCase.execute({
      messages: [
        makeMsg('zero_budgets', rowId, 'goal', null, '2024-01-01T00:00:00.000Z-0001-node'),
      ],
    })

    expect(budgetRepo.items[0].goal).toBeUndefined()
  })

  it('sets goal when goal message has a numeric value', async () => {
    await useCase.execute({
      messages: [
        makeMsg('zero_budgets', rowId, 'month',    month, '2024-01-01T00:00:00.000Z-0001-node'),
        makeMsg('zero_budgets', rowId, 'category', catId, '2024-01-01T00:00:00.000Z-0002-node'),
        makeMsg('zero_budgets', rowId, 'amount',   2000,  '2024-01-01T00:00:00.000Z-0003-node'),
        makeMsg('zero_budgets', rowId, 'goal',     7500,  '2024-01-01T00:00:00.000Z-0004-node'),
      ],
    })

    expect(budgetRepo.items[0].goal?.toCents()).toBe(7500)
  })

  it('updates carryover on an existing budget row', async () => {
    const existing = Budget.reconstitute({
      id: EntityId.fromString(rowId),
      month: BudgetMonth.fromNumber(month),
      categoryId: EntityId.fromString(catId),
      budgeted: Money.fromCents(1000),
      carryover: Money.zero(),
      goal: undefined,
    })
    await budgetRepo.save(existing)

    await useCase.execute({
      messages: [
        makeMsg('zero_budgets', rowId, 'carryover', 300, '2024-01-01T00:00:00.000Z-0001-node'),
      ],
    })

    expect(budgetRepo.items[0].carryover.toCents()).toBe(300)
  })
})
