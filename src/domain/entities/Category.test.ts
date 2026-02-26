import { describe, it, expect } from 'vitest'
import { Category } from './Category'
import { EntityId } from '../value-objects'
import { ValidationError } from '../errors'

describe('Category', () => {
  const createGroupId = () => EntityId.create()

  describe('create', () => {
    it('should create category with required props', () => {
      const groupId = createGroupId()
      const category = Category.create({ name: 'Groceries', groupId })

      expect(category.name).toBe('Groceries')
      expect(category.groupId.equals(groupId)).toBe(true)
      expect(category.isIncome).toBe(false)
      expect(category.hidden).toBe(false)
      expect(category.sortOrder).toBe(0)
      expect(category.tombstone).toBe(false)
    })

    it('should create income category', () => {
      const category = Category.create({
        name: 'Salary',
        groupId: createGroupId(),
        isIncome: true,
      })

      expect(category.isIncome).toBe(true)
    })

    it('should trim whitespace from name', () => {
      const category = Category.create({
        name: '  Groceries  ',
        groupId: createGroupId(),
      })

      expect(category.name).toBe('Groceries')
    })

    it('should throw error for empty name', () => {
      expect(() =>
        Category.create({ name: '', groupId: createGroupId() })
      ).toThrow(ValidationError)
      expect(() =>
        Category.create({ name: '   ', groupId: createGroupId() })
      ).toThrow(ValidationError)
    })
  })

  describe('reconstitute', () => {
    it('should reconstitute category from props', () => {
      const id = EntityId.create()
      const groupId = createGroupId()
      const props = {
        id,
        name: 'Groceries',
        groupId,
        isIncome: false,
        hidden: true,
        sortOrder: 5,
        tombstone: false,
      }

      const category = Category.reconstitute(props)

      expect(category.id.equals(id)).toBe(true)
      expect(category.name).toBe('Groceries')
      expect(category.hidden).toBe(true)
      expect(category.sortOrder).toBe(5)
    })
  })

  describe('isActive', () => {
    it('should return true for visible, non-deleted category', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })
      expect(category.isActive).toBe(true)
    })

    it('should return false for hidden category', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })
      category.hide()
      expect(category.isActive).toBe(false)
    })

    it('should return false for deleted category', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })
      category.delete()
      expect(category.isActive).toBe(false)
    })
  })

  describe('mutations', () => {
    it('should rename category', () => {
      const category = Category.create({
        name: 'Old Name',
        groupId: createGroupId(),
      })
      category.rename('New Name')
      expect(category.name).toBe('New Name')
    })

    it('should throw error when renaming to empty', () => {
      const category = Category.create({
        name: 'Old Name',
        groupId: createGroupId(),
      })
      expect(() => category.rename('')).toThrow(ValidationError)
    })

    it('should move to different group', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })
      const newGroupId = createGroupId()

      category.moveTo(newGroupId)
      expect(category.groupId.equals(newGroupId)).toBe(true)
    })

    it('should hide and show category', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })

      category.hide()
      expect(category.hidden).toBe(true)

      category.show()
      expect(category.hidden).toBe(false)
    })

    it('should set sort order', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })
      category.setSortOrder(10)
      expect(category.sortOrder).toBe(10)
    })

    it('should throw error for negative sort order', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })
      expect(() => category.setSortOrder(-1)).toThrow(ValidationError)
    })

    it('should delete and restore category', () => {
      const category = Category.create({
        name: 'Groceries',
        groupId: createGroupId(),
      })

      category.delete()
      expect(category.tombstone).toBe(true)

      category.restore()
      expect(category.tombstone).toBe(false)
    })
  })

  describe('toObject', () => {
    it('should return object representation', () => {
      const groupId = createGroupId()
      const category = Category.create({
        name: 'Groceries',
        groupId,
        isIncome: true,
      })
      const obj = category.toObject()

      expect(obj.name).toBe('Groceries')
      expect(obj.groupId).toBe(groupId)
      expect(obj.isIncome).toBe(true)
    })
  })
})
