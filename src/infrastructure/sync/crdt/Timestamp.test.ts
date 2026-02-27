import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Timestamp } from '@domain/value-objects'
import { Clock } from './Clock'
import { MerkleTree } from './MerkleTree'
import { TimestampOverflowError, ClockDriftError } from './Timestamp'

const NODE = 'abc123def4567890'
const TS_STR = '2024-02-26T12:00:00.000Z-0000-abc123def4567890'

describe('Timestamp (CRDT ops via Clock)', () => {
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

describe('Clock.send', () => {
  const baseMillis = new Date('2024-02-26T12:00:00.000Z').getTime()

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(baseMillis)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts counter at 0 when physical time advances past clock timestamp', () => {
    // Clock is 1 second behind the mocked physical time
    const pastTs = Timestamp.create(baseMillis - 1000, 3, NODE)
    const clock = Clock.fromState({
      timestamp: pastTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    const ts = clock.send()
    expect(ts.getCounter()).toBe(0)
    expect(ts.getMillis()).toBe(baseMillis)
  })

  it('increments counter on same millisecond', () => {
    const startTs = Timestamp.create(baseMillis, 0, NODE)
    const clock = Clock.fromState({
      timestamp: startTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    const ts1 = clock.send()
    const ts2 = clock.send()

    expect(ts1.getCounter()).toBe(1)
    expect(ts2.getCounter()).toBe(2)
  })

  it('resets counter when time advances', () => {
    const startTs = Timestamp.create(baseMillis, 5, NODE)
    const clock = Clock.fromState({
      timestamp: startTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    vi.spyOn(Date, 'now').mockReturnValue(baseMillis + 1000)
    const ts = clock.send()

    expect(ts.getCounter()).toBe(0)
    expect(ts.getMillis()).toBe(baseMillis + 1000)
  })

  it('throws TimestampOverflowError when counter exceeds 0xFFFF', () => {
    const startTs = Timestamp.create(baseMillis, 0xffff, NODE)
    const clock = Clock.fromState({
      timestamp: startTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    expect(() => clock.send()).toThrow(TimestampOverflowError)
  })

  it('throws ClockDriftError when logical clock drifts too far ahead', () => {
    const futureMillis = baseMillis + 10 * 60 * 1000 // 10 minutes ahead
    const startTs = Timestamp.create(futureMillis, 0, NODE)
    const clock = Clock.fromState({
      timestamp: startTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    expect(() => clock.send()).toThrow(ClockDriftError)
  })
})

describe('Clock.recv', () => {
  const baseMillis = new Date('2024-02-26T12:00:00.000Z').getTime()

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(baseMillis)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('advances clock to remote time when remote is ahead', () => {
    const localTs = Timestamp.create(baseMillis, 0, NODE)
    const clock = Clock.fromState({
      timestamp: localTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    const remoteTs = Timestamp.create(baseMillis + 1000, 3, 'bbbbbbbbbbbbbbbb')
    clock.recv(remoteTs)

    const newTs = clock.getTimestamp()
    expect(newTs.getMillis()).toBe(baseMillis + 1000)
    expect(newTs.getCounter()).toBe(4)
  })

  it('takes max counter + 1 when both clocks equal', () => {
    const localTs = Timestamp.create(baseMillis, 2, NODE)
    const clock = Clock.fromState({
      timestamp: localTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    const remoteTs = Timestamp.create(baseMillis, 5, 'bbbbbbbbbbbbbbbb')
    clock.recv(remoteTs)

    expect(clock.getTimestamp().getCounter()).toBe(6)
  })

  it('throws TimestampOverflowError when counter would overflow', () => {
    const localTs = Timestamp.create(baseMillis, 0xffff, NODE)
    const clock = Clock.fromState({
      timestamp: localTs,
      merkle: MerkleTree.emptyTrie(),
      node: NODE,
    })

    const remoteTs = Timestamp.create(baseMillis, 0xffff, 'bbbbbbbbbbbbbbbb')
    expect(() => clock.recv(remoteTs)).toThrow(TimestampOverflowError)
  })
})

describe('Clock serialization', () => {
  it('serializes and deserializes correctly', () => {
    const clock = Clock.initialize(NODE)
    clock.send()

    const json = clock.serialize()
    const restored = Clock.deserialize(json)

    expect(restored.getNode()).toBe(clock.getNode())
    expect(restored.getTimestamp().toString()).toBe(clock.getTimestamp().toString())
  })
})
