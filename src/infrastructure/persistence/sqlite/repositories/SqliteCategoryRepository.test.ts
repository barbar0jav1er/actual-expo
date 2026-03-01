import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../__tests__/createTestDb'
import { SqliteCategoryRepository } from './SqliteCategoryRepository'
import { SqliteCategoryGroupRepository } from './SqliteCategoryGroupRepository'
import { Category } from '@domain/entities/Category'
import { CategoryGroup } from '@domain/entities/CategoryGroup'
import type { AppDatabase } from '../db'

describe('SqliteCategoryRepository', () => {
  let repo: SqliteCategoryRepository
  let groupRepo: SqliteCategoryGroupRepository
  let group: CategoryGroup

  beforeEach(async () => {
    const db: AppDatabase = await createTestDb()
    repo = new SqliteCategoryRepository(db)
    groupRepo = new SqliteCategoryGroupRepository(db)

    group = CategoryGroup.create({ name: 'Food' })
    await groupRepo.save(group)
  })

  it('saves and retrieves a category', async () => {
    const cat = Category.create({ name: 'Groceries', groupId: group.id })

    await repo.save(cat)
    const found = await repo.findById(cat.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('Groceries')
    expect(found!.groupId.equals(group.id)).toBe(true)
  })

  it('findAll excludes deleted categories', async () => {
    const c1 = Category.create({ name: 'Groceries', groupId: group.id })
    const c2 = Category.create({ name: 'Old',       groupId: group.id })
    c2.delete()

    await repo.save(c1)
    await repo.save(c2)

    const all = await repo.findAll()
    expect(all).toHaveLength(1)
  })

  it('findByGroup returns categories for a specific group', async () => {
    const group2 = CategoryGroup.create({ name: 'Housing' })
    await groupRepo.save(group2)

    const c1 = Category.create({ name: 'Groceries', groupId: group.id })
    const c2 = Category.create({ name: 'Rent',      groupId: group2.id })

    await repo.save(c1)
    await repo.save(c2)

    const result = await repo.findByGroup(group.id)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Groceries')
  })

  it('updates a category (upsert)', async () => {
    const cat = Category.create({ name: 'Groceries', groupId: group.id })
    await repo.save(cat)

    cat.rename('Supermarket')
    await repo.save(cat)

    const found = await repo.findById(cat.id)
    expect(found!.name).toBe('Supermarket')
  })

  it('soft-deletes a category', async () => {
    const cat = Category.create({ name: 'Groceries', groupId: group.id })
    await repo.save(cat)

    await repo.delete(cat.id)

    const all = await repo.findAll()
    expect(all).toHaveLength(0)
  })
})
