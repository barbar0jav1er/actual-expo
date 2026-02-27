import { CategoryGroup } from '@domain/entities/CategoryGroup'
import { EntityId } from '@domain/value-objects/EntityId'
import type { categoryGroups } from '../schema'

type CategoryGroupRow = typeof categoryGroups.$inferSelect
type CategoryGroupInsert = typeof categoryGroups.$inferInsert

export class CategoryGroupMapper {
  static toDomain(row: CategoryGroupRow): CategoryGroup {
    return CategoryGroup.reconstitute({
      id:        EntityId.fromString(row.id),
      name:      row.name,
      isIncome:  row.isIncome === 1,
      hidden:    row.hidden === 1,
      sortOrder: row.sortOrder ?? 0,
      tombstone: row.tombstone === 1,
    })
  }

  static toPersistence(group: CategoryGroup): CategoryGroupInsert {
    const props = group.toObject()
    return {
      id:        props.id.toString(),
      name:      props.name,
      isIncome:  props.isIncome ? 1 : 0,
      hidden:    props.hidden ? 1 : 0,
      sortOrder: props.sortOrder,
      tombstone: props.tombstone ? 1 : 0,
    }
  }
}
