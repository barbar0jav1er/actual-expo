import { Category } from '../entities'
import { EntityId } from '../value-objects'

export interface CategoryRepository {
  findById(id: EntityId): Promise<Category | null>
  findAll(): Promise<Category[]>
  findByGroup(groupId: EntityId): Promise<Category[]>
  findActive(): Promise<Category[]>
  save(category: Category): Promise<void>
  delete(id: EntityId): Promise<void>
}
