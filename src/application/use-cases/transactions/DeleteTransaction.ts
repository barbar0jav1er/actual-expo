import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { TransactionRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface DeleteTransactionInput {
  id: string
}

export class DeleteTransaction {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: DeleteTransactionInput): Promise<void> {
    const id = EntityId.fromString(input.id)
    const tx = await this.transactionRepo.findById(id)
    if (!tx) {
      throw new NotFoundError('Transaction', input.id)
    }

    tx.delete()
    await this.transactionRepo.save(tx)

    await this.syncService.trackChanges([
      {
        table: 'transactions',
        row: tx.id.toString(),
        data: { tombstone: 1 },
      },
    ])

    // If it's a parent, delete all children too
    if (tx.isParent) {
      const children = await this.transactionRepo.findChildren(id)
      for (const child of children) {
        child.delete()
        await this.transactionRepo.save(child)
        await this.syncService.trackChanges([
          {
            table: 'transactions',
            row: child.id.toString(),
            data: { tombstone: 1 },
          },
        ])
      }
    }
  }
}
