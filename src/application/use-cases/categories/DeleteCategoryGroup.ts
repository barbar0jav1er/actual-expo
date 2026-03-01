import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { CategoryGroupRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface DeleteCategoryGroupInput {
  id: string
}

export class DeleteCategoryGroup {
  constructor(
    private readonly categoryGroupRepo: CategoryGroupRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: DeleteCategoryGroupInput): Promise<void> {
    const id = EntityId.fromString(input.id)
    const group = await this.categoryGroupRepo.findById(id)
    if (!group) {
      throw new NotFoundError('CategoryGroup', input.id)
    }

    group.delete()
    await this.categoryGroupRepo.save(group)

    await this.syncService.trackChanges([
      { table: 'category_groups', row: input.id, data: { tombstone: 1 } },
    ])
  }
}
