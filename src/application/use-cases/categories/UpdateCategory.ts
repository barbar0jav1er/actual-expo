import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { CategoryRepository, CategoryGroupRepository } from '@domain/repositories'
import type { CategoryDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface UpdateCategoryInput {
  id: string
  name?: string
  hidden?: boolean
  groupId?: string
}

export interface UpdateCategoryOutput {
  category: CategoryDTO
}

export class UpdateCategory {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: UpdateCategoryInput): Promise<UpdateCategoryOutput> {
    const id = EntityId.fromString(input.id)
    const category = await this.categoryRepo.findById(id)
    if (!category) {
      throw new NotFoundError('Category', input.id)
    }

    const changedFields: Record<string, string | number | null> = {}

    if (input.name !== undefined) {
      category.rename(input.name)
      changedFields['name'] = category.name
    }

    if (input.hidden !== undefined) {
      if (input.hidden) {
        category.hide()
      } else {
        category.show()
      }
      changedFields['hidden'] = category.hidden ? 1 : 0
    }

    if (input.groupId !== undefined) {
      const newGroupId = EntityId.fromString(input.groupId)
      category.moveTo(newGroupId)
      changedFields['cat_group'] = input.groupId
    }

    await this.categoryRepo.save(category)

    if (Object.keys(changedFields).length > 0) {
      await this.syncService.trackChanges([
        { table: 'categories', row: category.id.toString(), data: changedFields },
      ])
    }

    const group = await this.categoryGroupRepo.findById(category.groupId)

    return {
      category: {
        id: category.id.toString(),
        name: category.name,
        groupId: category.groupId.toString(),
        groupName: group?.name ?? '',
        isIncome: category.isIncome,
        hidden: category.hidden,
      },
    }
  }
}
