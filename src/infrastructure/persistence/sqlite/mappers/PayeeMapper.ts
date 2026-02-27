import { Payee } from '@domain/entities/Payee'
import { EntityId } from '@domain/value-objects/EntityId'
import type { payees } from '../schema'

type PayeeRow = typeof payees.$inferSelect
type PayeeInsert = typeof payees.$inferInsert

export class PayeeMapper {
  static toDomain(row: PayeeRow): Payee {
    return Payee.reconstitute({
      id:                EntityId.fromString(row.id),
      name:              row.name,
      transferAccountId: row.transferAcct ? EntityId.fromString(row.transferAcct) : undefined,
      tombstone:         row.tombstone === 1,
    })
  }

  static toPersistence(payee: Payee): PayeeInsert {
    const props = payee.toObject()
    return {
      id:           props.id.toString(),
      name:         props.name,
      transferAcct: props.transferAccountId?.toString() ?? null,
      tombstone:    props.tombstone ? 1 : 0,
    }
  }
}
