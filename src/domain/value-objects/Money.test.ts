import { describe, it, expect } from 'vitest'
import { Money } from './Money'
import { InvalidMoneyError } from '../errors'

describe('Money', () => {
  describe('factory methods', () => {
    it('should create from cents', () => {
      const money = Money.fromCents(1000)
      expect(money.toCents()).toBe(1000)
    })

    it('should create from dollars', () => {
      const money = Money.fromDollars(10.5)
      expect(money.toCents()).toBe(1050)
    })

    it('should round when creating from dollars with more than 2 decimals', () => {
      const money = Money.fromDollars(10.555)
      expect(money.toCents()).toBe(1056)
    })

    it('should create zero money', () => {
      const money = Money.zero()
      expect(money.toCents()).toBe(0)
      expect(money.isZero()).toBe(true)
    })

    it('should throw error for non-integer cents', () => {
      expect(() => Money.fromCents(10.5)).toThrow(InvalidMoneyError)
    })
  })

  describe('arithmetic operations', () => {
    it('should add two money values', () => {
      const a = Money.fromCents(1000)
      const b = Money.fromCents(500)
      const result = a.add(b)
      expect(result.toCents()).toBe(1500)
    })

    it('should subtract two money values', () => {
      const a = Money.fromCents(1000)
      const b = Money.fromCents(300)
      const result = a.subtract(b)
      expect(result.toCents()).toBe(700)
    })

    it('should handle negative results from subtraction', () => {
      const a = Money.fromCents(300)
      const b = Money.fromCents(1000)
      const result = a.subtract(b)
      expect(result.toCents()).toBe(-700)
      expect(result.isNegative()).toBe(true)
    })

    it('should multiply by a factor', () => {
      const money = Money.fromCents(1000)
      const result = money.multiply(2.5)
      expect(result.toCents()).toBe(2500)
    })

    it('should divide by a divisor', () => {
      const money = Money.fromCents(1000)
      const result = money.divide(4)
      expect(result.toCents()).toBe(250)
    })

    it('should round when dividing', () => {
      const money = Money.fromCents(1000)
      const result = money.divide(3)
      expect(result.toCents()).toBe(333)
    })

    it('should throw error when dividing by zero', () => {
      const money = Money.fromCents(1000)
      expect(() => money.divide(0)).toThrow(InvalidMoneyError)
    })

    it('should get absolute value', () => {
      const money = Money.fromCents(-1000)
      const result = money.abs()
      expect(result.toCents()).toBe(1000)
    })

    it('should negate value', () => {
      const positive = Money.fromCents(1000)
      const negative = Money.fromCents(-500)
      expect(positive.negate().toCents()).toBe(-1000)
      expect(negative.negate().toCents()).toBe(500)
    })

    it('should be immutable', () => {
      const original = Money.fromCents(1000)
      const result = original.add(Money.fromCents(500))
      expect(original.toCents()).toBe(1000)
      expect(result.toCents()).toBe(1500)
    })
  })

  describe('predicates', () => {
    it('should check if positive', () => {
      expect(Money.fromCents(100).isPositive()).toBe(true)
      expect(Money.fromCents(0).isPositive()).toBe(false)
      expect(Money.fromCents(-100).isPositive()).toBe(false)
    })

    it('should check if negative', () => {
      expect(Money.fromCents(-100).isNegative()).toBe(true)
      expect(Money.fromCents(0).isNegative()).toBe(false)
      expect(Money.fromCents(100).isNegative()).toBe(false)
    })

    it('should check if zero', () => {
      expect(Money.fromCents(0).isZero()).toBe(true)
      expect(Money.fromCents(100).isZero()).toBe(false)
      expect(Money.fromCents(-100).isZero()).toBe(false)
    })

    it('should compare greater than', () => {
      const a = Money.fromCents(1000)
      const b = Money.fromCents(500)
      expect(a.isGreaterThan(b)).toBe(true)
      expect(b.isGreaterThan(a)).toBe(false)
      expect(a.isGreaterThan(a)).toBe(false)
    })

    it('should compare less than', () => {
      const a = Money.fromCents(500)
      const b = Money.fromCents(1000)
      expect(a.isLessThan(b)).toBe(true)
      expect(b.isLessThan(a)).toBe(false)
      expect(a.isLessThan(a)).toBe(false)
    })
  })

  describe('conversions', () => {
    it('should convert to cents', () => {
      const money = Money.fromDollars(25.5)
      expect(money.toCents()).toBe(2550)
    })

    it('should convert to dollars', () => {
      const money = Money.fromCents(2550)
      expect(money.toDollars()).toBe(25.5)
    })

    it('should format in USD by default', () => {
      const money = Money.fromCents(125099)
      const formatted = money.format()
      expect(formatted).toBe('$1,250.99')
    })

    it('should format with different locale and currency', () => {
      const money = Money.fromCents(125099)
      const formatted = money.format('es-ES', 'EUR')
      // The format varies by environment, but should contain the amount and currency
      expect(formatted).toContain('1250,99')
      expect(formatted).toContain('€')
    })

    it('should format negative values', () => {
      const money = Money.fromCents(-5000)
      const formatted = money.format()
      expect(formatted).toBe('-$50.00')
    })
  })

  describe('comparison', () => {
    it('should check equality', () => {
      const a = Money.fromCents(1000)
      const b = Money.fromCents(1000)
      const c = Money.fromCents(500)
      expect(a.equals(b)).toBe(true)
      expect(a.equals(c)).toBe(false)
    })

    it('should compare to another money', () => {
      const a = Money.fromCents(1000)
      const b = Money.fromCents(500)
      const c = Money.fromCents(1000)
      expect(a.compareTo(b)).toBeGreaterThan(0)
      expect(b.compareTo(a)).toBeLessThan(0)
      expect(a.compareTo(c)).toBe(0)
    })
  })
})
