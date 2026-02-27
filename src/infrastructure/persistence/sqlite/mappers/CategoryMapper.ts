import { Category } from '@domain/entities/Category'
import { EntityId } from '@domain/value-objects/EntityId'
import type { categories } from '../schema'

type CategoryRow = typeof categories.$inferSelect
type CategoryInsert = typeof categories.$inferInsert

export class CategoryMapper {
  static toDomain(row: CategoryRow): Category {
    return Category.reconstitute({
      id:        EntityId.fromString(row.id),
      name:      row.name,
      groupId:   EntityId.fromString(row.catGroup),
      isIncome:  row.isIncome === 1,
      hidden:    row.hidden === 1,
      sortOrder: row.sortOrder ?? 0,
      tombstone: row.tombstone === 1,
    })
  }

  static toPersistence(category: Category): CategoryInsert {
    const props = category.toObject()
    return {
      id:        props.id.toString(),
      name:      props.name,
      catGroup:  props.groupId.toString(),
      isIncome:  props.isIncome ? 1 : 0,
      hidden:    props.hidden ? 1 : 0,
      sortOrder: props.sortOrder,
      tombstone: props.tombstone ? 1 : 0,
    }
  }
}
