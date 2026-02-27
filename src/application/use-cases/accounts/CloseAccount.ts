import { NotFoundError } from '@domain/errors'
import { EntityId } from '@domain/value-objects'
import type { AccountRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface CloseAccountInput {
  id: string
  reopen?: boolean
}

export class CloseAccount {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: CloseAccountInput): Promise<void> {
    const id = EntityId.fromString(input.id)
    const account = await this.accountRepo.findById(id)
    if (!account) {
      throw new NotFoundError('Account', input.id)
    }

    if (input.reopen) {
      account.reopen()
    } else {
      account.close()
    }

    await this.accountRepo.save(account)

    await this.syncService.trackChanges([
      {
        table: 'accounts',
        row: account.id.toString(),
        data: { closed: account.closed ? 1 : 0 },
      },
    ])
  }
}
