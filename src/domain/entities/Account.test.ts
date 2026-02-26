import { describe, it, expect } from 'vitest'
import { Account } from './Account'
import { EntityId } from '../value-objects'
import { ValidationError } from '../errors'

describe('Account', () => {
  describe('create', () => {
    it('should create account with required props', () => {
      const account = Account.create({ name: 'Checking' })

      expect(account.name).toBe('Checking')
      expect(account.offbudget).toBe(false)
      expect(account.closed).toBe(false)
      expect(account.sortOrder).toBe(0)
      expect(account.tombstone).toBe(false)
      expect(EntityId.isValid(account.id.toString())).toBe(true)
    })

    it('should create account with offbudget flag', () => {
      const account = Account.create({ name: 'Investment', offbudget: true })

      expect(account.offbudget).toBe(true)
    })

    it('should trim whitespace from name', () => {
      const account = Account.create({ name: '  Savings  ' })

      expect(account.name).toBe('Savings')
    })

    it('should throw error for empty name', () => {
      expect(() => Account.create({ name: '' })).toThrow(ValidationError)
      expect(() => Account.create({ name: '   ' })).toThrow(ValidationError)
    })
  })

  describe('reconstitute', () => {
    it('should reconstitute account from props', () => {
      const id = EntityId.create()
      const props = {
        id,
        name: 'Checking',
        offbudget: false,
        closed: true,
        sortOrder: 5,
        tombstone: false,
      }

      const account = Account.reconstitute(props)

      expect(account.id.equals(id)).toBe(true)
      expect(account.name).toBe('Checking')
      expect(account.closed).toBe(true)
      expect(account.sortOrder).toBe(5)
    })
  })

  describe('isActive', () => {
    it('should return true for open, non-deleted account', () => {
      const account = Account.create({ name: 'Checking' })
      expect(account.isActive).toBe(true)
    })

    it('should return false for closed account', () => {
      const account = Account.create({ name: 'Checking' })
      account.close()
      expect(account.isActive).toBe(false)
    })

    it('should return false for deleted account', () => {
      const account = Account.create({ name: 'Checking' })
      account.delete()
      expect(account.isActive).toBe(false)
    })
  })

  describe('mutations', () => {
    it('should rename account', () => {
      const account = Account.create({ name: 'Old Name' })
      account.rename('New Name')
      expect(account.name).toBe('New Name')
    })

    it('should trim name when renaming', () => {
      const account = Account.create({ name: 'Old Name' })
      account.rename('  New Name  ')
      expect(account.name).toBe('New Name')
    })

    it('should throw error when renaming to empty', () => {
      const account = Account.create({ name: 'Old Name' })
      expect(() => account.rename('')).toThrow(ValidationError)
      expect(() => account.rename('   ')).toThrow(ValidationError)
    })

    it('should close and reopen account', () => {
      const account = Account.create({ name: 'Checking' })

      account.close()
      expect(account.closed).toBe(true)

      account.reopen()
      expect(account.closed).toBe(false)
    })

    it('should set offbudget flag', () => {
      const account = Account.create({ name: 'Checking' })

      account.setOffbudget(true)
      expect(account.offbudget).toBe(true)

      account.setOffbudget(false)
      expect(account.offbudget).toBe(false)
    })

    it('should set sort order', () => {
      const account = Account.create({ name: 'Checking' })
      account.setSortOrder(10)
      expect(account.sortOrder).toBe(10)
    })

    it('should throw error for negative sort order', () => {
      const account = Account.create({ name: 'Checking' })
      expect(() => account.setSortOrder(-1)).toThrow(ValidationError)
    })

    it('should delete and restore account', () => {
      const account = Account.create({ name: 'Checking' })

      account.delete()
      expect(account.tombstone).toBe(true)

      account.restore()
      expect(account.tombstone).toBe(false)
    })
  })

  describe('toObject', () => {
    it('should return object representation', () => {
      const account = Account.create({ name: 'Checking', offbudget: true })
      const obj = account.toObject()

      expect(obj.name).toBe('Checking')
      expect(obj.offbudget).toBe(true)
      expect(obj.closed).toBe(false)
      expect(obj.sortOrder).toBe(0)
      expect(obj.tombstone).toBe(false)
      expect(obj.id).toBe(account.id)
    })

    it('should return a copy (not reference)', () => {
      const account = Account.create({ name: 'Checking' })
      const obj = account.toObject()

      // Modifying returned object should not affect the entity
      ;(obj as { name: string }).name = 'Modified'
      expect(account.name).toBe('Checking')
    })
  })
})
