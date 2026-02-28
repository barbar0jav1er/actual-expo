import { Account } from '@domain/entities'
import { Payee } from '@domain/entities'
import { Transaction } from '@domain/entities'
import { Money, TransactionDate } from '@domain/value-objects'
import { ValidationError } from '@domain/errors'
import type { AccountRepository } from '@domain/repositories'
import type { PayeeRepository } from '@domain/repositories'
import type { TransactionRepository } from '@domain/repositories'
import type { AccountDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface CreateAccountInput {
  name: string
  offbudget?: boolean
  initialBalance?: number
}

export interface CreateAccountOutput {
  account: AccountDTO
  balance: number
}

export class CreateAccount {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository,
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

    const changes: Parameters<SyncService['trackChanges']>[0] = [
      {
        table: 'accounts',
        row: account.id.toString(),
        data: {
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
          name: transferPayee.name,
          transfer_acct: transferPayee.transferAccountId?.toString() ?? null,
          tombstone: transferPayee.tombstone ? 1 : 0,
        },
      },
    ]

    const initialBalance = input.initialBalance ?? 0

    if (initialBalance !== 0) {
      const existing = await this.payeeRepo.findByName('Starting Balance')
      const isNewPayee = existing === null
      const startingPayee: Payee = isNewPayee
        ? Payee.create({ name: 'Starting Balance' })
        : existing

      if (isNewPayee) {
        await this.payeeRepo.save(startingPayee)
      }

      const tx = Transaction.create({
        accountId: account.id,
        amount: Money.fromCents(initialBalance),
        date: TransactionDate.today(),
        payeeId: startingPayee.id,
      })
      tx.clear()

      await this.transactionRepo.save(tx)

      if (isNewPayee) {
        changes.push({
          table: 'payees',
          row: startingPayee.id.toString(),
          data: {
            name: startingPayee.name,
            transfer_acct: null,
            tombstone: startingPayee.tombstone ? 1 : 0,
          },
        })
      }

      changes.push({
        table: 'transactions',
        row: tx.id.toString(),
        data: {
          acct: account.id.toString(),
          amount: tx.amount.toCents(),
          date: tx.date.toNumber(),
          description: startingPayee.id.toString(),
          category: null,
          notes: null,
          cleared: 1,
          reconciled: 0,
          tombstone: 0,
          isParent: 0,
          isChild: 0,
          parent_id: null,
          sort_order: 0,
          starting_balance_flag: 1,
        },
      })
    }

    await this.syncService.trackChanges(changes)

    return {
      account: {
        id: account.id.toString(),
        name: account.name,
        offbudget: account.offbudget,
        closed: account.closed,
        balance: initialBalance,
      },
      balance: initialBalance,
    }
  }
}
