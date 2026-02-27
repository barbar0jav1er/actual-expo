import { Account, Category, CategoryGroup, Payee, Transaction } from '@domain/entities'
import { Money, TransactionDate } from '@domain/value-objects'
import { ValidationError } from '@domain/errors'
import type {
  AccountRepository,
  CategoryGroupRepository,
  CategoryRepository,
  PayeeRepository,
  TransactionRepository,
} from '@domain/repositories'
import type { AccountDTO } from '@application/dtos'
import type { SyncService, EntityChange } from '@application/services/SyncService'

export interface CreateAccountInput {
  name: string
  offbudget?: boolean
  balance?: number // in cents
}

export interface CreateAccountOutput {
  account: AccountDTO
}

export class CreateAccount {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly payeeRepo: PayeeRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: CreateAccountInput): Promise<CreateAccountOutput> {
    if (!input.name || !input.name.trim()) {
      throw new ValidationError('name', 'Name is required')
    }

    const account = Account.create({
      name: input.name.trim(),
      offbudget: input.offbudget ?? false,
    })

    const transferPayee = Payee.createTransferPayee({
      name: `Transfer: ${account.name}`,
      accountId: account.id,
    })

    const changes: EntityChange[] = [
      {
        table: 'accounts',
        row: account.id.toString(),
        data: {
          id: account.id.toString(),
          name: account.name,
          offbudget: account.offbudget ? 1 : 0,
          closed: account.closed ? 1 : 0,
          sort_order: account.sortOrder,
          tombstone: account.tombstone ? 1 : 0,
        },
      },
      {
        table: 'payees',
        row: transferPayee.id.toString(),
        data: {
          id: transferPayee.id.toString(),
          name: transferPayee.name,
          transfer_acct: transferPayee.transferAccountId?.toString() ?? null,
          tombstone: transferPayee.tombstone ? 1 : 0,
        },
      },
    ]

    await this.accountRepo.save(account)
    await this.payeeRepo.save(transferPayee)

    let balance = 0
    if (input.balance !== undefined && input.balance !== 0) {
      balance = input.balance
      const { payee, category, additionalChanges } =
        await this.getOrCreateStartingBalanceEntities()

      changes.push(...additionalChanges)

      const transaction = Transaction.create({
        accountId: account.id,
        amount: Money.fromCents(input.balance),
        date: TransactionDate.today(),
        payeeId: payee.id,
        categoryId: category?.id,
        notes: 'Starting balance',
      })
      transaction.clear()

      await this.transactionRepo.save(transaction)
      changes.push({
        table: 'transactions',
        row: transaction.id.toString(),
        data: {
          id: transaction.id.toString(),
          acct: transaction.accountId.toString(),
          category: transaction.categoryId?.toString() ?? null,
          description: transaction.payeeId?.toString() ?? null,
          amount: transaction.amount.toCents(),
          date: transaction.date.toNumber(),
          notes: transaction.notes ?? null,
          cleared: transaction.cleared ? 1 : 0,
          reconciled: transaction.reconciled ? 1 : 0,
          tombstone: transaction.tombstone ? 1 : 0,
          isParent: transaction.isParent ? 1 : 0,
          isChild: transaction.isChild ? 1 : 0,
          parent_id: transaction.parentId?.toString() ?? null,
          sort_order: transaction.sortOrder,
          starting_balance_flag: 1,
        },
      })
    }

    await this.syncService.trackChanges(changes)

    return {
      account: {
        id: account.id.toString(),
        name: account.name,
        offbudget: account.offbudget,
        closed: account.closed,
        balance: balance,
      },
    }
  }

  private async getOrCreateStartingBalanceEntities(): Promise<{
    payee: Payee
    category: Category | null
    additionalChanges: EntityChange[]
  }> {
    const additionalChanges: EntityChange[] = []

    // 1. Get or create Payee
    const allPayees = await this.payeeRepo.findAll()
    let payee = allPayees.find(
      p => p.name.toLowerCase() === 'starting balance' && !p.tombstone
    )

    if (!payee) {
      payee = Payee.create({ name: 'Starting Balance' })
      await this.payeeRepo.save(payee)
      additionalChanges.push({
        table: 'payees',
        row: payee.id.toString(),
        data: {
          id: payee.id.toString(),
          name: payee.name,
          transfer_acct: null,
          tombstone: 0,
        },
      })
    }

    // 2. Get or create Category Group "Income"
    const groups = await this.categoryGroupRepo.findAll()
    let incomeGroup = groups.find(
      g => g.name.toLowerCase() === 'income' && g.isIncome && !g.tombstone
    )

    if (!incomeGroup) {
      incomeGroup = CategoryGroup.create({ name: 'Income', isIncome: true })
      await this.categoryGroupRepo.save(incomeGroup)
      additionalChanges.push({
        table: 'category_groups',
        row: incomeGroup.id.toString(),
        data: {
          id: incomeGroup.id.toString(),
          name: incomeGroup.name,
          is_income: 1,
          sort_order: 0,
          tombstone: 0,
        },
      })
    }

    // 3. Get or create Category "Starting Balances"
    const categories = await this.categoryRepo.findAll()
    let category = categories.find(
      c =>
        c.name.toLowerCase() === 'starting balances' &&
        c.groupId.equals(incomeGroup!.id) &&
        !c.tombstone
    )

    if (!category) {
      category = Category.create({
        name: 'Starting Balances',
        groupId: incomeGroup.id,
        isIncome: true,
      })
      await this.categoryRepo.save(category)
      additionalChanges.push({
        table: 'categories',
        row: category.id.toString(),
        data: {
          id: category.id.toString(),
          name: category.name,
          cat_group: category.groupId.toString(),
          is_income: 1,
          sort_order: 0,
          tombstone: 0,
        },
      })
    }

    return { payee, category, additionalChanges }
  }
}
