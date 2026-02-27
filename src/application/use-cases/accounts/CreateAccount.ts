import { Account } from '@domain/entities'
import { Payee } from '@domain/entities'
import { ValidationError } from '@domain/errors'
import type { AccountRepository } from '@domain/repositories'
import type { PayeeRepository } from '@domain/repositories'
import type { AccountDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface CreateAccountInput {
  name: string
  offbudget?: boolean
}

export interface CreateAccountOutput {
  account: AccountDTO
}

export class CreateAccount {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly payeeRepo: PayeeRepository,
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

    await this.accountRepo.save(account)
    await this.payeeRepo.save(transferPayee)

    await this.syncService.trackChanges([
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
    ])

    return {
      account: {
        id: account.id.toString(),
        name: account.name,
        offbudget: account.offbudget,
        closed: account.closed,
        balance: 0,
      },
    }
  }
}
