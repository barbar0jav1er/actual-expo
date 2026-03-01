import { EntityId } from '@domain/value-objects'
import { NotFoundError } from '@domain/errors'
import type { CategoryRepository } from '@domain/repositories'
import type { SyncService } from '@application/services/SyncService'

export interface DeleteCategoryInput {
  id: string
}

export class DeleteCategory {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly syncService: SyncService
  ) {}

  async execute(input: DeleteCategoryInput): Promise<void> {
    const id = EntityId.fromString(input.id)
    const category = await this.categoryRepo.findById(id)
    if (!category) {
      throw new NotFoundError('Category', input.id)
    }

    category.delete()
    await this.categoryRepo.save(category)

    await this.syncService.trackChanges([
      { table: 'categories', row: input.id, data: { tombstone: 1 } },
    ])
  }
}
