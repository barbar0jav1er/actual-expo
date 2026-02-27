import { ValidationError, NotFoundError } from '@domain/errors'
import { EntityId } from '@domain/value-objects'
import type { AccountRepository } from '@domain/repositories'
import type { AccountDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface UpdateAccountInput {
  id: string
  name?: string
  offbudget?: boolean
}

export interface UpdateAccountOutput {
  account: AccountDTO
}

export class UpdateAccount {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: UpdateAccountInput): Promise<UpdateAccountOutput> {
    const id = EntityId.fromString(input.id)
    const account = await this.accountRepo.findById(id)
    if (!account) {
      throw new NotFoundError('Account', input.id)
    }

    const changedFields: Record<string, string | number | null> = {}

    if (input.name !== undefined) {
      if (!input.name.trim()) {
        throw new ValidationError('name', 'Name cannot be empty')
      }
      account.rename(input.name.trim())
      changedFields['name'] = account.name
    }

    if (input.offbudget !== undefined) {
      account.setOffbudget(input.offbudget)
      changedFields['offbudget'] = account.offbudget ? 1 : 0
    }

    await this.accountRepo.save(account)

    if (Object.keys(changedFields).length > 0) {
      await this.syncService.trackChanges([
        { table: 'accounts', row: account.id.toString(), data: changedFields },
      ])
    }

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
