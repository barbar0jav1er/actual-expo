import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Timestamp } from './Timestamp'
import { InvalidTimestampError } from '../errors'

describe('Timestamp', () => {
  const validNode = 'abc123def4567890'

  describe('now', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should create timestamp with current time', () => {
      const mockTime = new Date('2024-02-26T12:00:00.000Z').getTime()
      vi.setSystemTime(mockTime)

      const ts = Timestamp.now(validNode)
      expect(ts.getMillis()).toBe(mockTime)
      expect(ts.getCounter()).toBe(0)
      expect(ts.getNode()).toBe(validNode)
    })

    it('should throw error for invalid node', () => {
      expect(() => Timestamp.now('invalid')).toThrow(InvalidTimestampError)
      expect(() => Timestamp.now('abc')).toThrow(InvalidTimestampError)
      expect(() => Timestamp.now('')).toThrow(InvalidTimestampError)
    })
  })

  describe('create', () => {
    it('should create timestamp with specific values', () => {
      const millis = Date.now()
      const counter = 42
      const ts = Timestamp.create(millis, counter, validNode)

      expect(ts.getMillis()).toBe(millis)
      expect(ts.getCounter()).toBe(counter)
      expect(ts.getNode()).toBe(validNode)
    })

    it('should throw error for invalid counter', () => {
      expect(() => Timestamp.create(Date.now(), -1, validNode)).toThrow(
        InvalidTimestampError
      )
      expect(() => Timestamp.create(Date.now(), 65536, validNode)).toThrow(
        InvalidTimestampError
      )
    })

    it('should accept counter at boundaries', () => {
      expect(() => Timestamp.create(Date.now(), 0, validNode)).not.toThrow()
      expect(() => Timestamp.create(Date.now(), 65535, validNode)).not.toThrow()
    })
  })

  describe('parse', () => {
    it('should parse valid timestamp string', () => {
      const str = '2024-02-26T12:00:00.000Z-002a-abc123def4567890'
      const ts = Timestamp.parse(str)

      expect(ts).not.toBeNull()
      expect(ts!.getMillis()).toBe(
        new Date('2024-02-26T12:00:00.000Z').getTime()
      )
      expect(ts!.getCounter()).toBe(42) // 0x002a = 42
      expect(ts!.getNode()).toBe('abc123def4567890')
    })

    it('should normalize node to lowercase', () => {
      const str = '2024-02-26T12:00:00.000Z-0000-ABC123DEF4567890'
      const ts = Timestamp.parse(str)

      expect(ts).not.toBeNull()
      expect(ts!.getNode()).toBe('abc123def4567890')
    })

    it('should return null for invalid format', () => {
      expect(Timestamp.parse('invalid')).toBeNull()
      expect(Timestamp.parse('')).toBeNull()
      expect(Timestamp.parse('2024-02-26T12:00:00.000Z')).toBeNull()
      expect(Timestamp.parse('2024-02-26T12:00:00.000Z-002a')).toBeNull()
      expect(
        Timestamp.parse('2024-02-26T12:00:00.000Z-002a-abc')
      ).toBeNull()
    })

    it('should return null for invalid date', () => {
      expect(
        Timestamp.parse('invalid-date-here-0000-abc123def4567890')
      ).toBeNull()
    })
  })

  describe('toString', () => {
    it('should serialize to correct format', () => {
      const millis = new Date('2024-02-26T12:00:00.000Z').getTime()
      const ts = Timestamp.create(millis, 42, validNode)

      expect(ts.toString()).toBe(
        '2024-02-26T12:00:00.000Z-002a-abc123def4567890'
      )
    })

    it('should pad counter with zeros', () => {
      const millis = new Date('2024-02-26T12:00:00.000Z').getTime()
      const ts = Timestamp.create(millis, 0, validNode)

      expect(ts.toString()).toContain('-0000-')
    })

    it('should support round-trip serialization', () => {
      const original = '2024-02-26T12:00:00.000Z-ffff-abc123def4567890'
      const ts = Timestamp.parse(original)
      expect(ts!.toString()).toBe(original)
    })
  })

  describe('compareTo', () => {
    it('should compare by millis first', () => {
      const ts1 = Timestamp.create(1000, 0, validNode)
      const ts2 = Timestamp.create(2000, 0, validNode)

      expect(ts1.compareTo(ts2)).toBeLessThan(0)
      expect(ts2.compareTo(ts1)).toBeGreaterThan(0)
    })

    it('should compare by counter when millis are equal', () => {
      const ts1 = Timestamp.create(1000, 1, validNode)
      const ts2 = Timestamp.create(1000, 2, validNode)

      expect(ts1.compareTo(ts2)).toBeLessThan(0)
      expect(ts2.compareTo(ts1)).toBeGreaterThan(0)
    })

    it('should compare by node when millis and counter are equal', () => {
      const ts1 = Timestamp.create(1000, 1, 'aaaaaaaaaaaaaaaa')
      const ts2 = Timestamp.create(1000, 1, 'bbbbbbbbbbbbbbbb')

      expect(ts1.compareTo(ts2)).toBeLessThan(0)
      expect(ts2.compareTo(ts1)).toBeGreaterThan(0)
    })

    it('should return 0 for equal timestamps', () => {
      const ts1 = Timestamp.create(1000, 1, validNode)
      const ts2 = Timestamp.create(1000, 1, validNode)

      expect(ts1.compareTo(ts2)).toBe(0)
    })
  })

  describe('equals', () => {
    it('should return true for equal timestamps', () => {
      const ts1 = Timestamp.create(1000, 1, validNode)
      const ts2 = Timestamp.create(1000, 1, validNode)

      expect(ts1.equals(ts2)).toBe(true)
    })

    it('should return false for different millis', () => {
      const ts1 = Timestamp.create(1000, 1, validNode)
      const ts2 = Timestamp.create(2000, 1, validNode)

      expect(ts1.equals(ts2)).toBe(false)
    })

    it('should return false for different counter', () => {
      const ts1 = Timestamp.create(1000, 1, validNode)
      const ts2 = Timestamp.create(1000, 2, validNode)

      expect(ts1.equals(ts2)).toBe(false)
    })

    it('should return false for different node', () => {
      const ts1 = Timestamp.create(1000, 1, 'aaaaaaaaaaaaaaaa')
      const ts2 = Timestamp.create(1000, 1, 'bbbbbbbbbbbbbbbb')

      expect(ts1.equals(ts2)).toBe(false)
    })
  })

  describe('isAfter and isBefore', () => {
    it('should check if timestamp is after another', () => {
      const ts1 = Timestamp.create(2000, 0, validNode)
      const ts2 = Timestamp.create(1000, 0, validNode)

      expect(ts1.isAfter(ts2)).toBe(true)
      expect(ts2.isAfter(ts1)).toBe(false)
      expect(ts1.isAfter(ts1)).toBe(false)
    })

    it('should check if timestamp is before another', () => {
      const ts1 = Timestamp.create(1000, 0, validNode)
      const ts2 = Timestamp.create(2000, 0, validNode)

      expect(ts1.isBefore(ts2)).toBe(true)
      expect(ts2.isBefore(ts1)).toBe(false)
      expect(ts1.isBefore(ts1)).toBe(false)
    })
  })

  describe('immutable operations', () => {
    it('withCounter should create new timestamp with different counter', () => {
      const ts1 = Timestamp.create(1000, 1, validNode)
      const ts2 = ts1.withCounter(5)

      expect(ts1.getCounter()).toBe(1)
      expect(ts2.getCounter()).toBe(5)
      expect(ts2.getMillis()).toBe(ts1.getMillis())
      expect(ts2.getNode()).toBe(ts1.getNode())
    })

    it('withMillis should create new timestamp with different millis', () => {
      const ts1 = Timestamp.create(1000, 1, validNode)
      const ts2 = ts1.withMillis(2000)

      expect(ts1.getMillis()).toBe(1000)
      expect(ts2.getMillis()).toBe(2000)
      expect(ts2.getCounter()).toBe(ts1.getCounter())
      expect(ts2.getNode()).toBe(ts1.getNode())
    })
  })

  describe('isValidNode', () => {
    it('should validate correct node IDs', () => {
      expect(Timestamp.isValidNode('abc123def4567890')).toBe(true)
      expect(Timestamp.isValidNode('0000000000000000')).toBe(true)
      expect(Timestamp.isValidNode('ffffffffffffffff')).toBe(true)
      expect(Timestamp.isValidNode('ABCDEF1234567890')).toBe(true)
    })

    it('should reject invalid node IDs', () => {
      expect(Timestamp.isValidNode('')).toBe(false)
      expect(Timestamp.isValidNode('abc')).toBe(false)
      expect(Timestamp.isValidNode('abc123def456789')).toBe(false) // 15 chars
      expect(Timestamp.isValidNode('abc123def45678901')).toBe(false) // 17 chars
      expect(Timestamp.isValidNode('ghijklmnopqrstuv')).toBe(false) // invalid hex
    })
  })

  describe('MAX_DRIFT', () => {
    it('should be 5 minutes in milliseconds', () => {
      expect(Timestamp.MAX_DRIFT).toBe(5 * 60 * 1000)
    })
  })
})
