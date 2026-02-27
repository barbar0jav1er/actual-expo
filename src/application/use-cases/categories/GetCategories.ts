import type { Category, CategoryGroup } from '@domain/entities'
import type { CategoryRepository, CategoryGroupRepository } from '@domain/repositories'
import type { CategoryDTO, CategoryGroupDTO } from '@application/dtos'

export interface GetCategoriesOutput {
  groups: CategoryGroupDTO[]
}

export class GetCategories {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly categoryGroupRepo: CategoryGroupRepository
  ) {}

  async execute(): Promise<GetCategoriesOutput> {
    const [groups, categories] = await Promise.all([
      this.categoryGroupRepo.findAll(),
      this.categoryRepo.findAll(),
    ])

    const categoryMap = new Map<string, Category[]>()
    for (const cat of categories) {
      if (cat.tombstone) continue
      const groupId = cat.groupId.toString()
      if (!categoryMap.has(groupId)) {
        categoryMap.set(groupId, [])
      }
      categoryMap.get(groupId)!.push(cat)
    }

    const groupDTOs: CategoryGroupDTO[] = groups
      .filter(g => !g.tombstone)
      .map(group => this.toGroupDTO(group, categoryMap.get(group.id.toString()) ?? []))

    return { groups: groupDTOs }
  }

  private toGroupDTO(group: CategoryGroup, categories: Category[]): CategoryGroupDTO {
    return {
      id: group.id.toString(),
      name: group.name,
      isIncome: group.isIncome,
      hidden: group.hidden,
      categories: categories.map(cat => this.toCategoryDTO(cat, group)),
    }
  }

  private toCategoryDTO(category: Category, group: CategoryGroup): CategoryDTO {
    return {
      id: category.id.toString(),
      name: category.name,
      groupId: group.id.toString(),
      groupName: group.name,
      isIncome: category.isIncome,
      hidden: category.hidden,
    }
  }
}
