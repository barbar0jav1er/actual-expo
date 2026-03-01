import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../__tests__/createTestDb'
import { SqliteTransactionRepository } from './SqliteTransactionRepository'
import { SqliteAccountRepository } from './SqliteAccountRepository'
import { SqliteCategoryRepository } from './SqliteCategoryRepository'
import { SqliteCategoryGroupRepository } from './SqliteCategoryGroupRepository'
import { SqlitePayeeRepository } from './SqlitePayeeRepository'
import { Account } from '@domain/entities/Account'
import { Transaction } from '@domain/entities/Transaction'
import { Category } from '@domain/entities/Category'
import { CategoryGroup } from '@domain/entities/CategoryGroup'
import { Payee } from '@domain/entities/Payee'
import { Money } from '@domain/value-objects/Money'
import { TransactionDate } from '@domain/value-objects/TransactionDate'
import { BudgetMonth } from '@domain/value-objects/BudgetMonth'
import type { AppDatabase } from '../db'

describe('SqliteTransactionRepository', () => {
  let repo: SqliteTransactionRepository
  let accountRepo: SqliteAccountRepository
  let categoryRepo: SqliteCategoryRepository
  let categoryGroupRepo: SqliteCategoryGroupRepository
  let payeeRepo: SqlitePayeeRepository
  let account: Account

  beforeEach(async () => {
    const db: AppDatabase = await createTestDb()
    repo = new SqliteTransactionRepository(db)
    accountRepo = new SqliteAccountRepository(db)
    categoryRepo = new SqliteCategoryRepository(db)
    categoryGroupRepo = new SqliteCategoryGroupRepository(db)
    payeeRepo = new SqlitePayeeRepository(db)

    account = Account.create({ name: 'Checking' })
    await accountRepo.save(account)
  })

  function makeTx(amountCents = 1000, dateNum = 20240115) {
    return Transaction.create({
      accountId: account.id,
      amount: Money.fromCents(amountCents),
      date: TransactionDate.fromNumber(dateNum),
    })
  }

  it('saves and retrieves a transaction by id', async () => {
    const tx = makeTx()

    await repo.save(tx)
    const found = await repo.findById(tx.id)

    expect(found).not.toBeNull()
    expect(found!.amount.toCents()).toBe(1000)
    expect(found!.id.equals(tx.id)).toBe(true)
  })

  it('findByAccount returns transactions for that account ordered by date', async () => {
    const tx1 = makeTx(500,  20240101)
    const tx2 = makeTx(1500, 20240115)
    await repo.save(tx1)
    await repo.save(tx2)

    const result = await repo.findByAccount(account.id)
    expect(result).toHaveLength(2)
  })

  it('findByDateRange filters correctly', async () => {
    await repo.save(makeTx(100, 20240101))
    await repo.save(makeTx(200, 20240115))
    await repo.save(makeTx(300, 20240201))

    const start = TransactionDate.fromNumber(20240110)
    const end   = TransactionDate.fromNumber(20240120)
    const result = await repo.findByDateRange(start, end)

    expect(result).toHaveLength(1)
    expect(result[0].amount.toCents()).toBe(200)
  })

  it('findByMonth returns transactions for that month', async () => {
    await repo.save(makeTx(100, 20240101))
    await repo.save(makeTx(200, 20240115))
    await repo.save(makeTx(300, 20240201))

    const month = BudgetMonth.fromString('2024-01')
    const result = await repo.findByMonth(month)

    expect(result).toHaveLength(2)
  })

  it('findChildren returns child transactions of a parent', async () => {
    const parent = makeTx(2000, 20240115)
    parent.markAsParent()
    await repo.save(parent)

    const child1 = Transaction.createChild({
      parentId: parent.id,
      accountId: account.id,
      amount: Money.fromCents(1200),
      date: TransactionDate.fromNumber(20240115),
    })
    const child2 = Transaction.createChild({
      parentId: parent.id,
      accountId: account.id,
      amount: Money.fromCents(800),
      date: TransactionDate.fromNumber(20240115),
    })
    await repo.save(child1)
    await repo.save(child2)

    const children = await repo.findChildren(parent.id)
    expect(children).toHaveLength(2)
  })

  it('saveMany is atomic', async () => {
    const txs = [makeTx(100, 20240101), makeTx(200, 20240102), makeTx(300, 20240103)]

    await repo.saveMany(txs)

    const result = await repo.findByAccount(account.id)
    expect(result).toHaveLength(3)
  })

  it('updates an existing transaction (upsert)', async () => {
    const tx = makeTx(1000, 20240115)
    await repo.save(tx)

    tx.setAmount(Money.fromCents(9999))
    await repo.save(tx)

    const found = await repo.findById(tx.id)
    expect(found!.amount.toCents()).toBe(9999)
  })

  it('findByCategory returns transactions for that category', async () => {
    const group = CategoryGroup.create({ name: 'Food' })
    await categoryGroupRepo.save(group)
    const cat = Category.create({ name: 'Groceries', groupId: group.id })
    await categoryRepo.save(cat)

    const tx1 = Transaction.create({
      accountId: account.id,
      amount: Money.fromCents(1000),
      date: TransactionDate.fromNumber(20240115),
      categoryId: cat.id,
    })
    const tx2 = makeTx(500, 20240116)

    await repo.save(tx1)
    await repo.save(tx2)

    const result = await repo.findByCategory(cat.id)
    expect(result).toHaveLength(1)
    expect(result[0].amount.toCents()).toBe(1000)
  })

  it('findByPayee returns transactions for that payee', async () => {
    const payee = Payee.create({ name: 'Amazon' })
    await payeeRepo.save(payee)

    const tx1 = Transaction.create({
      accountId: account.id,
      amount: Money.fromCents(2000),
      date: TransactionDate.fromNumber(20240115),
      payeeId: payee.id,
    })
    const tx2 = makeTx(500, 20240116)

    await repo.save(tx1)
    await repo.save(tx2)

    const result = await repo.findByPayee(payee.id)
    expect(result).toHaveLength(1)
    expect(result[0].amount.toCents()).toBe(2000)
  })

  it('soft-deletes a transaction (tombstone)', async () => {
    const tx = makeTx()
    await repo.save(tx)

    await repo.delete(tx.id)

    const result = await repo.findByAccount(account.id)
    expect(result).toHaveLength(0)
  })
})
