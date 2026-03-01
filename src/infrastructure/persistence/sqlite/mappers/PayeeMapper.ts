import { Payee } from '@domain/entities/Payee'
import { EntityId } from '@domain/value-objects/EntityId'

export interface PayeeRow {
  id: string
  name: string | null
  transfer_acct: string | null
  tombstone: number | null
}

export class PayeeMapper {
  static toDomain(row: PayeeRow): Payee {
    return Payee.reconstitute({
      id:                EntityId.fromString(row.id),
      name:              row.name ?? '',
      transferAccountId: row.transfer_acct ? EntityId.fromString(row.transfer_acct) : undefined,
      tombstone:         row.tombstone === 1,
    })
  }

  static toPersistence(payee: Payee): PayeeRow {
    const props = payee.toObject()
    return {
      id:            props.id.toString(),
      name:          props.name,
      transfer_acct: props.transferAccountId?.toString() ?? null,
      tombstone:     props.tombstone ? 1 : 0,
    }
  }
}
