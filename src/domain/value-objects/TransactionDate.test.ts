import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TransactionDate } from './TransactionDate'
import { InvalidDateError } from '../errors'

describe('TransactionDate', () => {
  describe('fromDate', () => {
    it('should create from Date object', () => {
      const date = new Date(2024, 1, 26) // February 26, 2024
      const txDate = TransactionDate.fromDate(date)

      expect(txDate.getYear()).toBe(2024)
      expect(txDate.getMonth()).toBe(2)
      expect(txDate.getDay()).toBe(26)
    })

    it('should handle first day of month', () => {
      const date = new Date(2024, 0, 1) // January 1, 2024
      const txDate = TransactionDate.fromDate(date)

      expect(txDate.toNumber()).toBe(20240101)
    })

    it('should handle last day of month', () => {
      const date = new Date(2024, 11, 31) // December 31, 2024
      const txDate = TransactionDate.fromDate(date)

      expect(txDate.toNumber()).toBe(20241231)
    })
  })

  describe('fromString', () => {
    it('should parse "YYYY-MM-DD" format', () => {
      const txDate = TransactionDate.fromString('2024-02-26')

      expect(txDate.getYear()).toBe(2024)
      expect(txDate.getMonth()).toBe(2)
      expect(txDate.getDay()).toBe(26)
    })

    it('should throw error for invalid format', () => {
      expect(() => TransactionDate.fromString('2024-02')).toThrow(
        InvalidDateError
      )
      expect(() => TransactionDate.fromString('2024/02/26')).toThrow(
        InvalidDateError
      )
      expect(() => TransactionDate.fromString('invalid')).toThrow(
        InvalidDateError
      )
    })

    it('should throw error for invalid date', () => {
      // February 30 doesn't exist
      expect(() => TransactionDate.fromString('2024-02-30')).toThrow(
        InvalidDateError
      )
      // Month 13 doesn't exist
      expect(() => TransactionDate.fromString('2024-13-01')).toThrow(
        InvalidDateError
      )
      // Day 0 doesn't exist
      expect(() => TransactionDate.fromString('2024-02-00')).toThrow(
        InvalidDateError
      )
    })

    it('should validate February 29 in leap year', () => {
      // 2024 is a leap year
      expect(() => TransactionDate.fromString('2024-02-29')).not.toThrow()
    })

    it('should reject February 29 in non-leap year', () => {
      // 2023 is not a leap year
      expect(() => TransactionDate.fromString('2023-02-29')).toThrow(
        InvalidDateError
      )
    })
  })

  describe('fromNumber', () => {
    it('should create from YYYYMMDD number', () => {
      const txDate = TransactionDate.fromNumber(20240226)

      expect(txDate.getYear()).toBe(2024)
      expect(txDate.getMonth()).toBe(2)
      expect(txDate.getDay()).toBe(26)
    })

    it('should throw error for invalid date', () => {
      expect(() => TransactionDate.fromNumber(20240230)).toThrow(
        InvalidDateError
      )
      expect(() => TransactionDate.fromNumber(20241301)).toThrow(
        InvalidDateError
      )
    })
  })

  describe('today', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return current date', () => {
      vi.setSystemTime(new Date(2024, 1, 26)) // February 26, 2024
      const txDate = TransactionDate.today()

      expect(txDate.getYear()).toBe(2024)
      expect(txDate.getMonth()).toBe(2)
      expect(txDate.getDay()).toBe(26)
    })
  })

  describe('conversions', () => {
    it('should convert to number', () => {
      const txDate = TransactionDate.fromString('2024-02-26')
      expect(txDate.toNumber()).toBe(20240226)
    })

    it('should convert to string', () => {
      const txDate = TransactionDate.fromNumber(20240226)
      expect(txDate.toString()).toBe('2024-02-26')
    })

    it('should pad single digit month and day', () => {
      const txDate = TransactionDate.fromNumber(20240101)
      expect(txDate.toString()).toBe('2024-01-01')
    })

    it('should convert to Date object', () => {
      const txDate = TransactionDate.fromString('2024-02-26')
      const date = txDate.toDate()

      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(1) // 0-indexed
      expect(date.getDate()).toBe(26)
    })

    it('should get BudgetMonth', () => {
      const txDate = TransactionDate.fromString('2024-02-26')
      const budgetMonth = txDate.getBudgetMonth()

      expect(budgetMonth.getYear()).toBe(2024)
      expect(budgetMonth.getMonth()).toBe(2)
    })
  })

  describe('comparison', () => {
    it('should check equality', () => {
      const a = TransactionDate.fromString('2024-02-26')
      const b = TransactionDate.fromString('2024-02-26')
      const c = TransactionDate.fromString('2024-02-27')

      expect(a.equals(b)).toBe(true)
      expect(a.equals(c)).toBe(false)
    })

    it('should compare dates', () => {
      const feb26 = TransactionDate.fromString('2024-02-26')
      const feb27 = TransactionDate.fromString('2024-02-27')
      const mar01 = TransactionDate.fromString('2024-03-01')

      expect(feb26.compareTo(feb27)).toBeLessThan(0)
      expect(feb27.compareTo(feb26)).toBeGreaterThan(0)
      expect(feb26.compareTo(feb26)).toBe(0)
      expect(feb27.compareTo(mar01)).toBeLessThan(0)
    })

    it('should check isBefore', () => {
      const feb26 = TransactionDate.fromString('2024-02-26')
      const feb27 = TransactionDate.fromString('2024-02-27')

      expect(feb26.isBefore(feb27)).toBe(true)
      expect(feb27.isBefore(feb26)).toBe(false)
      expect(feb26.isBefore(feb26)).toBe(false)
    })

    it('should check isAfter', () => {
      const feb26 = TransactionDate.fromString('2024-02-26')
      const feb27 = TransactionDate.fromString('2024-02-27')

      expect(feb27.isAfter(feb26)).toBe(true)
      expect(feb26.isAfter(feb27)).toBe(false)
      expect(feb26.isAfter(feb26)).toBe(false)
    })
  })

  describe('addDays', () => {
    it('should add days within same month', () => {
      const txDate = TransactionDate.fromString('2024-02-26')
      const result = txDate.addDays(2)
      expect(result.toString()).toBe('2024-02-28')
    })

    it('should add days across month boundary', () => {
      const txDate = TransactionDate.fromString('2024-02-28')
      const result = txDate.addDays(2)
      expect(result.toString()).toBe('2024-03-01')
    })

    it('should add days across year boundary', () => {
      const txDate = TransactionDate.fromString('2024-12-30')
      const result = txDate.addDays(5)
      expect(result.toString()).toBe('2025-01-04')
    })

    it('should subtract days (negative)', () => {
      const txDate = TransactionDate.fromString('2024-02-05')
      const result = txDate.addDays(-3)
      expect(result.toString()).toBe('2024-02-02')
    })

    it('should subtract days across month boundary', () => {
      const txDate = TransactionDate.fromString('2024-03-02')
      const result = txDate.addDays(-3)
      expect(result.toString()).toBe('2024-02-28')
    })

    it('should be immutable', () => {
      const original = TransactionDate.fromString('2024-02-26')
      const result = original.addDays(5)

      expect(original.toString()).toBe('2024-02-26')
      expect(result.toString()).toBe('2024-03-02')
    })
  })
})
