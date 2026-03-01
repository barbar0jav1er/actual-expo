import { Category } from '@domain/entities'
import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { CategoryRepository, CategoryGroupRepository } from '@domain/repositories'
import type { CategoryDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface CreateCategoryInput {
  name: string
  groupId: string
  isIncome?: boolean
}

export interface CreateCategoryOutput {
  category: CategoryDTO
}

export class CreateCategory {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: CreateCategoryInput): Promise<CreateCategoryOutput> {
    const groupId = EntityId.fromString(input.groupId)
    const group = await this.categoryGroupRepo.findById(groupId)
    if (!group) {
      throw new NotFoundError('CategoryGroup', input.groupId)
    }

    const category = Category.create({
      name: input.name,
      groupId,
      isIncome: input.isIncome ?? group.isIncome,
    })

    await this.categoryRepo.save(category)

    await this.syncService.trackChanges([
      {
        table: 'categories',
        row: category.id.toString(),
        data: {
          name: category.name,
          cat_group: category.groupId.toString(),
          is_income: category.isIncome ? 1 : 0,
          hidden: category.hidden ? 1 : 0,
          sort_order: category.sortOrder,
          tombstone: category.tombstone ? 1 : 0,
        },
      },
    ])

    return {
      category: {
        id: category.id.toString(),
        name: category.name,
        groupId: group.id.toString(),
        groupName: group.name,
        isIncome: category.isIncome,
        hidden: category.hidden,
      },
    }
  }
}
