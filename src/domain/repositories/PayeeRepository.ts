import { Payee } from '../entities'
import { EntityId } from '../value-objects'

export interface PayeeRepository {
  findById(id: EntityId): Promise<Payee | null>
  findAll(): Promise<Payee[]>
  findActive(): Promise<Payee[]>
  findByName(name: string): Promise<Payee | null>
  findTransferPayee(accountId: EntityId): Promise<Payee | null>
  save(payee: Payee): Promise<void>
  delete(id: EntityId): Promise<void>
}
