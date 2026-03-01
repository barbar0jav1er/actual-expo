import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { CategoryGroupRepository } from '@domain/repositories'
import type { CategoryGroupDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface UpdateCategoryGroupInput {
  id: string
  name?: string
  hidden?: boolean
}

export interface UpdateCategoryGroupOutput {
  group: CategoryGroupDTO
}

export class UpdateCategoryGroup {
  constructor(
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: UpdateCategoryGroupInput): Promise<UpdateCategoryGroupOutput> {
    const id = EntityId.fromString(input.id)
    const group = await this.categoryGroupRepo.findById(id)
    if (!group) {
      throw new NotFoundError('CategoryGroup', input.id)
    }

    const changedFields: Record<string, string | number | null> = {}

    if (input.name !== undefined) {
      group.rename(input.name)
      changedFields['name'] = group.name
    }

    if (input.hidden !== undefined) {
      if (input.hidden) {
        group.hide()
      } else {
        group.show()
      }
      changedFields['hidden'] = group.hidden ? 1 : 0
    }

    await this.categoryGroupRepo.save(group)

    if (Object.keys(changedFields).length > 0) {
      await this.syncService.trackChanges([
        { table: 'category_groups', row: group.id.toString(), data: changedFields },
      ])
    }

    return {
      group: {
        id: group.id.toString(),
        name: group.name,
        isIncome: group.isIncome,
        hidden: group.hidden,
        categories: [],
      },
    }
  }
}
