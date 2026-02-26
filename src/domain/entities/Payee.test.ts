import { describe, it, expect } from 'vitest'
import { Payee } from './Payee'
import { EntityId } from '../value-objects'
import { ValidationError } from '../errors'

describe('Payee', () => {
  describe('create', () => {
    it('should create payee with name', () => {
      const payee = Payee.create({ name: 'Amazon' })

      expect(payee.name).toBe('Amazon')
      expect(payee.transferAccountId).toBeUndefined()
      expect(payee.isTransferPayee).toBe(false)
      expect(payee.tombstone).toBe(false)
      expect(EntityId.isValid(payee.id.toString())).toBe(true)
    })

    it('should trim whitespace from name', () => {
      const payee = Payee.create({ name: '  Amazon  ' })

      expect(payee.name).toBe('Amazon')
    })

    it('should throw error for empty name', () => {
      expect(() => Payee.create({ name: '' })).toThrow(ValidationError)
      expect(() => Payee.create({ name: '   ' })).toThrow(ValidationError)
    })
  })

  describe('createTransferPayee', () => {
    it('should create transfer payee linked to account', () => {
      const accountId = EntityId.create()
      const payee = Payee.createTransferPayee({
        name: 'Transfer: Savings',
        accountId,
      })

      expect(payee.name).toBe('Transfer: Savings')
      expect(payee.transferAccountId?.equals(accountId)).toBe(true)
      expect(payee.isTransferPayee).toBe(true)
    })

    it('should throw error for empty name', () => {
      expect(() =>
        Payee.createTransferPayee({ name: '', accountId: EntityId.create() })
      ).toThrow(ValidationError)
    })
  })

  describe('reconstitute', () => {
    it('should reconstitute payee from props', () => {
      const id = EntityId.create()
      const accountId = EntityId.create()
      const props = {
        id,
        name: 'Amazon',
        transferAccountId: accountId,
        tombstone: true,
      }

      const payee = Payee.reconstitute(props)

      expect(payee.id.equals(id)).toBe(true)
      expect(payee.name).toBe('Amazon')
      expect(payee.transferAccountId?.equals(accountId)).toBe(true)
      expect(payee.tombstone).toBe(true)
    })
  })

  describe('isTransferPayee', () => {
    it('should return true for transfer payee', () => {
      const payee = Payee.createTransferPayee({
        name: 'Transfer: Savings',
        accountId: EntityId.create(),
      })
      expect(payee.isTransferPayee).toBe(true)
    })

    it('should return false for regular payee', () => {
      const payee = Payee.create({ name: 'Amazon' })
      expect(payee.isTransferPayee).toBe(false)
    })
  })

  describe('isActive', () => {
    it('should return true for non-deleted payee', () => {
      const payee = Payee.create({ name: 'Amazon' })
      expect(payee.isActive).toBe(true)
    })

    it('should return false for deleted payee', () => {
      const payee = Payee.create({ name: 'Amazon' })
      payee.delete()
      expect(payee.isActive).toBe(false)
    })
  })

  describe('mutations', () => {
    it('should rename payee', () => {
      const payee = Payee.create({ name: 'Old Name' })
      payee.rename('New Name')
      expect(payee.name).toBe('New Name')
    })

    it('should trim name when renaming', () => {
      const payee = Payee.create({ name: 'Old Name' })
      payee.rename('  New Name  ')
      expect(payee.name).toBe('New Name')
    })

    it('should throw error when renaming to empty', () => {
      const payee = Payee.create({ name: 'Old Name' })
      expect(() => payee.rename('')).toThrow(ValidationError)
      expect(() => payee.rename('   ')).toThrow(ValidationError)
    })

    it('should delete and restore payee', () => {
      const payee = Payee.create({ name: 'Amazon' })

      payee.delete()
      expect(payee.tombstone).toBe(true)
      expect(payee.isActive).toBe(false)

      payee.restore()
      expect(payee.tombstone).toBe(false)
      expect(payee.isActive).toBe(true)
    })
  })

  describe('toObject', () => {
    it('should return object representation for regular payee', () => {
      const payee = Payee.create({ name: 'Amazon' })
      const obj = payee.toObject()

      expect(obj.name).toBe('Amazon')
      expect(obj.transferAccountId).toBeUndefined()
      expect(obj.tombstone).toBe(false)
    })

    it('should return object representation for transfer payee', () => {
      const accountId = EntityId.create()
      const payee = Payee.createTransferPayee({
        name: 'Transfer: Savings',
        accountId,
      })
      const obj = payee.toObject()

      expect(obj.name).toBe('Transfer: Savings')
      expect(obj.transferAccountId).toBe(accountId)
    })
  })
})
