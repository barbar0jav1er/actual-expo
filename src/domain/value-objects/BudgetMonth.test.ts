import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BudgetMonth } from './BudgetMonth'
import { InvalidDateError } from '../errors'

describe('BudgetMonth', () => {
  describe('fromDate', () => {
    it('should create from Date object', () => {
      const date = new Date(2024, 1, 15) // February 15, 2024
      const month = BudgetMonth.fromDate(date)

      expect(month.getYear()).toBe(2024)
      expect(month.getMonth()).toBe(2)
    })

    it('should handle January correctly', () => {
      const date = new Date(2024, 0, 1) // January 1, 2024
      const month = BudgetMonth.fromDate(date)

      expect(month.getYear()).toBe(2024)
      expect(month.getMonth()).toBe(1)
    })

    it('should handle December correctly', () => {
      const date = new Date(2024, 11, 31) // December 31, 2024
      const month = BudgetMonth.fromDate(date)

      expect(month.getYear()).toBe(2024)
      expect(month.getMonth()).toBe(12)
    })
  })

  describe('fromString', () => {
    it('should parse "YYYY-MM" format', () => {
      const month = BudgetMonth.fromString('2024-02')
      expect(month.getYear()).toBe(2024)
      expect(month.getMonth()).toBe(2)
    })

    it('should parse "YYYYMM" format', () => {
      const month = BudgetMonth.fromString('202402')
      expect(month.getYear()).toBe(2024)
      expect(month.getMonth()).toBe(2)
    })

    it('should throw error for invalid format', () => {
      expect(() => BudgetMonth.fromString('2024')).toThrow(InvalidDateError)
      expect(() => BudgetMonth.fromString('2024-2')).toThrow(InvalidDateError)
      expect(() => BudgetMonth.fromString('24-02')).toThrow(InvalidDateError)
      expect(() => BudgetMonth.fromString('invalid')).toThrow(InvalidDateError)
    })

    it('should throw error for invalid month', () => {
      expect(() => BudgetMonth.fromString('2024-00')).toThrow(InvalidDateError)
      expect(() => BudgetMonth.fromString('2024-13')).toThrow(InvalidDateError)
    })
  })

  describe('fromNumber', () => {
    it('should create from YYYYMM number', () => {
      const month = BudgetMonth.fromNumber(202402)
      expect(month.getYear()).toBe(2024)
      expect(month.getMonth()).toBe(2)
    })

    it('should throw error for invalid month', () => {
      expect(() => BudgetMonth.fromNumber(202400)).toThrow(InvalidDateError)
      expect(() => BudgetMonth.fromNumber(202413)).toThrow(InvalidDateError)
    })
  })

  describe('current', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return current month', () => {
      vi.setSystemTime(new Date(2024, 1, 15)) // February 15, 2024
      const month = BudgetMonth.current()
      expect(month.getYear()).toBe(2024)
      expect(month.getMonth()).toBe(2)
    })
  })

  describe('navigation', () => {
    it('should get next month', () => {
      const month = BudgetMonth.fromString('2024-02')
      const next = month.next()
      expect(next.toString()).toBe('2024-03')
    })

    it('should handle year crossover on next', () => {
      const month = BudgetMonth.fromString('2024-12')
      const next = month.next()
      expect(next.toString()).toBe('2025-01')
    })

    it('should get previous month', () => {
      const month = BudgetMonth.fromString('2024-02')
      const prev = month.previous()
      expect(prev.toString()).toBe('2024-01')
    })

    it('should handle year crossover on previous', () => {
      const month = BudgetMonth.fromString('2024-01')
      const prev = month.previous()
      expect(prev.toString()).toBe('2023-12')
    })

    it('should add multiple months', () => {
      const month = BudgetMonth.fromString('2024-02')
      const result = month.addMonths(5)
      expect(result.toString()).toBe('2024-07')
    })

    it('should add months across year boundary', () => {
      const month = BudgetMonth.fromString('2024-10')
      const result = month.addMonths(5)
      expect(result.toString()).toBe('2025-03')
    })

    it('should subtract months', () => {
      const month = BudgetMonth.fromString('2024-05')
      const result = month.addMonths(-3)
      expect(result.toString()).toBe('2024-02')
    })

    it('should subtract months across year boundary', () => {
      const month = BudgetMonth.fromString('2024-02')
      const result = month.addMonths(-3)
      expect(result.toString()).toBe('2023-11')
    })
  })

  describe('conversions', () => {
    it('should convert to number', () => {
      const month = BudgetMonth.fromString('2024-02')
      expect(month.toNumber()).toBe(202402)
    })

    it('should convert to string', () => {
      const month = BudgetMonth.fromNumber(202402)
      expect(month.toString()).toBe('2024-02')
    })

    it('should pad single digit months', () => {
      const month = BudgetMonth.fromNumber(202401)
      expect(month.toString()).toBe('2024-01')
    })

    it('should convert to Date (first day of month)', () => {
      const month = BudgetMonth.fromString('2024-02')
      const date = month.toDate()
      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(1) // 0-indexed
      expect(date.getDate()).toBe(1)
    })
  })

  describe('comparison', () => {
    it('should check equality', () => {
      const a = BudgetMonth.fromString('2024-02')
      const b = BudgetMonth.fromString('2024-02')
      const c = BudgetMonth.fromString('2024-03')

      expect(a.equals(b)).toBe(true)
      expect(a.equals(c)).toBe(false)
    })

    it('should compare months', () => {
      const jan = BudgetMonth.fromString('2024-01')
      const feb = BudgetMonth.fromString('2024-02')
      const jan25 = BudgetMonth.fromString('2025-01')

      expect(jan.compareTo(feb)).toBeLessThan(0)
      expect(feb.compareTo(jan)).toBeGreaterThan(0)
      expect(jan.compareTo(jan)).toBe(0)
      expect(feb.compareTo(jan25)).toBeLessThan(0)
    })

    it('should check isAfter', () => {
      const jan = BudgetMonth.fromString('2024-01')
      const feb = BudgetMonth.fromString('2024-02')

      expect(feb.isAfter(jan)).toBe(true)
      expect(jan.isAfter(feb)).toBe(false)
      expect(jan.isAfter(jan)).toBe(false)
    })

    it('should check isBefore', () => {
      const jan = BudgetMonth.fromString('2024-01')
      const feb = BudgetMonth.fromString('2024-02')

      expect(jan.isBefore(feb)).toBe(true)
      expect(feb.isBefore(jan)).toBe(false)
      expect(jan.isBefore(jan)).toBe(false)
    })
  })
})
