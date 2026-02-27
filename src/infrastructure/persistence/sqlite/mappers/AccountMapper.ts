import { Account } from '@domain/entities/Account'
import { EntityId } from '@domain/value-objects/EntityId'
import type { accounts } from '../schema'

type AccountRow = typeof accounts.$inferSelect
type AccountInsert = typeof accounts.$inferInsert

export class AccountMapper {
  static toDomain(row: AccountRow): Account {
    return Account.reconstitute({
      id:        EntityId.fromString(row.id),
      name:      row.name,
      offbudget: row.offbudget === 1,
      closed:    row.closed === 1,
      sortOrder: row.sortOrder ?? 0,
      tombstone: row.tombstone === 1,
    })
  }

  static toPersistence(account: Account): AccountInsert {
    const props = account.toObject()
    return {
      id:        props.id.toString(),
      name:      props.name,
      offbudget: props.offbudget ? 1 : 0,
      closed:    props.closed ? 1 : 0,
      sortOrder: props.sortOrder,
      tombstone: props.tombstone ? 1 : 0,
    }
  }
}
