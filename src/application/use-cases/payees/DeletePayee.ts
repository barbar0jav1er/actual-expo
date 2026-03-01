import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { PayeeRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface DeletePayeeInput {
  id: string
}

export class DeletePayee {
  constructor(
    private readonly payeeRepo: PayeeRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: DeletePayeeInput): Promise<void> {
    const id = EntityId.fromString(input.id)
    const payee = await this.payeeRepo.findById(id)
    if (!payee) {
      throw new NotFoundError('Payee', input.id)
    }

    payee.delete()
    await this.payeeRepo.save(payee)

    await this.syncService.trackChanges([
      { table: 'payees', row: input.id, data: { tombstone: 1 } },
    ])
  }
}
