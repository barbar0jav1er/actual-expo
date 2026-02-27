import { Payee } from '@domain/entities'
import type { PayeeRepository } from '@domain/repositories'
import type { PayeeDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface CreatePayeeInput {
  name: string
}

export interface CreatePayeeOutput {
  payee: PayeeDTO
}

export class CreatePayee {
  constructor(
    private readonly payeeRepo: PayeeRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: CreatePayeeInput): Promise<CreatePayeeOutput> {
    const payee = Payee.create({ name: input.name })

    await this.payeeRepo.save(payee)

    await this.syncService.trackChanges([
      {
        table: 'payees',
        row: payee.id.toString(),
        data: {
          id: payee.id.toString(),
          name: payee.name,
          transfer_acct: null,
          tombstone: 0,
        },
      },
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
