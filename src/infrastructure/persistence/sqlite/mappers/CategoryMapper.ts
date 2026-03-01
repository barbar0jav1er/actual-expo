import { Category } from '@domain/entities/Category'
import { EntityId } from '@domain/value-objects/EntityId'

export interface CategoryRow {
  id: string
  name: string | null
  is_income: number | null
  cat_group: string | null
  sort_order: number | null
  hidden: number | null
  tombstone: number | null
}

export class CategoryMapper {
  static toDomain(row: CategoryRow): Category {
    return Category.reconstitute({
      id:        EntityId.fromString(row.id),
      name:      row.name ?? '',
      groupId:   EntityId.fromString(row.cat_group ?? ''),
      isIncome:  row.is_income === 1,
      hidden:    row.hidden === 1,
      sortOrder: row.sort_order ?? 0,
      tombstone: row.tombstone === 1,
    })
  }

  static toPersistence(category: Category): CategoryRow {
    const props = category.toObject()
    return {
      id:         props.id.toString(),
      name:       props.name,
      cat_group:  props.groupId.toString(),
      is_income:  props.isIncome ? 1 : 0,
      hidden:     props.hidden ? 1 : 0,
      sort_order: props.sortOrder,
      tombstone:  props.tombstone ? 1 : 0,
    }
  }
}
