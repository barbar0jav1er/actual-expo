import { CategoryGroup } from '../entities'
import { EntityId } from '../value-objects'

export interface CategoryGroupRepository {
  findById(id: EntityId): Promise<CategoryGroup | null>
  findAll(): Promise<CategoryGroup[]>
  findActive(): Promise<CategoryGroup[]>
  save(group: CategoryGroup): Promise<void>
  delete(id: EntityId): Promise<void>
}
