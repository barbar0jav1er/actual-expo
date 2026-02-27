import { EntityId, TransactionDate, BudgetMonth } from '@domain/value-objects'
import { ValidationError } from '@domain/errors'
import type { Transaction, Account, Category, Payee } from '@domain/entities'
import type {
  AccountRepository,
  TransactionRepository,
  CategoryRepository,
  PayeeRepository,
} from '@domain/repositories'
import type { TransactionDTO } from '@application/dtos'

export interface GetTransactionsInput {
  accountId?: string
  startDate?: string
  endDate?: string
  month?: string // YYYY-MM
}

export interface GetTransactionsOutput {
  transactions: TransactionDTO[]
}

export class GetTransactions {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly payeeRepo: PayeeRepository
  ) {}

  async execute(input: GetTransactionsInput): Promise<GetTransactionsOutput> {
    let transactions: Transaction[]

    if (input.accountId) {
      transactions = await this.transactionRepo.findByAccount(
        EntityId.fromString(input.accountId)
      )
    } else if (input.month) {
      transactions = await this.transactionRepo.findByMonth(
        BudgetMonth.fromString(input.month)
      )
    } else if (input.startDate && input.endDate) {
      transactions = await this.transactionRepo.findByDateRange(
        TransactionDate.fromString(input.startDate),
        TransactionDate.fromString(input.endDate)
      )
    } else {
      throw new ValidationError(
        'filter',
        'Must specify accountId, month, or date range'
      )
    }

    const [accounts, categories, payees] = await Promise.all([
      this.accountRepo.findAll(),
      this.categoryRepo.findAll(),
      this.payeeRepo.findAll(),
    ])

    const accountMap = new Map(accounts.map(a => [a.id.toString(), a]))
    const categoryMap = new Map(categories.map(c => [c.id.toString(), c]))
    const payeeMap = new Map(payees.map(p => [p.id.toString(), p]))

    const childrenMap = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      if (tx.isChild && tx.parentId) {
        const parentId = tx.parentId.toString()
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, [])
        }
        childrenMap.get(parentId)!.push(tx)
      }
    }

    const dtos = transactions
      .filter(tx => !tx.tombstone && !tx.isChild)
      .map(tx =>
        this.toDTO(tx, accountMap, categoryMap, payeeMap, childrenMap)
      )

    return { transactions: dtos }
  }

  private toDTO(
    tx: Transaction,
    accounts: Map<string, Account>,
    categories: Map<string, Category>,
    payees: Map<string, Payee>,
    childrenMap: Map<string, Transaction[]>
  ): TransactionDTO {
    const account = accounts.get(tx.accountId.toString())
    const category = tx.categoryId ? categories.get(tx.categoryId.toString()) : undefined
    const payee = tx.payeeId ? payees.get(tx.payeeId.toString()) : undefined

    const dto: TransactionDTO = {
      id: tx.id.toString(),
      accountId: tx.accountId.toString(),
      accountName: account?.name ?? 'Unknown',
      categoryId: category?.id.toString(),
      categoryName: category?.name,
      payeeId: payee?.id.toString(),
      payeeName: payee?.name,
      amount: tx.amount.toCents(),
      date: tx.date.toString(),
      notes: tx.notes,
      cleared: tx.cleared,
      reconciled: tx.reconciled,
      isParent: tx.isParent,
      isChild: tx.isChild,
      parentId: tx.parentId?.toString(),
    }

    if (tx.isParent) {
      const children = childrenMap.get(tx.id.toString()) ?? []
      dto.subtransactions = children
        .filter(c => !c.tombstone)
        .map(c => this.toDTO(c, accounts, categories, payees, childrenMap))
    }

    return dto
  }
}
