import { describe, it, expect } from 'vitest'
import { Timestamp } from '@domain/value-objects'
import { TimestampOverflowError, ClockDriftError } from './Timestamp'

const NODE = 'abc123def4567890'
const TS_STR = '2024-02-26T12:00:00.000Z-0000-abc123def4567890'

describe('Timestamp (domain value object)', () => {
  describe('parse', () => {
    it('parses valid HULC timestamp string', () => {
      const ts = Timestamp.parse(TS_STR)

      expect(ts).not.toBeNull()
      expect(ts!.getCounter()).toBe(0)
      expect(ts!.getNode()).toBe(NODE)
    })

    it('returns null for invalid string', () => {
      expect(Timestamp.parse('invalid')).toBeNull()
      expect(Timestamp.parse('')).toBeNull()
    })
  })

  describe('toString', () => {
    it('serializes to HULC format', () => {
      const ts = Timestamp.parse(TS_STR)!
      expect(ts.toString()).toBe(TS_STR)
    })

    it('pads counter with leading zeros', () => {
      const ts = Timestamp.create(new Date('2024-02-26T12:00:00.000Z').getTime(), 1, NODE)
      expect(ts.toString()).toContain('-0001-')
    })
  })

  describe('compareTo', () => {
    it('orders by millis first', () => {
      const ts1 = Timestamp.parse('2024-02-26T12:00:00.000Z-0000-abc123def4567890')!
      const ts2 = Timestamp.parse('2024-02-26T12:00:01.000Z-0000-abc123def4567890')!

      expect(ts1.compareTo(ts2)).toBeLessThan(0)
      expect(ts2.compareTo(ts1)).toBeGreaterThan(0)
    })

    it('orders by counter when millis equal', () => {
      const ts1 = Timestamp.parse('2024-02-26T12:00:00.000Z-0000-abc123def4567890')!
      const ts2 = Timestamp.parse('2024-02-26T12:00:00.000Z-0001-abc123def4567890')!

      expect(ts1.compareTo(ts2)).toBeLessThan(0)
    })

    it('orders by node when millis and counter equal', () => {
      const ts1 = Timestamp.parse('2024-02-26T12:00:00.000Z-0000-aaaaaaaaaaaaaaa0')!
      const ts2 = Timestamp.parse('2024-02-26T12:00:00.000Z-0000-bbbbbbbbbbbbbb00')!

      expect(ts1.compareTo(ts2)).toBeLessThan(0)
    })
  })
})

// Ensure error classes are exported (compile-time check)
describe('Timestamp error types', () => {
  it('exports TimestampOverflowError', () => {
    expect(TimestampOverflowError).toBeDefined()
  })

  it('exports ClockDriftError', () => {
    expect(ClockDriftError).toBeDefined()
  })
})
