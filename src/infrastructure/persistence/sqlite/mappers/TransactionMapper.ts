import { Transaction } from '@domain/entities/Transaction'
import { EntityId } from '@domain/value-objects/EntityId'
import { Money } from '@domain/value-objects/Money'
import { TransactionDate } from '@domain/value-objects/TransactionDate'

export interface TransactionRow {
  id: string
  acct: string | null
  category: string | null
  amount: number | null
  description: string | null
  notes: string | null
  date: number | null
  cleared: number | null
  reconciled: number | null
  tombstone: number | null
  isParent: number | null
  isChild: number | null
  parent_id: string | null
  sort_order: number | null
  starting_balance_flag: number | null
}

export class TransactionMapper {
  static toDomain(row: TransactionRow): Transaction {
    return Transaction.reconstitute({
      id:         EntityId.fromString(row.id),
      accountId:  EntityId.fromString(row.acct ?? ''),
      categoryId: row.category    ? EntityId.fromString(row.category)    : undefined,
      payeeId:    row.description ? EntityId.fromString(row.description) : undefined,
      amount:     Money.fromCents(row.amount ?? 0),
      date:       TransactionDate.fromNumber(row.date ?? 0),
      notes:      row.notes ?? undefined,
      cleared:    row.cleared === 1,
      reconciled: row.reconciled === 1,
      tombstone:  row.tombstone === 1,
      isParent:   row.isParent === 1,
      isChild:    row.isChild === 1,
      parentId:   row.parent_id ? EntityId.fromString(row.parent_id) : undefined,
      sortOrder:  row.sort_order ?? 0,
    })
  }

  static toPersistence(tx: Transaction): TransactionRow {
    const props = tx.toObject()
    return {
      id:                    props.id.toString(),
      acct:                  props.accountId.toString(),
      category:              props.categoryId?.toString() ?? null,
      amount:                props.amount.toCents(),
      description:           props.payeeId?.toString() ?? null,
      notes:                 props.notes ?? null,
      date:                  props.date.toNumber(),
      cleared:               props.cleared ? 1 : 0,
      reconciled:            props.reconciled ? 1 : 0,
      tombstone:             props.tombstone ? 1 : 0,
      isParent:              props.isParent ? 1 : 0,
      isChild:               props.isChild ? 1 : 0,
      parent_id:             props.parentId?.toString() ?? null,
      sort_order:            props.sortOrder,
      starting_balance_flag: null,
    }
  }
}
