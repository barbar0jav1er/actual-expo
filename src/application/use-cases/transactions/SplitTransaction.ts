import { Transaction } from '@domain/entities'
import { EntityId, Money, TransactionDate } from '@domain/value-objects'
import { NotFoundError, ValidationError } from '@domain/errors'
import type { TransactionRepository, CategoryRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface SplitInput {
  amount: number // cents
  categoryId?: string
  notes?: string
}

export interface SplitTransactionInput {
  transactionId: string
  splits: SplitInput[]
}

export class SplitTransaction {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: SplitTransactionInput): Promise<void> {
    if (input.splits.length < 2) {
      throw new ValidationError('splits', 'At least 2 splits are required')
    }

    const id = EntityId.fromString(input.transactionId)
    const parent = await this.transactionRepo.findById(id)
    if (!parent) {
      throw new NotFoundError('Transaction', input.transactionId)
    }

    if (parent.isChild) {
      throw new ValidationError('transaction', 'Cannot split a child transaction')
    }

    const totalSplit = input.splits.reduce((sum, s) => sum + s.amount, 0)
    if (totalSplit !== parent.amount.toCents()) {
      throw new ValidationError(
        'splits',
        `Split amounts (${totalSplit}) must equal transaction amount (${parent.amount.toCents()})`
      )
    }

    // Mark parent as split container
    parent.markAsParent()
    await this.transactionRepo.save(parent)

    await this.syncService.trackChanges([
      {
        table: 'transactions',
        row: parent.id.toString(),
        data: { isParent: 1 },
      },
    ])

    // Create child transactions
    for (const split of input.splits) {
      if (split.categoryId) {
        const cat = await this.categoryRepo.findById(EntityId.fromString(split.categoryId))
        if (!cat) throw new NotFoundError('Category', split.categoryId)
      }

      const child = Transaction.createChild({
        parentId: parent.id,
        accountId: parent.accountId,
        amount: Money.fromCents(split.amount),
        date: parent.date,
        categoryId: split.categoryId ? EntityId.fromString(split.categoryId) : undefined,
        notes: split.notes,
      })

      await this.transactionRepo.save(child)

      await this.syncService.trackChanges([
        {
          table: 'transactions',
          row: child.id.toString(),
          data: {
            id: child.id.toString(),
            acct: child.accountId.toString(),
            category: child.categoryId?.toString() ?? null,
            amount: child.amount.toCents(),
            date: child.date.toNumber(),
            notes: child.notes ?? null,
            cleared: child.cleared ? 1 : 0,
            reconciled: child.reconciled ? 1 : 0,
            tombstone: 0,
            isParent: 0,
            isChild: 1,
            parent_id: parent.id.toString(),
            sort_order: child.sortOrder,
          },
        },
      ])
    }
  }
}
