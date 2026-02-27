import { describe, it, expect, beforeEach } from 'vitest'
import { CreateAccount } from './CreateAccount'
import { Account, Category, CategoryGroup, Payee, Transaction } from '@domain/entities'
import { EntityId, TransactionDate, BudgetMonth } from '@domain/value-objects'
import { ValidationError } from '@domain/errors'
import type {
  AccountRepository,
  CategoryRepository,
  CategoryGroupRepository,
  PayeeRepository,
  TransactionRepository,
} from '@domain/repositories'
import type { SyncService, EntityChange } from '@application/services/SyncService'

class InMemoryAccountRepository implements AccountRepository {
  public accounts: Account[] = []

  async findById(id: EntityId): Promise<Account | null> {
    return this.accounts.find(a => a.id.equals(id)) ?? null
  }

  async findAll(): Promise<Account[]> {
    return this.accounts.filter(a => !a.tombstone)
  }

  async findActive(): Promise<Account[]> {
    return this.accounts.filter(a => a.isActive)
  }

  async save(account: Account): Promise<void> {
    const idx = this.accounts.findIndex(a => a.id.equals(account.id))
    if (idx >= 0) {
      this.accounts[idx] = account
    } else {
      this.accounts.push(account)
    }
  }

  async delete(id: EntityId): Promise<void> {
    this.accounts = this.accounts.filter(a => !a.id.equals(id))
  }
}

class InMemoryPayeeRepository implements PayeeRepository {
  public payees: Payee[] = []

  async findById(id: EntityId): Promise<Payee | null> {
    return this.payees.find(p => p.id.equals(id)) ?? null
  }

  async findAll(): Promise<Payee[]> {
    return this.payees.filter(p => !p.tombstone)
  }

  async findActive(): Promise<Payee[]> {
    return this.payees.filter(p => p.isActive)
  }

  async findByName(name: string): Promise<Payee | null> {
    return this.payees.find(p => p.name === name && !p.tombstone) ?? null
  }

  async findTransferPayee(accountId: EntityId): Promise<Payee | null> {
    return this.payees.find(p => p.transferAccountId?.equals(accountId)) ?? null
  }

  async save(payee: Payee): Promise<void> {
    const idx = this.payees.findIndex(p => p.id.equals(payee.id))
    if (idx >= 0) {
      this.payees[idx] = payee
    } else {
      this.payees.push(payee)
    }
  }

  async delete(id: EntityId): Promise<void> {
    this.payees = this.payees.filter(p => !p.id.equals(id))
  }
}

class InMemoryCategoryRepository implements CategoryRepository {
  public categories: Category[] = []

  async findById(id: EntityId): Promise<Category | null> {
    return this.categories.find(c => c.id.equals(id)) ?? null
  }

  async findAll(): Promise<Category[]> {
    return this.categories.filter(c => !c.tombstone)
  }

  async findActive(): Promise<Category[]> {
    return this.categories.filter(c => c.isActive)
  }

  async findByGroup(groupId: EntityId): Promise<Category[]> {
    return this.categories.filter(c => c.groupId.equals(groupId) && !c.tombstone)
  }

  async save(category: Category): Promise<void> {
    const idx = this.categories.findIndex(c => c.id.equals(category.id))
    if (idx >= 0) {
      this.categories[idx] = category
    } else {
      this.categories.push(category)
    }
  }

  async delete(id: EntityId): Promise<void> {
    this.categories = this.categories.filter(c => !c.id.equals(id))
  }
}

class InMemoryCategoryGroupRepository implements CategoryGroupRepository {
  public groups: CategoryGroup[] = []

  async findById(id: EntityId): Promise<CategoryGroup | null> {
    return this.groups.find(g => g.id.equals(id)) ?? null
  }

  async findAll(): Promise<CategoryGroup[]> {
    return this.groups.filter(g => !g.tombstone)
  }

  async findActive(): Promise<CategoryGroup[]> {
    return this.groups.filter(g => g.isActive)
  }

  async save(group: CategoryGroup): Promise<void> {
    const idx = this.groups.findIndex(g => g.id.equals(group.id))
    if (idx >= 0) {
      this.groups[idx] = group
    } else {
      this.groups.push(group)
    }
  }

  async delete(id: EntityId): Promise<void> {
    this.groups = this.groups.filter(g => !g.id.equals(id))
  }
}

class InMemoryTransactionRepository implements TransactionRepository {
  public transactions: Transaction[] = []

  async findById(id: EntityId): Promise<Transaction | null> {
    return this.transactions.find(t => t.id.equals(id)) ?? null
  }

  async findByAccount(accountId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.accountId.equals(accountId) && !t.tombstone)
  }

  async findByDateRange(start: TransactionDate, end: TransactionDate): Promise<Transaction[]> {
    return this.transactions.filter(t => t.date.compareTo(start) >= 0 && t.date.compareTo(end) <= 0 && !t.tombstone)
  }

  async findByMonth(month: BudgetMonth): Promise<Transaction[]> {
    return this.transactions.filter(t => t.date.getBudgetMonth().equals(month) && !t.tombstone)
  }

  async findChildren(parentId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.parentId?.equals(parentId) && !t.tombstone)
  }

  async findByCategory(categoryId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.categoryId?.equals(categoryId) && !t.tombstone)
  }

  async findByPayee(payeeId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.payeeId?.equals(payeeId) && !t.tombstone)
  }

  async findAll(): Promise<Transaction[]> {
    return this.transactions.filter(t => !t.tombstone)
  }

  async save(transaction: Transaction): Promise<void> {
    const idx = this.transactions.findIndex(t => t.id.equals(transaction.id))
    if (idx >= 0) {
      this.transactions[idx] = transaction
    } else {
      this.transactions.push(transaction)
    }
  }

  async saveMany(transactions: Transaction[]): Promise<void> {
    for (const t of transactions) {
      await this.save(t)
    }
  }

  async delete(id: EntityId): Promise<void> {
    this.transactions = this.transactions.filter(t => !t.id.equals(id))
  }
}

class MockSyncService implements SyncService {
  public trackedChanges: EntityChange[] = []

  async trackChanges(changes: EntityChange[]): Promise<void> {
    this.trackedChanges.push(...changes)
  }
}

describe('CreateAccount', () => {
  let useCase: CreateAccount
  let accountRepo: InMemoryAccountRepository
  let payeeRepo: InMemoryPayeeRepository
  let categoryRepo: InMemoryCategoryRepository
  let categoryGroupRepo: InMemoryCategoryGroupRepository
  let transactionRepo: InMemoryTransactionRepository
  let syncService: MockSyncService

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository()
    payeeRepo = new InMemoryPayeeRepository()
    categoryRepo = new InMemoryCategoryRepository()
    categoryGroupRepo = new InMemoryCategoryGroupRepository()
    transactionRepo = new InMemoryTransactionRepository()
    syncService = new MockSyncService()
    useCase = new CreateAccount(
      accountRepo,
      payeeRepo,
      categoryRepo,
      categoryGroupRepo,
      transactionRepo,
      syncService
    )
  })

  it('should create an account with a transfer payee', async () => {
    const result = await useCase.execute({ name: 'Checking' })

    expect(result.account.name).toBe('Checking')
    expect(result.account.offbudget).toBe(false)
    expect(result.account.closed).toBe(false)
    expect(result.account.balance).toBe(0)
    expect(accountRepo.accounts).toHaveLength(1)
    expect(payeeRepo.payees).toHaveLength(1)
    expect(payeeRepo.payees[0].name).toBe('Transfer: Checking')
    expect(payeeRepo.payees[0].isTransferPayee).toBe(true)
  })

  it('should create an account with an initial balance', async () => {
    const result = await useCase.execute({ name: 'Checking', balance: 100000 }) // $1000.00

    expect(result.account.balance).toBe(100000)
    expect(transactionRepo.transactions).toHaveLength(1)
    expect(transactionRepo.transactions[0].amount.toCents()).toBe(100000)
    expect(transactionRepo.transactions[0].cleared).toBe(true)

    // Verify Starting Balance entities were created
    const startingBalancePayee = await payeeRepo.findByName('Starting Balance')
    expect(startingBalancePayee).toBeDefined()
    expect(transactionRepo.transactions[0].payeeId?.equals(startingBalancePayee!.id)).toBe(true)

    const groups = await categoryGroupRepo.findAll()
    const incomeGroup = groups.find(g => g.name === 'Income')
    expect(incomeGroup).toBeDefined()

    const categories = await categoryRepo.findAll()
    const startingBalanceCategory = categories.find(c => c.name === 'Starting Balances')
    expect(startingBalanceCategory).toBeDefined()
    expect(transactionRepo.transactions[0].categoryId?.equals(startingBalanceCategory!.id)).toBe(true)

    // Verify sync tracking
    const accountChanges = syncService.trackedChanges.filter(c => c.table === 'accounts')
    const payeeChanges = syncService.trackedChanges.filter(c => c.table === 'payees')
    const transactionChanges = syncService.trackedChanges.filter(c => c.table === 'transactions')
    const groupChanges = syncService.trackedChanges.filter(c => c.table === 'category_groups')
    const categoryChanges = syncService.trackedChanges.filter(c => c.table === 'categories')

    expect(accountChanges).toHaveLength(1)
    expect(payeeChanges).toHaveLength(2) // Transfer payee + Starting Balance payee
    expect(transactionChanges).toHaveLength(1)
    expect(groupChanges).toHaveLength(1)
    expect(categoryChanges).toHaveLength(1)
  })

  it('should reuse existing Starting Balance entities', async () => {
    // First account with balance
    await useCase.execute({ name: 'Checking 1', balance: 10000 })

    // Second account with balance
    await useCase.execute({ name: 'Checking 2', balance: 20000 })

    expect(payeeRepo.payees.filter(p => p.name === 'Starting Balance')).toHaveLength(1)
    expect(categoryGroupRepo.groups.filter(g => g.name === 'Income')).toHaveLength(1)
    expect(categoryRepo.categories.filter(c => c.name === 'Starting Balances')).toHaveLength(1)
    expect(transactionRepo.transactions).toHaveLength(2)
  })

  it('should create an offbudget account', async () => {
    const result = await useCase.execute({ name: 'Savings', offbudget: true })

    expect(result.account.offbudget).toBe(true)
  })

  it('should throw ValidationError if name is empty', async () => {
    await expect(useCase.execute({ name: '' })).rejects.toThrow(ValidationError)
  })

  it('should throw ValidationError if name is whitespace', async () => {
    await expect(useCase.execute({ name: '   ' })).rejects.toThrow(ValidationError)
  })

  it('should trim whitespace from account name', async () => {
    const result = await useCase.execute({ name: '  My Account  ' })
    expect(result.account.name).toBe('My Account')
  })
})
