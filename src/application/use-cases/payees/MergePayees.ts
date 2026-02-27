import { EntityId } from '@domain/value-objects'
import { NotFoundError, ValidationError } from '@domain/errors'
import type { PayeeRepository, TransactionRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface MergePayeesInput {
  sourcePayeeId: string
  targetPayeeId: string
}

export class MergePayees {
  constructor(
    private readonly payeeRepo: PayeeRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: MergePayeesInput): Promise<void> {
    if (input.sourcePayeeId === input.targetPayeeId) {
      throw new ValidationError('payees', 'Source and target payees must be different')
    }

    const sourceId = EntityId.fromString(input.sourcePayeeId)
    const targetId = EntityId.fromString(input.targetPayeeId)

    const [source, target] = await Promise.all([
      this.payeeRepo.findById(sourceId),
      this.payeeRepo.findById(targetId),
    ])

    if (!source) throw new NotFoundError('Payee', input.sourcePayeeId)
    if (!target) throw new NotFoundError('Payee', input.targetPayeeId)

    // Update all transactions referencing source payee to point to target
    const transactions = await this.transactionRepo.findByPayee(sourceId)
    const syncChanges: Array<{ table: string; row: string; data: Record<string, string | number | null> }> = []

    for (const tx of transactions) {
      tx.setPayee(targetId)
      await this.transactionRepo.save(tx)
      syncChanges.push({
        table: 'transactions',
        row: tx.id.toString(),
        data: { description: targetId.toString() },
      })
    }

    // Delete source payee
    source.delete()
    await this.payeeRepo.save(source)
    syncChanges.push({
      table: 'payees',
      row: source.id.toString(),
      data: { tombstone: 1 },
    })

    if (syncChanges.length > 0) {
      await this.syncService.trackChanges(syncChanges)
    }
  }
}
