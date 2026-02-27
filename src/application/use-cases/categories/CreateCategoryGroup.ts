import { CategoryGroup } from '@domain/entities'
import type { CategoryGroupRepository } from '@domain/repositories'
import type { CategoryGroupDTO } from '@application/dtos'
import type { SyncService } from '@application/services/SyncService'

export interface CreateCategoryGroupInput {
  name: string
  isIncome?: boolean
}

export interface CreateCategoryGroupOutput {
  group: CategoryGroupDTO
}

export class CreateCategoryGroup {
  constructor(
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: CreateCategoryGroupInput): Promise<CreateCategoryGroupOutput> {
    const group = CategoryGroup.create({
      name: input.name,
      isIncome: input.isIncome ?? false,
    })

    await this.categoryGroupRepo.save(group)

    await this.syncService.trackChanges([
      {
        table: 'category_groups',
        row: group.id.toString(),
        data: {
          id: group.id.toString(),
          name: group.name,
          is_income: group.isIncome ? 1 : 0,
          hidden: group.hidden ? 1 : 0,
          sort_order: group.sortOrder,
          tombstone: group.tombstone ? 1 : 0,
        },
      },
    ])

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
