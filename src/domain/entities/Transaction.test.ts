import { describe, it, expect } from 'vitest'
import { Transaction } from './Transaction'
import { EntityId, Money, TransactionDate } from '../value-objects'
import { ValidationError } from '../errors'

describe('Transaction', () => {
  const createDefaultProps = () => ({
    accountId: EntityId.create(),
    amount: Money.fromCents(-5000),
    date: TransactionDate.fromString('2024-02-26'),
  })

  describe('create', () => {
    it('should create transaction with required props', () => {
      const props = createDefaultProps()
      const tx = Transaction.create(props)

      expect(tx.accountId.equals(props.accountId)).toBe(true)
      expect(tx.amount.equals(props.amount)).toBe(true)
      expect(tx.date.equals(props.date)).toBe(true)
      expect(tx.cleared).toBe(false)
      expect(tx.reconciled).toBe(false)
      expect(tx.tombstone).toBe(false)
      expect(tx.isParent).toBe(false)
      expect(tx.isChild).toBe(false)
      expect(tx.categoryId).toBeUndefined()
      expect(tx.payeeId).toBeUndefined()
    })

    it('should create transaction with optional props', () => {
      const props = {
        ...createDefaultProps(),
        categoryId: EntityId.create(),
        payeeId: EntityId.create(),
        notes: 'Grocery shopping',
      }
      const tx = Transaction.create(props)

      expect(tx.categoryId).toBeDefined()
      expect(tx.payeeId).toBeDefined()
      expect(tx.notes).toBe('Grocery shopping')
    })
  })

  describe('createChild', () => {
    it('should create child transaction', () => {
      const parentId = EntityId.create()
      const props = {
        ...createDefaultProps(),
        parentId,
      }
      const tx = Transaction.createChild(props)

      expect(tx.isChild).toBe(true)
      expect(tx.isParent).toBe(false)
      expect(tx.parentId?.equals(parentId)).toBe(true)
      expect(tx.isSplit).toBe(true)
    })
  })

  describe('reconstitute', () => {
    it('should reconstitute transaction from props', () => {
      const id = EntityId.create()
      const props = {
        id,
        ...createDefaultProps(),
        cleared: true,
        reconciled: false,
        tombstone: false,
        isParent: true,
        isChild: false,
        sortOrder: 5,
      }

      const tx = Transaction.reconstitute(props)

      expect(tx.id.equals(id)).toBe(true)
      expect(tx.cleared).toBe(true)
      expect(tx.isParent).toBe(true)
      expect(tx.sortOrder).toBe(5)
    })
  })

  describe('isSplit', () => {
    it('should return true for parent transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.markAsParent()
      expect(tx.isSplit).toBe(true)
    })

    it('should return true for child transaction', () => {
      const tx = Transaction.createChild({
        ...createDefaultProps(),
        parentId: EntityId.create(),
      })
      expect(tx.isSplit).toBe(true)
    })

    it('should return false for regular transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      expect(tx.isSplit).toBe(false)
    })
  })

  describe('mutations', () => {
    it('should set category', () => {
      const tx = Transaction.create(createDefaultProps())
      const categoryId = EntityId.create()

      tx.setCategory(categoryId)
      expect(tx.categoryId?.equals(categoryId)).toBe(true)

      tx.setCategory(undefined)
      expect(tx.categoryId).toBeUndefined()
    })

    it('should set payee', () => {
      const tx = Transaction.create(createDefaultProps())
      const payeeId = EntityId.create()

      tx.setPayee(payeeId)
      expect(tx.payeeId?.equals(payeeId)).toBe(true)

      tx.setPayee(undefined)
      expect(tx.payeeId).toBeUndefined()
    })

    it('should set amount', () => {
      const tx = Transaction.create(createDefaultProps())
      const newAmount = Money.fromCents(-10000)

      tx.setAmount(newAmount)
      expect(tx.amount.equals(newAmount)).toBe(true)
    })

    it('should set date', () => {
      const tx = Transaction.create(createDefaultProps())
      const newDate = TransactionDate.fromString('2024-03-01')

      tx.setDate(newDate)
      expect(tx.date.equals(newDate)).toBe(true)
    })

    it('should set notes', () => {
      const tx = Transaction.create(createDefaultProps())

      tx.setNotes('New note')
      expect(tx.notes).toBe('New note')

      tx.setNotes(undefined)
      expect(tx.notes).toBeUndefined()
    })

    it('should set sort order', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.setSortOrder(10)
      expect(tx.sortOrder).toBe(10)
    })

    it('should throw error for negative sort order', () => {
      const tx = Transaction.create(createDefaultProps())
      expect(() => tx.setSortOrder(-1)).toThrow(ValidationError)
    })
  })

  describe('clear/unclear', () => {
    it('should clear transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.clear()
      expect(tx.cleared).toBe(true)
    })

    it('should unclear transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.clear()
      tx.unclear()
      expect(tx.cleared).toBe(false)
    })

    it('should throw error when unclearning reconciled transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.clear()
      tx.reconcile()

      expect(() => tx.unclear()).toThrow(ValidationError)
    })
  })

  describe('reconcile/unreconcile', () => {
    it('should reconcile cleared transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.clear()
      tx.reconcile()
      expect(tx.reconciled).toBe(true)
    })

    it('should throw error when reconciling uncleared transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      expect(() => tx.reconcile()).toThrow(ValidationError)
    })

    it('should unreconcile transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.clear()
      tx.reconcile()
      tx.unreconcile()
      expect(tx.reconciled).toBe(false)
    })
  })

  describe('delete/restore', () => {
    it('should delete transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.delete()
      expect(tx.tombstone).toBe(true)
    })

    it('should restore transaction', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.delete()
      tx.restore()
      expect(tx.tombstone).toBe(false)
    })
  })

  describe('markAsParent', () => {
    it('should mark transaction as parent', () => {
      const tx = Transaction.create(createDefaultProps())
      tx.markAsParent()
      expect(tx.isParent).toBe(true)
      expect(tx.isSplit).toBe(true)
    })
  })

  describe('toObject', () => {
    it('should return object representation', () => {
      const tx = Transaction.create({
        ...createDefaultProps(),
        notes: 'Test note',
      })
      const obj = tx.toObject()

      expect(obj.accountId).toBe(tx.accountId)
      expect(obj.amount).toBe(tx.amount)
      expect(obj.notes).toBe('Test note')
    })
  })
})
