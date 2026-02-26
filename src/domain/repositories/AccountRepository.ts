import { Account } from '../entities'
import { EntityId } from '../value-objects'

export interface AccountRepository {
  findById(id: EntityId): Promise<Account | null>
  findAll(): Promise<Account[]>
  findActive(): Promise<Account[]>
  save(account: Account): Promise<void>
  delete(id: EntityId): Promise<void>
}
