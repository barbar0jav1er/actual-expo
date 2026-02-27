import { EntityId, Money, TransactionDate } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type {
  AccountRepository,
  TransactionRepository,
  CategoryRepository,
  PayeeRepository,
} from '@domain/repositories'
import type { TransactionDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'
import { toTransactionDTO } from './CreateTransaction'

export interface UpdateTransactionInput {
  id: string
  amount?: number
  date?: string
  categoryId?: string | null
  payeeId?: string | null
  notes?: string | null
  cleared?: boolean
}

export interface UpdateTransactionOutput {
  transaction: TransactionDTO
}

export class UpdateTransaction {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly payeeRepo: PayeeRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: UpdateTransactionInput): Promise<UpdateTransactionOutput> {
    const tx = await this.transactionRepo.findById(EntityId.fromString(input.id))
    if (!tx) {
      throw new NotFoundError('Transaction', input.id)
    }

    const changedFields: Record<string, string | number | null> = {}

    if (input.amount !== undefined) {
      tx.setAmount(Money.fromCents(input.amount))
      changedFields['amount'] = tx.amount.toCents()
    }

    if (input.date !== undefined) {
      tx.setDate(TransactionDate.fromString(input.date))
      changedFields['date'] = tx.date.toNumber()
    }

    if ('categoryId' in input) {
      const catId = input.categoryId
        ? EntityId.fromString(input.categoryId)
        : undefined
      if (input.categoryId) {
        const cat = await this.categoryRepo.findById(EntityId.fromString(input.categoryId))
        if (!cat) throw new NotFoundError('Category', input.categoryId)
      }
      tx.setCategory(catId)
      changedFields['category'] = catId?.toString() ?? null
    }

    if ('payeeId' in input) {
      const payeeId = input.payeeId
        ? EntityId.fromString(input.payeeId)
        : undefined
      if (input.payeeId) {
        const p = await this.payeeRepo.findById(EntityId.fromString(input.payeeId))
        if (!p) throw new NotFoundError('Payee', input.payeeId)
      }
      tx.setPayee(payeeId)
      changedFields['description'] = payeeId?.toString() ?? null
    }

    if ('notes' in input) {
      tx.setNotes(input.notes ?? undefined)
      changedFields['notes'] = input.notes ?? null
    }

    if (input.cleared !== undefined) {
      if (input.cleared) {
        tx.clear()
      } else {
        tx.unclear()
      }
      changedFields['cleared'] = tx.cleared ? 1 : 0
    }

    await this.transactionRepo.save(tx)

    if (Object.keys(changedFields).length > 0) {
      await this.syncService.trackChanges([
        { table: 'transactions', row: tx.id.toString(), data: changedFields },
      ])
    }

    const account = await this.accountRepo.findById(tx.accountId)
    const category = tx.categoryId ? await this.categoryRepo.findById(tx.categoryId) : null
    const payee = tx.payeeId ? await this.payeeRepo.findById(tx.payeeId) : null

    return {
      transaction: toTransactionDTO(tx, account!, category, payee),
    }
  }
}
