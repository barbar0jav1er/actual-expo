import type { Payee } from '@domain/entities/Payee'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { PayeeRepository } from '@domain/repositories/PayeeRepository'
import { PayeeMapper } from '../mappers/PayeeMapper'
import type { AppDatabase } from '../db'

export class SqlitePayeeRepository implements PayeeRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: EntityId): Promise<Payee | null> {
    const row = await this.db.first(
      'SELECT * FROM payees WHERE id = ?',
      [id.toString()],
    )
    return row ? PayeeMapper.toDomain(row as any) : null
  }

  async findAll(): Promise<Payee[]> {
    const rows = await this.db.all(
      'SELECT * FROM payees WHERE tombstone = 0 ORDER BY name',
    )
    return rows.map(r => PayeeMapper.toDomain(r as any))
  }

  async findActive(): Promise<Payee[]> {
    return this.findAll()
  }

  async findByName(name: string): Promise<Payee | null> {
    const row = await this.db.first(
      'SELECT * FROM payees WHERE name = ? AND tombstone = 0',
      [name],
    )
    return row ? PayeeMapper.toDomain(row as any) : null
  }

  async findTransferPayee(accountId: EntityId): Promise<Payee | null> {
    const row = await this.db.first(
      'SELECT * FROM payees WHERE transfer_acct = ? AND tombstone = 0',
      [accountId.toString()],
    )
    return row ? PayeeMapper.toDomain(row as any) : null
  }

  async save(payee: Payee): Promise<void> {
    const r = PayeeMapper.toPersistence(payee)
    await this.db.run(
      `INSERT INTO payees (id, name, transfer_acct, tombstone)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name          = excluded.name,
         transfer_acct = excluded.transfer_acct,
         tombstone     = excluded.tombstone`,
      [r.id, r.name, r.transfer_acct, r.tombstone],
    )
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'UPDATE payees SET tombstone = 1 WHERE id = ?',
      [id.toString()],
    )
  }
}
