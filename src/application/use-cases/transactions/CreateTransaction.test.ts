import { describe, it, expect, beforeEach } from 'vitest'
import { CreateTransaction } from './CreateTransaction'
import { Account, Transaction, Category, Payee } from '@domain/entities'
import { EntityId, TransactionDate } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { AccountRepository, TransactionRepository, CategoryRepository, PayeeRepository } from '@domain/repositories'
import type { SyncService, EntityChange } from '@application/services/SyncService'

class InMemoryAccountRepository implements AccountRepository {
  public accounts: Account[] = []
  async findById(id: EntityId) { return this.accounts.find(a => a.id.equals(id)) ?? null }
  async findAll() { return this.accounts.filter(a => !a.tombstone) }
  async findActive() { return this.accounts.filter(a => a.isActive) }
  async save(account: Account) {
    const idx = this.accounts.findIndex(a => a.id.equals(account.id))
    if (idx >= 0) this.accounts[idx] = account
    else this.accounts.push(account)
  }
  async delete(id: EntityId) { this.accounts = this.accounts.filter(a => !a.id.equals(id)) }
}

class InMemoryTransactionRepository implements TransactionRepository {
  public transactions: Transaction[] = []
  async findById(id: EntityId) { return this.transactions.find(t => t.id.equals(id)) ?? null }
  async findByAccount(accountId: EntityId) { return this.transactions.filter(t => t.accountId.equals(accountId) && !t.tombstone) }
  async findByDateRange(start: TransactionDate, end: TransactionDate) {
    return this.transactions.filter(t => !t.tombstone && !t.date.isBefore(start) && !t.date.isAfter(end))
  }
  async findByMonth(month: import('@domain/value-objects').BudgetMonth) {
    return this.transactions.filter(t => !t.tombstone && t.date.getBudgetMonth().equals(month))
  }
  async findChildren(parentId: EntityId) { return this.transactions.filter(t => t.parentId?.equals(parentId)) }
  async findByCategory(categoryId: EntityId) { return this.transactions.filter(t => t.categoryId?.equals(categoryId)) }
  async findAll() { return this.transactions.filter(t => !t.tombstone) }
  async findByPayee(payeeId: EntityId) { return this.transactions.filter(t => t.payeeId?.equals(payeeId)) }
  async save(tx: Transaction) {
    const idx = this.transactions.findIndex(t => t.id.equals(tx.id))
    if (idx >= 0) this.transactions[idx] = tx
    else this.transactions.push(tx)
  }
  async saveMany(txs: Transaction[]) { for (const tx of txs) await this.save(tx) }
  async delete(id: EntityId) { this.transactions = this.transactions.filter(t => !t.id.equals(id)) }
}

class InMemoryCategoryRepository implements CategoryRepository {
  public categories: Category[] = []
  async findById(id: EntityId) { return this.categories.find(c => c.id.equals(id)) ?? null }
  async findAll() { return this.categories.filter(c => !c.tombstone) }
  async findByGroup(groupId: EntityId) { return this.categories.filter(c => c.groupId.equals(groupId)) }
  async findActive() { return this.categories.filter(c => c.isActive) }
  async save(cat: Category) {
    const idx = this.categories.findIndex(c => c.id.equals(cat.id))
    if (idx >= 0) this.categories[idx] = cat
    else this.categories.push(cat)
  }
  async delete(id: EntityId) { this.categories = this.categories.filter(c => !c.id.equals(id)) }
}

class InMemoryPayeeRepository implements PayeeRepository {
  public payees: Payee[] = []
  async findById(id: EntityId) { return this.payees.find(p => p.id.equals(id)) ?? null }
  async findAll() { return this.payees.filter(p => !p.tombstone) }
  async findActive() { return this.payees.filter(p => p.isActive) }
  async findByName(name: string) { return this.payees.find(p => p.name === name && !p.tombstone) ?? null }
  async findTransferPayee(accountId: EntityId) { return this.payees.find(p => p.transferAccountId?.equals(accountId)) ?? null }
  async save(payee: Payee) {
    const idx = this.payees.findIndex(p => p.id.equals(payee.id))
    if (idx >= 0) this.payees[idx] = payee
    else this.payees.push(payee)
  }
  async delete(id: EntityId) { this.payees = this.payees.filter(p => !p.id.equals(id)) }
}

class MockSyncService implements SyncService {
  public trackedChanges: EntityChange[] = []
  async trackChanges(changes: EntityChange[]) { this.trackedChanges.push(...changes) }
}

describe('CreateTransaction', () => {
  let useCase: CreateTransaction
  let transactionRepo: InMemoryTransactionRepository
  let accountRepo: InMemoryAccountRepository
  let categoryRepo: InMemoryCategoryRepository
  let payeeRepo: InMemoryPayeeRepository
  let syncService: MockSyncService
  let testAccount: Account

  beforeEach(() => {
    transactionRepo = new InMemoryTransactionRepository()
    accountRepo = new InMemoryAccountRepository()
    categoryRepo = new InMemoryCategoryRepository()
    payeeRepo = new InMemoryPayeeRepository()
    syncService = new MockSyncService()

    testAccount = Account.create({ name: 'Checking' })
    accountRepo.accounts.push(testAccount)

    useCase = new CreateTransaction(
      transactionRepo,
      accountRepo,
      categoryRepo,
      payeeRepo,
      syncService
    )
  })

  it('should create a basic transaction', async () => {
    const result = await useCase.execute({
      accountId: testAccount.id.toString(),
      amount: -5000,
      date: '2024-02-26',
    })

    expect(result.transaction.amount).toBe(-5000)
    expect(result.transaction.date).toBe('2024-02-26')
    expect(result.transaction.accountName).toBe('Checking')
    expect(result.transaction.cleared).toBe(false)
    expect(transactionRepo.transactions).toHaveLength(1)
  })

  it('should track changes for sync', async () => {
    await useCase.execute({
      accountId: testAccount.id.toString(),
      amount: -5000,
      date: '2024-02-26',
    })

    expect(syncService.trackedChanges).toHaveLength(1)
    expect(syncService.trackedChanges[0].table).toBe('transactions')
  })

  it('should throw NotFoundError if account does not exist', async () => {
    await expect(
      useCase.execute({
        accountId: EntityId.create().toString(),
        amount: -5000,
        date: '2024-02-26',
      })
    ).rejects.toThrow(NotFoundError)
  })

  it('should throw NotFoundError if category does not exist', async () => {
    await expect(
      useCase.execute({
        accountId: testAccount.id.toString(),
        amount: -5000,
        date: '2024-02-26',
        categoryId: EntityId.create().toString(),
      })
    ).rejects.toThrow(NotFoundError)
  })

  it('should create transaction with notes', async () => {
    const result = await useCase.execute({
      accountId: testAccount.id.toString(),
      amount: -1000,
      date: '2024-02-26',
      notes: 'Test note',
    })

    expect(result.transaction.notes).toBe('Test note')
  })
})
