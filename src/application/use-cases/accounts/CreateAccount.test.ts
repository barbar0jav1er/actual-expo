import { describe, it, expect, beforeEach } from 'vitest'
import { CreateAccount } from './CreateAccount'
import { Account } from '@domain/entities'
import { Payee } from '@domain/entities'
import { EntityId } from '@domain/value-objects'
import { ValidationError } from '@domain/errors'
import type { AccountRepository } from '@domain/repositories'
import type { PayeeRepository } from '@domain/repositories'
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
  let syncService: MockSyncService

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository()
    payeeRepo = new InMemoryPayeeRepository()
    syncService = new MockSyncService()
    useCase = new CreateAccount(accountRepo, payeeRepo, syncService)
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
})
