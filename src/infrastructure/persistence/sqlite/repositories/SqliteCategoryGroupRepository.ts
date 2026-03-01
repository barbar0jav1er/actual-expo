import type { CategoryGroup } from '@domain/entities/CategoryGroup'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { CategoryGroupRepository } from '@domain/repositories/CategoryGroupRepository'
import { CategoryGroupMapper } from '../mappers/CategoryGroupMapper'
import type { AppDatabase } from '../db'

export class SqliteCategoryGroupRepository implements CategoryGroupRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: EntityId): Promise<CategoryGroup | null> {
    const row = await this.db.first(
      'SELECT * FROM category_groups WHERE id = ?',
      [id.toString()],
    )
    return row ? CategoryGroupMapper.toDomain(row as any) : null
  }

  async findAll(): Promise<CategoryGroup[]> {
    const rows = await this.db.all(
      'SELECT * FROM category_groups WHERE tombstone = 0 ORDER BY sort_order, id',
    )
    return rows.map(r => CategoryGroupMapper.toDomain(r as any))
  }

  async findActive(): Promise<CategoryGroup[]> {
    return this.findAll()
  }

  async save(group: CategoryGroup): Promise<void> {
    const r = CategoryGroupMapper.toPersistence(group)
    await this.db.run(
      `INSERT INTO category_groups (id, name, is_income, hidden, sort_order, tombstone)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name       = excluded.name,
         is_income  = excluded.is_income,
         hidden     = excluded.hidden,
         sort_order = excluded.sort_order,
         tombstone  = excluded.tombstone`,
      [r.id, r.name, r.is_income, r.hidden, r.sort_order, r.tombstone],
    )
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'UPDATE category_groups SET tombstone = 1 WHERE id = ?',
      [id.toString()],
    )
  }
}
