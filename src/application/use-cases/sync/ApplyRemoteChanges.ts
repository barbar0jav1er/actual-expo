import { Account, Transaction, Category, CategoryGroup, Payee } from '@domain/entities'
import { EntityId, Money, TransactionDate } from '@domain/value-objects'
import { Timestamp } from '@domain/value-objects'
import { ValueSerializer } from '@infrastructure/sync/ValueSerializer'
import type {
  AccountRepository,
  TransactionRepository,
  CategoryRepository,
  CategoryGroupRepository,
  PayeeRepository,
} from '@domain/repositories'

export interface RemoteMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string
}

export interface ApplyRemoteChangesInput {
  messages: RemoteMessage[]
}

export class ApplyRemoteChanges {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly payeeRepo: PayeeRepository
  ) {}

  async execute(input: ApplyRemoteChangesInput): Promise<void> {
    const byEntity = this.groupByEntity(input.messages)

    for (const [table, rowMap] of byEntity) {
      for (const [rowId, messages] of rowMap) {
        await this.applyToEntity(table, rowId, messages)
      }
    }
  }

  private groupByEntity(
    messages: RemoteMessage[]
  ): Map<string, Map<string, RemoteMessage[]>> {
    const result = new Map<string, Map<string, RemoteMessage[]>>()

    for (const msg of messages) {
      if (!result.has(msg.dataset)) {
        result.set(msg.dataset, new Map())
      }
      const tableMap = result.get(msg.dataset)!

      if (!tableMap.has(msg.row)) {
        tableMap.set(msg.row, [])
      }
      tableMap.get(msg.row)!.push(msg)
    }

    return result
  }

  private sortByTimestamp(messages: RemoteMessage[]): RemoteMessage[] {
    return [...messages].sort((a, b) => {
      const tsA = Timestamp.parse(a.timestamp)
      const tsB = Timestamp.parse(b.timestamp)
      if (!tsA || !tsB) return 0
      return tsA.compareTo(tsB)
    })
  }

  private async applyToEntity(
    table: string,
    rowId: string,
    messages: RemoteMessage[]
  ): Promise<void> {
    const sorted = this.sortByTimestamp(messages)

    switch (table) {
      case 'accounts':
        await this.applyToAccount(rowId, sorted)
        break
      case 'transactions':
        await this.applyToTransaction(rowId, sorted)
        break
      case 'categories':
        await this.applyToCategory(rowId, sorted)
        break
      case 'category_groups':
        await this.applyToCategoryGroup(rowId, sorted)
        break
      case 'payees':
        await this.applyToPayee(rowId, sorted)
        break
    }
  }

  private async applyToAccount(rowId: string, messages: RemoteMessage[]): Promise<void> {
    const id = EntityId.fromString(rowId)
    let account = await this.accountRepo.findById(id)

    if (!account) {
      account = Account.reconstitute({
        id,
        name: '',
        offbudget: false,
        closed: false,
        sortOrder: 0,
        tombstone: false,
      })
    }

    for (const msg of messages) {
      const value = ValueSerializer.deserialize(msg.value)
      switch (msg.column) {
        case 'name':
          if (typeof value === 'string') account.rename(value)
          break
        case 'offbudget':
          account.setOffbudget(value === 1)
          break
        case 'closed':
          if (value === 1) account.close()
          else account.reopen()
          break
        case 'sort_order':
          if (typeof value === 'number') account.setSortOrder(value)
          break
        case 'tombstone':
          if (value === 1) account.delete()
          else account.restore()
          break
      }
    }

    await this.accountRepo.save(account)
  }

  private async applyToTransaction(rowId: string, messages: RemoteMessage[]): Promise<void> {
    const id = EntityId.fromString(rowId)
    let tx = await this.transactionRepo.findById(id)

    if (!tx) {
      tx = Transaction.reconstitute({
        id,
        accountId: EntityId.fromString('00000000-0000-0000-0000-000000000000'),
        amount: Money.zero(),
        date: TransactionDate.today(),
        cleared: false,
        reconciled: false,
        tombstone: false,
        isParent: false,
        isChild: false,
        sortOrder: 0,
      })
    }

    for (const msg of messages) {
      const value = ValueSerializer.deserialize(msg.value)
      switch (msg.column) {
        case 'acct':
          if (typeof value === 'string') {
            // Reconstruct with new accountId requires reconstituting the entity
            // We use the internal props approach via the reconstitute method
            tx = Transaction.reconstitute({ ...tx.toObject(), accountId: EntityId.fromString(value) })
          }
          break
        case 'amount':
          if (typeof value === 'number') tx.setAmount(Money.fromCents(value))
          break
        case 'date':
          if (typeof value === 'number') tx.setDate(TransactionDate.fromNumber(value))
          break
        case 'category':
          tx.setCategory(typeof value === 'string' ? EntityId.fromString(value) : undefined)
          break
        case 'description':
          tx.setPayee(typeof value === 'string' ? EntityId.fromString(value) : undefined)
          break
        case 'notes':
          tx.setNotes(typeof value === 'string' ? value : undefined)
          break
        case 'cleared':
          if (value === 1) tx.clear()
          break
        case 'reconciled':
          if (value === 1 && tx.cleared) tx.reconcile()
          break
        case 'tombstone':
          if (value === 1) tx.delete()
          else tx.restore()
          break
        case 'isParent':
          if (value === 1) tx.markAsParent()
          break
      }
    }

    await this.transactionRepo.save(tx)
  }

  private async applyToCategory(rowId: string, messages: RemoteMessage[]): Promise<void> {
    const id = EntityId.fromString(rowId)
    let category = await this.categoryRepo.findById(id)

    if (!category) {
      const placeholderGroupId = EntityId.fromString('00000000-0000-0000-0000-000000000000')
      category = Category.reconstitute({
        id,
        name: '',
        groupId: placeholderGroupId,
        isIncome: false,
        hidden: false,
        sortOrder: 0,
        tombstone: false,
      })
    }

    for (const msg of messages) {
      const value = ValueSerializer.deserialize(msg.value)
      switch (msg.column) {
        case 'name':
          if (typeof value === 'string') category.rename(value)
          break
        case 'cat_group':
          if (typeof value === 'string') category.moveTo(EntityId.fromString(value))
          break
        case 'hidden':
          if (value === 1) category.hide()
          else category.show()
          break
        case 'sort_order':
          if (typeof value === 'number') category.setSortOrder(value)
          break
        case 'tombstone':
          if (value === 1) category.delete()
          else category.restore()
          break
      }
    }

    await this.categoryRepo.save(category)
  }

  private async applyToCategoryGroup(rowId: string, messages: RemoteMessage[]): Promise<void> {
    const id = EntityId.fromString(rowId)
    let group = await this.categoryGroupRepo.findById(id)

    if (!group) {
      group = CategoryGroup.reconstitute({
        id,
        name: '',
        isIncome: false,
        hidden: false,
        sortOrder: 0,
        tombstone: false,
      })
    }

    for (const msg of messages) {
      const value = ValueSerializer.deserialize(msg.value)
      switch (msg.column) {
        case 'name':
          if (typeof value === 'string') group.rename(value)
          break
        case 'hidden':
          if (value === 1) group.hide()
          else group.show()
          break
        case 'sort_order':
          if (typeof value === 'number') group.setSortOrder(value)
          break
        case 'tombstone':
          if (value === 1) group.delete()
          else group.restore()
          break
      }
    }

    await this.categoryGroupRepo.save(group)
  }

  private async applyToPayee(rowId: string, messages: RemoteMessage[]): Promise<void> {
    const id = EntityId.fromString(rowId)
    let payee = await this.payeeRepo.findById(id)

    if (!payee) {
      payee = Payee.reconstitute({
        id,
        name: '',
        tombstone: false,
      })
    }

    for (const msg of messages) {
      const value = ValueSerializer.deserialize(msg.value)
      switch (msg.column) {
        case 'name':
          if (typeof value === 'string') payee.rename(value)
          break
        case 'tombstone':
          if (value === 1) payee.delete()
          else payee.restore()
          break
      }
    }

    await this.payeeRepo.save(payee)
  }
}
