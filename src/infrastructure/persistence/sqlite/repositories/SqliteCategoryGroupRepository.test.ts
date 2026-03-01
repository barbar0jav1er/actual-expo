import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../__tests__/createTestDb'
import { SqliteCategoryGroupRepository } from './SqliteCategoryGroupRepository'
import { CategoryGroup } from '@domain/entities/CategoryGroup'
import type { AppDatabase } from '../db'

describe('SqliteCategoryGroupRepository', () => {
  let repo: SqliteCategoryGroupRepository

  beforeEach(async () => {
    const db: AppDatabase = await createTestDb()
    repo = new SqliteCategoryGroupRepository(db)
  })

  it('saves and retrieves a category group', async () => {
    const group = CategoryGroup.create({ name: 'Food' })

    await repo.save(group)
    const found = await repo.findById(group.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('Food')
  })

  it('findAll excludes deleted groups', async () => {
    const g1 = CategoryGroup.create({ name: 'Food' })
    const g2 = CategoryGroup.create({ name: 'Old' })
    g2.delete()

    await repo.save(g1)
    await repo.save(g2)

    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Food')
  })

  it('updates a group (upsert)', async () => {
    const group = CategoryGroup.create({ name: 'Food' })
    await repo.save(group)

    group.rename('Groceries')
    await repo.save(group)

    const found = await repo.findById(group.id)
    expect(found!.name).toBe('Groceries')
  })

  it('soft-deletes a group', async () => {
    const group = CategoryGroup.create({ name: 'Food' })
    await repo.save(group)

    await repo.delete(group.id)

    const all = await repo.findAll()
    expect(all).toHaveLength(0)
  })
})
