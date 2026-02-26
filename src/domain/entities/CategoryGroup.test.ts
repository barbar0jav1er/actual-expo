import { describe, it, expect } from 'vitest'
import { CategoryGroup } from './CategoryGroup'
import { EntityId } from '../value-objects'
import { ValidationError } from '../errors'

describe('CategoryGroup', () => {
  describe('create', () => {
    it('should create category group with required props', () => {
      const group = CategoryGroup.create({ name: 'Bills' })

      expect(group.name).toBe('Bills')
      expect(group.isIncome).toBe(false)
      expect(group.hidden).toBe(false)
      expect(group.sortOrder).toBe(0)
      expect(group.tombstone).toBe(false)
      expect(EntityId.isValid(group.id.toString())).toBe(true)
    })

    it('should create income category group', () => {
      const group = CategoryGroup.create({ name: 'Income', isIncome: true })

      expect(group.isIncome).toBe(true)
    })

    it('should trim whitespace from name', () => {
      const group = CategoryGroup.create({ name: '  Bills  ' })

      expect(group.name).toBe('Bills')
    })

    it('should throw error for empty name', () => {
      expect(() => CategoryGroup.create({ name: '' })).toThrow(ValidationError)
      expect(() => CategoryGroup.create({ name: '   ' })).toThrow(
        ValidationError
      )
    })
  })

  describe('reconstitute', () => {
    it('should reconstitute category group from props', () => {
      const id = EntityId.create()
      const props = {
        id,
        name: 'Bills',
        isIncome: false,
        hidden: true,
        sortOrder: 5,
        tombstone: false,
      }

      const group = CategoryGroup.reconstitute(props)

      expect(group.id.equals(id)).toBe(true)
      expect(group.name).toBe('Bills')
      expect(group.hidden).toBe(true)
      expect(group.sortOrder).toBe(5)
    })
  })

  describe('isActive', () => {
    it('should return true for visible, non-deleted group', () => {
      const group = CategoryGroup.create({ name: 'Bills' })
      expect(group.isActive).toBe(true)
    })

    it('should return false for hidden group', () => {
      const group = CategoryGroup.create({ name: 'Bills' })
      group.hide()
      expect(group.isActive).toBe(false)
    })

    it('should return false for deleted group', () => {
      const group = CategoryGroup.create({ name: 'Bills' })
      group.delete()
      expect(group.isActive).toBe(false)
    })
  })

  describe('mutations', () => {
    it('should rename category group', () => {
      const group = CategoryGroup.create({ name: 'Old Name' })
      group.rename('New Name')
      expect(group.name).toBe('New Name')
    })

    it('should throw error when renaming to empty', () => {
      const group = CategoryGroup.create({ name: 'Old Name' })
      expect(() => group.rename('')).toThrow(ValidationError)
      expect(() => group.rename('   ')).toThrow(ValidationError)
    })

    it('should hide and show category group', () => {
      const group = CategoryGroup.create({ name: 'Bills' })

      group.hide()
      expect(group.hidden).toBe(true)

      group.show()
      expect(group.hidden).toBe(false)
    })

    it('should set sort order', () => {
      const group = CategoryGroup.create({ name: 'Bills' })
      group.setSortOrder(10)
      expect(group.sortOrder).toBe(10)
    })

    it('should throw error for negative sort order', () => {
      const group = CategoryGroup.create({ name: 'Bills' })
      expect(() => group.setSortOrder(-1)).toThrow(ValidationError)
    })

    it('should delete and restore category group', () => {
      const group = CategoryGroup.create({ name: 'Bills' })

      group.delete()
      expect(group.tombstone).toBe(true)

      group.restore()
      expect(group.tombstone).toBe(false)
    })
  })

  describe('toObject', () => {
    it('should return object representation', () => {
      const group = CategoryGroup.create({ name: 'Bills', isIncome: false })
      const obj = group.toObject()

      expect(obj.name).toBe('Bills')
      expect(obj.isIncome).toBe(false)
      expect(obj.hidden).toBe(false)
      expect(obj.sortOrder).toBe(0)
      expect(obj.tombstone).toBe(false)
    })
  })
})
