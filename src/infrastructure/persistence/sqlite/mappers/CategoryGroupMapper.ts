import { CategoryGroup } from '@domain/entities/CategoryGroup'
import { EntityId } from '@domain/value-objects/EntityId'

export interface CategoryGroupRow {
  id: string
  name: string | null
  is_income: number | null
  sort_order: number | null
  hidden: number | null
  tombstone: number | null
}

export class CategoryGroupMapper {
  static toDomain(row: CategoryGroupRow): CategoryGroup {
    return CategoryGroup.reconstitute({
      id:        EntityId.fromString(row.id),
      name:      row.name ?? '',
      isIncome:  row.is_income === 1,
      hidden:    row.hidden === 1,
      sortOrder: row.sort_order ?? 0,
      tombstone: row.tombstone === 1,
    })
  }

  static toPersistence(group: CategoryGroup): CategoryGroupRow {
    const props = group.toObject()
    return {
      id:         props.id.toString(),
      name:       props.name,
      is_income:  props.isIncome ? 1 : 0,
      hidden:     props.hidden ? 1 : 0,
      sort_order: props.sortOrder,
      tombstone:  props.tombstone ? 1 : 0,
    }
  }
}
