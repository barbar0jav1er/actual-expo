import { Transaction } from '@domain/entities/Transaction'
import { EntityId } from '@domain/value-objects/EntityId'
import { Money } from '@domain/value-objects/Money'
import { TransactionDate } from '@domain/value-objects/TransactionDate'
import type { transactions } from '../schema'

type TransactionRow = typeof transactions.$inferSelect
type TransactionInsert = typeof transactions.$inferInsert

export class TransactionMapper {
  static toDomain(row: TransactionRow): Transaction {
    return Transaction.reconstitute({
      id:         EntityId.fromString(row.id),
      accountId:  EntityId.fromString(row.acct),
      categoryId: row.category    ? EntityId.fromString(row.category)    : undefined,
      payeeId:    row.description ? EntityId.fromString(row.description) : undefined,
      amount:     Money.fromCents(row.amount),
      date:       TransactionDate.fromNumber(row.date),
      notes:      row.notes ?? undefined,
      cleared:    row.cleared === 1,
      reconciled: row.reconciled === 1,
      tombstone:  row.tombstone === 1,
      isParent:   row.isParent === 1,
      isChild:    row.isChild === 1,
      parentId:   row.parentId ? EntityId.fromString(row.parentId) : undefined,
      sortOrder:  row.sortOrder ?? 0,
    })
  }

  static toPersistence(tx: Transaction): TransactionInsert {
    const props = tx.toObject()
    return {
      id:          props.id.toString(),
      acct:        props.accountId.toString(),
      category:    props.categoryId?.toString() ?? null,
      amount:      props.amount.toCents(),
      description: props.payeeId?.toString() ?? null,
      notes:       props.notes ?? null,
      date:        props.date.toNumber(),
      cleared:     props.cleared ? 1 : 0,
      reconciled:  props.reconciled ? 1 : 0,
      tombstone:   props.tombstone ? 1 : 0,
      isParent:    props.isParent ? 1 : 0,
      isChild:     props.isChild ? 1 : 0,
      parentId:    props.parentId?.toString() ?? null,
      sortOrder:   props.sortOrder,
    }
  }
}
