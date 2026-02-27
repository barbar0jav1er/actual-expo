import { and, eq } from 'drizzle-orm'
import type { Payee } from '@domain/entities/Payee'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { PayeeRepository } from '@domain/repositories/PayeeRepository'
import { payees } from '../schema'
import { PayeeMapper } from '../mappers/PayeeMapper'
import type { DrizzleDB } from '../types'

export class DrizzlePayeeRepository implements PayeeRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: EntityId): Promise<Payee | null> {
    const row = await (this.db as any)
      .select()
      .from(payees)
      .where(eq(payees.id, id.toString()))
      .get()
    return row ? PayeeMapper.toDomain(row) : null
  }

  async findAll(): Promise<Payee[]> {
    const rows = await (this.db as any)
      .select()
      .from(payees)
      .where(eq(payees.tombstone, 0))
      .all()
    return rows.map(PayeeMapper.toDomain)
  }

  async findActive(): Promise<Payee[]> {
    return this.findAll()
  }

  async findByName(name: string): Promise<Payee | null> {
    const row = await (this.db as any)
      .select()
      .from(payees)
      .where(and(eq(payees.name, name), eq(payees.tombstone, 0)))
      .get()
    return row ? PayeeMapper.toDomain(row) : null
  }

  async findTransferPayee(accountId: EntityId): Promise<Payee | null> {
    const row = await (this.db as any)
      .select()
      .from(payees)
      .where(and(eq(payees.transferAcct, accountId.toString()), eq(payees.tombstone, 0)))
      .get()
    return row ? PayeeMapper.toDomain(row) : null
  }

  async save(payee: Payee): Promise<void> {
    const row = PayeeMapper.toPersistence(payee)
    await (this.db as any)
      .insert(payees)
      .values(row)
      .onConflictDoUpdate({
        target: payees.id,
        set: {
          name:         row.name,
          transferAcct: row.transferAcct,
          tombstone:    row.tombstone,
        },
      })
  }

  async delete(id: EntityId): Promise<void> {
    await (this.db as any)
      .update(payees)
      .set({ tombstone: 1 })
      .where(eq(payees.id, id.toString()))
  }
}
