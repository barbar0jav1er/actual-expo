import type { Payee } from '@domain/entities'
import type { PayeeRepository } from '@domain/repositories'
import type { PayeeDTO } from '@application/dtos'

export interface GetPayeesInput {
  includeTransfer?: boolean
}

export interface GetPayeesOutput {
  payees: PayeeDTO[]
}

export class GetPayees {
  constructor(private readonly payeeRepo: PayeeRepository) {}

  async execute(input: GetPayeesInput = {}): Promise<GetPayeesOutput> {
    const payees = await this.payeeRepo.findActive()

    const filtered = input.includeTransfer
      ? payees
      : payees.filter(p => !p.isTransferPayee)

    return {
      payees: filtered.map(p => this.toDTO(p)),
    }
  }

  private toDTO(payee: Payee): PayeeDTO {
    return {
      id: payee.id.toString(),
      name: payee.name,
      isTransfer: payee.isTransferPayee,
      transferAccountId: payee.transferAccountId?.toString(),
    }
  }
}
