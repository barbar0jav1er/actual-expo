import { Transaction } from '@domain/entities'
import { EntityId, Money, TransactionDate } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { Category, Account, Payee } from '@domain/entities'
import type {
  AccountRepository,
  TransactionRepository,
  CategoryRepository,
  PayeeRepository,
} from '@domain/repositories'
import type { TransactionDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface CreateTransactionInput {
  accountId: string
  amount: number // cents
  date: string // YYYY-MM-DD
  categoryId?: string
  payeeId?: string
  notes?: string
}

export interface CreateTransactionOutput {
  transaction: TransactionDTO
}

export class CreateTransaction {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly payeeRepo: PayeeRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: CreateTransactionInput): Promise<CreateTransactionOutput> {
    const account = await this.accountRepo.findById(EntityId.fromString(input.accountId))
    if (!account) {
      throw new NotFoundError('Account', input.accountId)
    }

    let category: Category | null = null
    if (input.categoryId) {
      category = await this.categoryRepo.findById(EntityId.fromString(input.categoryId))
      if (!category) {
        throw new NotFoundError('Category', input.categoryId)
      }
    }

    let payee: Payee | null = null
    if (input.payeeId) {
      payee = await this.payeeRepo.findById(EntityId.fromString(input.payeeId))
      if (!payee) {
        throw new NotFoundError('Payee', input.payeeId)
      }
    }

    const tx = Transaction.create({
      accountId: account.id,
      amount: Money.fromCents(input.amount),
      date: TransactionDate.fromString(input.date),
      categoryId: category?.id,
      payeeId: payee?.id,
      notes: input.notes,
    })

    await this.transactionRepo.save(tx)

    await this.syncService.trackChanges([
      {
        table: 'transactions',
        row: tx.id.toString(),
        data: {
          id: tx.id.toString(),
          acct: tx.accountId.toString(),
          category: tx.categoryId?.toString() ?? null,
          description: tx.payeeId?.toString() ?? null,
          amount: tx.amount.toCents(),
          date: tx.date.toNumber(),
          notes: tx.notes ?? null,
          cleared: tx.cleared ? 1 : 0,
          reconciled: tx.reconciled ? 1 : 0,
          tombstone: tx.tombstone ? 1 : 0,
          isParent: tx.isParent ? 1 : 0,
          isChild: tx.isChild ? 1 : 0,
          parent_id: tx.parentId?.toString() ?? null,
          sort_order: tx.sortOrder,
        },
      },
    ])

    return {
      transaction: toTransactionDTO(tx, account, category, payee),
    }
  }
}

export function toTransactionDTO(
  tx: Transaction,
  account: Account,
  category: Category | null,
  payee: Payee | null
): TransactionDTO {
  return {
    id: tx.id.toString(),
    accountId: account.id.toString(),
    accountName: account.name,
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
}
