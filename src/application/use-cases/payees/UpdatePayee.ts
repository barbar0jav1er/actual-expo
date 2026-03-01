import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { PayeeRepository } from '@domain/repositories'
import type { PayeeDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface UpdatePayeeInput {
  id: string
  name: string
}

export interface UpdatePayeeOutput {
  payee: PayeeDTO
}

export class UpdatePayee {
  constructor(
    private readonly payeeRepo: PayeeRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: UpdatePayeeInput): Promise<UpdatePayeeOutput> {
    const id = EntityId.fromString(input.id)
    const payee = await this.payeeRepo.findById(id)
    if (!payee) {
      throw new NotFoundError('Payee', input.id)
    }

    payee.rename(input.name)
    await this.payeeRepo.save(payee)

    await this.syncService.trackChanges([
      { table: 'payees', row: payee.id.toString(), data: { name: payee.name } },
    ])

    return {
      payee: {
        id: payee.id.toString(),
        name: payee.name,
        isTransfer: payee.isTransferPayee,
        transferAccountId: payee.transferAccountId?.toString(),
      },
    }
  }
}
