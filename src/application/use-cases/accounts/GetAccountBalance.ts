import { Money, EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { AccountRepository, TransactionRepository } from '@domain/repositories'

export interface GetAccountBalanceInput {
  accountId: string
}

export interface GetAccountBalanceOutput {
  balance: number // cents
}

export class GetAccountBalance {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(input: GetAccountBalanceInput): Promise<GetAccountBalanceOutput> {
    const id = EntityId.fromString(input.accountId)
    const account = await this.accountRepo.findById(id)
    if (!account) {
      throw new NotFoundError('Account', input.accountId)
    }

    const transactions = await this.transactionRepo.findByAccount(id)
    const balance = transactions
      .filter(tx => !tx.tombstone)
      .reduce((sum, tx) => sum.add(tx.amount), Money.zero())

    return { balance: balance.toCents() }
  }
}
