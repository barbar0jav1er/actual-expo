import type { Category } from '@domain/entities/Category'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { CategoryRepository } from '@domain/repositories/CategoryRepository'
import { CategoryMapper } from '../mappers/CategoryMapper'
import type { AppDatabase } from '../db'

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: EntityId): Promise<Category | null> {
    const row = await this.db.first(
      'SELECT * FROM categories WHERE id = ?',
      [id.toString()],
    )
    return row ? CategoryMapper.toDomain(row as any) : null
  }

  async findAll(): Promise<Category[]> {
    const rows = await this.db.all(
      'SELECT * FROM categories WHERE tombstone = 0 ORDER BY sort_order, id',
    )
    return rows.map(r => CategoryMapper.toDomain(r as any))
  }

  async findActive(): Promise<Category[]> {
    return this.findAll()
  }

  async findByGroup(groupId: EntityId): Promise<Category[]> {
    const rows = await this.db.all(
      'SELECT * FROM categories WHERE cat_group = ? AND tombstone = 0 ORDER BY sort_order, id',
      [groupId.toString()],
    )
    return rows.map(r => CategoryMapper.toDomain(r as any))
  }

  async save(category: Category): Promise<void> {
    const r = CategoryMapper.toPersistence(category)
    await this.db.run(
      `INSERT INTO categories (id, name, cat_group, is_income, hidden, sort_order, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name       = excluded.name,
         cat_group  = excluded.cat_group,
         is_income  = excluded.is_income,
         hidden     = excluded.hidden,
         sort_order = excluded.sort_order,
         tombstone  = excluded.tombstone`,
      [r.id, r.name, r.cat_group, r.is_income, r.hidden, r.sort_order, r.tombstone],
    )
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'UPDATE categories SET tombstone = 1 WHERE id = ?',
      [id.toString()],
    )
  }
}
