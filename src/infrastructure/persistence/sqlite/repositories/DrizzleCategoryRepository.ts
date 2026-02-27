import { and, eq } from 'drizzle-orm'
import type { Category } from '@domain/entities/Category'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { CategoryRepository } from '@domain/repositories/CategoryRepository'
import { categories } from '../schema'
import { CategoryMapper } from '../mappers/CategoryMapper'
import type { DrizzleDB } from '../types'

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: EntityId): Promise<Category | null> {
    const row = await (this.db as any)
      .select()
      .from(categories)
      .where(eq(categories.id, id.toString()))
      .get()
    return row ? CategoryMapper.toDomain(row) : null
  }

  async findAll(): Promise<Category[]> {
    const rows = await (this.db as any)
      .select()
      .from(categories)
      .where(eq(categories.tombstone, 0))
      .orderBy(categories.sortOrder)
      .all()
    return rows.map(CategoryMapper.toDomain)
  }

  async findByGroup(groupId: EntityId): Promise<Category[]> {
    const rows = await (this.db as any)
      .select()
      .from(categories)
      .where(and(eq(categories.catGroup, groupId.toString()), eq(categories.tombstone, 0)))
      .orderBy(categories.sortOrder)
      .all()
    return rows.map(CategoryMapper.toDomain)
  }

  async save(category: Category): Promise<void> {
    const row = CategoryMapper.toPersistence(category)
    await (this.db as any)
      .insert(categories)
      .values(row)
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name:      row.name,
          catGroup:  row.catGroup,
          isIncome:  row.isIncome,
          hidden:    row.hidden,
          sortOrder: row.sortOrder,
          tombstone: row.tombstone,
        },
      })
  }

  async delete(id: EntityId): Promise<void> {
    await (this.db as any)
      .update(categories)
      .set({ tombstone: 1 })
      .where(eq(categories.id, id.toString()))
  }
}
