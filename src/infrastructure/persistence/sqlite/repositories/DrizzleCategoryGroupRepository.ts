import { eq } from 'drizzle-orm'
import type { CategoryGroup } from '@domain/entities/CategoryGroup'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { CategoryGroupRepository } from '@domain/repositories/CategoryGroupRepository'
import { categoryGroups } from '../schema'
import { CategoryGroupMapper } from '../mappers/CategoryGroupMapper'
import type { DrizzleDB } from '../types'

export class DrizzleCategoryGroupRepository implements CategoryGroupRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: EntityId): Promise<CategoryGroup | null> {
    const row = await (this.db as any)
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.id, id.toString()))
      .get()
    return row ? CategoryGroupMapper.toDomain(row) : null
  }

  async findAll(): Promise<CategoryGroup[]> {
    const rows = await (this.db as any)
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.tombstone, 0))
      .orderBy(categoryGroups.sortOrder)
      .all()
    return rows.map(CategoryGroupMapper.toDomain)
  }

  async findActive(): Promise<CategoryGroup[]> {
    return this.findAll()
  }

  async save(group: CategoryGroup): Promise<void> {
    const row = CategoryGroupMapper.toPersistence(group)
    await (this.db as any)
      .insert(categoryGroups)
      .values(row)
      .onConflictDoUpdate({
        target: categoryGroups.id,
        set: {
          name:      row.name,
          isIncome:  row.isIncome,
          hidden:    row.hidden,
          sortOrder: row.sortOrder,
          tombstone: row.tombstone,
        },
      })
  }

  async delete(id: EntityId): Promise<void> {
    await (this.db as any)
      .update(categoryGroups)
      .set({ tombstone: 1 })
      .where(eq(categoryGroups.id, id.toString()))
  }
}
