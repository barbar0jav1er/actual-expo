import { Money } from '@domain/value-objects'
import type { Account } from '@domain/entities'
import type { AccountRepository, TransactionRepository } from '@domain/repositories'
import type { EntityId } from '@domain/value-objects'
import type { AccountDTO } from '@application/dtos'

export interface GetAccountsOutput {
  accounts: AccountDTO[]
}

export class GetAccounts {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(): Promise<GetAccountsOutput> {
    const accounts = await this.accountRepo.findActive()

    const accountsWithBalance = await Promise.all(
      accounts.map(async account => {
        const balance = await this.calculateBalance(account.id)
        return this.toDTO(account, balance)
      })
    )

    return { accounts: accountsWithBalance }
  }

  private async calculateBalance(accountId: EntityId): Promise<Money> {
    const transactions = await this.transactionRepo.findByAccount(accountId)
    return transactions
      .filter(tx => !tx.tombstone && !tx.isParent)
      .reduce((sum, tx) => sum.add(tx.amount), Money.zero())
  }

  private toDTO(account: Account, balance: Money): AccountDTO {
    return {
      id: account.id.toString(),
      name: account.name,
      offbudget: account.offbudget,
      closed: account.closed,
      balance: balance.toCents(),
    }
  }
}
