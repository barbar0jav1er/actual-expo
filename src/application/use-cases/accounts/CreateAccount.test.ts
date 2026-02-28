import { describe, it, expect, beforeEach } from 'vitest'
import { CreateAccount } from './CreateAccount'
import { Account } from '@domain/entities'
import { Payee } from '@domain/entities'
import { Transaction } from '@domain/entities'
import { EntityId, BudgetMonth, TransactionDate } from '@domain/value-objects'
import { ValidationError } from '@domain/errors'
import type { AccountRepository } from '@domain/repositories'
import type { PayeeRepository } from '@domain/repositories'
import type { TransactionRepository } from '@domain/repositories'
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

class InMemoryTransactionRepository implements TransactionRepository {
  public transactions: Transaction[] = []

  async findById(id: EntityId): Promise<Transaction | null> {
    return this.transactions.find(t => t.id.equals(id)) ?? null
  }

  async findByAccount(accountId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.accountId.equals(accountId) && !t.tombstone)
  }

  async findByDateRange(start: TransactionDate, end: TransactionDate): Promise<Transaction[]> {
    return this.transactions.filter(t => !t.tombstone && !t.date.isBefore(start) && !t.date.isAfter(end))
  }

  async findByMonth(month: BudgetMonth): Promise<Transaction[]> {
    return this.transactions.filter(t => !t.tombstone && t.date.getBudgetMonth().equals(month))
  }

  async findChildren(parentId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.parentId?.equals(parentId) && !t.tombstone)
  }

  async findByCategory(categoryId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.categoryId?.equals(categoryId) && !t.tombstone)
  }

  async findAll(): Promise<Transaction[]> {
    return this.transactions.filter(t => !t.tombstone)
  }

  async findByPayee(payeeId: EntityId): Promise<Transaction[]> {
    return this.transactions.filter(t => t.payeeId?.equals(payeeId) && !t.tombstone)
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
    for (const tx of transactions) {
      await this.save(tx)
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
  let transactionRepo: InMemoryTransactionRepository
  let payeeRepo: InMemoryPayeeRepository
  let syncService: MockSyncService

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository()
    transactionRepo = new InMemoryTransactionRepository()
    payeeRepo = new InMemoryPayeeRepository()
    syncService = new MockSyncService()
    useCase = new CreateAccount(accountRepo, transactionRepo, payeeRepo, syncService)
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

  it('should create an offbudget account', async () => {
    const result = await useCase.execute({ name: 'Savings', offbudget: true })

    expect(result.account.offbudget).toBe(true)
  })

  it('should track changes for both account and payee', async () => {
    await useCase.execute({ name: 'Checking' })

    expect(syncService.trackedChanges).toHaveLength(2)
    expect(syncService.trackedChanges[0].table).toBe('accounts')
    expect(syncService.trackedChanges[1].table).toBe('payees')
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

  it('should return initialBalance in account output', async () => {
    const result = await useCase.execute({ name: 'Checking', initialBalance: 15025 })

    expect(result.balance).toBe(15025)
    expect(result.account.balance).toBe(15025)
  })

  it('should create opening balance transaction when initialBalance is non-zero', async () => {
    await useCase.execute({ name: 'Checking', initialBalance: 15025 })

    expect(transactionRepo.transactions).toHaveLength(1)
    const tx = transactionRepo.transactions[0]
    expect(tx.amount.toCents()).toBe(15025)
    expect(tx.cleared).toBe(true)
    // payee named 'Starting Balance' should be created
    const startingPayee = await payeeRepo.findByName('Starting Balance')
    expect(startingPayee).not.toBeNull()
    expect(tx.payeeId?.equals(startingPayee!.id)).toBe(true)
  })

  it('should not create transaction when initialBalance is 0', async () => {
    await useCase.execute({ name: 'Checking', initialBalance: 0 })

    expect(transactionRepo.transactions).toHaveLength(0)
  })

  it('should not create transaction when initialBalance is omitted', async () => {
    await useCase.execute({ name: 'Checking' })

    expect(transactionRepo.transactions).toHaveLength(0)
  })

  it('should reuse existing Starting Balance payee', async () => {
    const existingPayee = Payee.create({ name: 'Starting Balance' })
    await payeeRepo.save(existingPayee)

    await useCase.execute({ name: 'Checking', initialBalance: 5000 })

    // Still only the pre-existing Starting Balance payee + the new transfer payee
    const startingPayees = payeeRepo.payees.filter(p => p.name === 'Starting Balance')
    expect(startingPayees).toHaveLength(1)
  })

  it('should track CRDT changes including starting_balance_flag', async () => {
    await useCase.execute({ name: 'Checking', initialBalance: 15025 })

    // account + transfer payee + starting balance payee (new) + transaction = 4
    expect(syncService.trackedChanges).toHaveLength(4)
    const txChange = syncService.trackedChanges.find(c => c.table === 'transactions')
    expect(txChange).toBeDefined()
    expect(txChange?.data.starting_balance_flag).toBe(1)
    expect(txChange?.data.cleared).toBe(1)
    expect(txChange?.data.amount).toBe(15025)
  })

  it('should not add Starting Balance payee CRDT change when payee already exists', async () => {
    const existingPayee = Payee.create({ name: 'Starting Balance' })
    await payeeRepo.save(existingPayee)

    await useCase.execute({ name: 'Checking', initialBalance: 5000 })

    // account + transfer payee + transaction = 3 (no new payee change)
    expect(syncService.trackedChanges).toHaveLength(3)
    const payeeChanges = syncService.trackedChanges.filter(c => c.table === 'payees')
    // only the transfer payee change
    expect(payeeChanges).toHaveLength(1)
    expect(payeeChanges[0].data.name).toBe('Transfer: Checking')
  })
})
