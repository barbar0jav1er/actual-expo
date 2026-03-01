import { Account } from '@domain/entities/Account'
import { EntityId } from '@domain/value-objects/EntityId'

export interface AccountRow {
  id: string
  name: string | null
  offbudget: number | null
  closed: number | null
  sort_order: number | null
  tombstone: number | null
}

export class AccountMapper {
  static toDomain(row: AccountRow): Account {
    return Account.reconstitute({
      id:        EntityId.fromString(row.id),
      name:      row.name ?? '',
      offbudget: row.offbudget === 1,
      closed:    row.closed === 1,
      sortOrder: row.sort_order ?? 0,
      tombstone: row.tombstone === 1,
    })
  }

  static toPersistence(account: Account): AccountRow {
    const props = account.toObject()
    return {
      id:         props.id.toString(),
      name:       props.name,
      offbudget:  props.offbudget ? 1 : 0,
      closed:     props.closed ? 1 : 0,
      sort_order: props.sortOrder,
      tombstone:  props.tombstone ? 1 : 0,
    }
  }
}
