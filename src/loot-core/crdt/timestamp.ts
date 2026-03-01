import murmurhash from 'murmurhash'
import * as ExpoCrypto from 'expo-crypto'

import type { TrieNode } from './merkle'

export type Clock = {
  timestamp: MutableTimestamp
  merkle: TrieNode
}

// A mutable global clock — same as loot-core (module-level variable)
let clock: Clock

export function setClock(clock_: Clock): void {
  clock = clock_
}

export function getClock(): Clock {
  return clock
}

export function makeClock(timestamp: Timestamp, merkle: TrieNode = {}) {
  return { timestamp: MutableTimestamp.from(timestamp), merkle }
}

export function serializeClock(clock: Clock): string {
  return JSON.stringify({
    timestamp: clock.timestamp.toString(),
    merkle: clock.merkle,
  })
}

export function deserializeClock(clock: string): Clock {
  let data
  try {
    data = JSON.parse(clock)
  } catch {
    data = {
      timestamp: '1970-01-01T00:00:00.000Z-0000-' + makeClientId(),
      merkle: {},
    }
  }

  const ts = Timestamp.parse(data.timestamp)

  if (!ts) {
    throw new Timestamp.InvalidError(data.timestamp)
  }

  return {
    timestamp: MutableTimestamp.from(ts),
    merkle: data.merkle,
  }
}

export function makeClientId() {
  // loot-core uses uuid; here we use expo-crypto.randomUUID() which has the same shape
  return ExpoCrypto.randomUUID().replace(/-/g, '').slice(-16)
}

const config = {
  // Allow 5 minutes of clock drift
  maxDrift: 5 * 60 * 1000,
}

const MAX_COUNTER = parseInt('0xFFFF')
const MAX_NODE_LENGTH = 16

export class Timestamp {
  _state: { millis: number; counter: number; node: string }

  constructor(millis: number, counter: number, node: string) {
    this._state = { millis, counter, node }
  }

  valueOf() {
    return this.toString()
  }

  toString() {
    return [
      new Date(this.millis()).toISOString(),
      ('0000' + this.counter().toString(16).toUpperCase()).slice(-4),
      ('0000000000000000' + this.node()).slice(-16),
    ].join('-')
  }

  millis() {
    return this._state.millis
  }

  counter() {
    return this._state.counter
  }

  node() {
    return this._state.node
  }

  hash() {
    return murmurhash.v3(this.toString())
  }

  static init(options: { maxDrift?: number; node?: string } = {}) {
    if (options.maxDrift) {
      config.maxDrift = options.maxDrift
    }

    setClock(
      makeClock(
        new Timestamp(
          0,
          0,
          options.node
            ? ('0000000000000000' + options.node).toString().slice(-16)
            : '',
        ),
      ),
    )
  }

  static max = Timestamp.parse('9999-12-31T23:59:59.999Z-FFFF-FFFFFFFFFFFFFFFF')!

  static parse(timestamp: string | Timestamp): Timestamp | null {
    if (timestamp instanceof Timestamp) {
      return timestamp
    }
    if (typeof timestamp === 'string') {
      const parts = timestamp.split('-')
      if (parts && parts.length === 5) {
        const millis = Date.parse(parts.slice(0, 3).join('-')).valueOf()
        const counter = parseInt(parts[3], 16)
        const node = parts[4]
        if (
          !isNaN(millis) &&
          millis >= 0 &&
          !isNaN(counter) &&
          counter <= MAX_COUNTER &&
          typeof node === 'string' &&
          node.length <= MAX_NODE_LENGTH
        ) {
          return new Timestamp(millis, counter, node)
        }
      }
    }
    return null
  }

  static send(): Timestamp | null {
    if (!clock) {
      return null
    }

    const phys = Date.now()
    const lOld = clock.timestamp.millis()
    const cOld = clock.timestamp.counter()
    const lNew = Math.max(lOld, phys)
    const cNew = lOld === lNew ? cOld + 1 : 0

    if (lNew - phys > config.maxDrift) {
      throw new Timestamp.ClockDriftError(lNew, phys, config.maxDrift)
    }
    if (cNew > MAX_COUNTER) {
      throw new Timestamp.OverflowError()
    }

    clock.timestamp.setMillis(lNew)
    clock.timestamp.setCounter(cNew)

    return new Timestamp(
      clock.timestamp.millis(),
      clock.timestamp.counter(),
      clock.timestamp.node(),
    )
  }

  static recv(msg: Timestamp): Timestamp | null {
    if (!clock) {
      return null
    }

    const phys = Date.now()
    const lMsg = msg.millis()
    const cMsg = msg.counter()

    if (lMsg - phys > config.maxDrift) {
      throw new Timestamp.ClockDriftError()
    }

    const lOld = clock.timestamp.millis()
    const cOld = clock.timestamp.counter()
    const lNew = Math.max(Math.max(lOld, phys), lMsg)
    const cNew =
      lNew === lOld && lNew === lMsg
        ? Math.max(cOld, cMsg) + 1
        : lNew === lOld
          ? cOld + 1
          : lNew === lMsg
            ? cMsg + 1
            : 0

    if (lNew - phys > config.maxDrift) {
      throw new Timestamp.ClockDriftError()
    }
    if (cNew > MAX_COUNTER) {
      throw new Timestamp.OverflowError()
    }

    clock.timestamp.setMillis(lNew)
    clock.timestamp.setCounter(cNew)

    return new Timestamp(
      clock.timestamp.millis(),
      clock.timestamp.counter(),
      clock.timestamp.node(),
    )
  }

  static zero = Timestamp.parse('1970-01-01T00:00:00.000Z-0000-0000000000000000')!

  static since = (isoString: string) => isoString + '-0000-0000000000000000'

  static DuplicateNodeError = class DuplicateNodeError extends Error {
    constructor(node: string) {
      super('duplicate node identifier ' + node)
      this.name = 'DuplicateNodeError'
    }
  }

  static ClockDriftError = class ClockDriftError extends Error {
    constructor(...args: unknown[]) {
      super(['maximum clock drift exceeded'].concat(args as string[]).join(' '))
      this.name = 'ClockDriftError'
    }
  }

  static OverflowError = class OverflowError extends Error {
    constructor() {
      super('timestamp counter overflow')
      this.name = 'OverflowError'
    }
  }

  static InvalidError = class InvalidError extends Error {
    constructor(...args: unknown[]) {
      super(['timestamp is not valid'].concat(args.map(String)).join(' '))
      this.name = 'InvalidError'
    }
  }
}

class MutableTimestamp extends Timestamp {
  static from(timestamp: Timestamp) {
    return new MutableTimestamp(
      timestamp.millis(),
      timestamp.counter(),
      timestamp.node(),
    )
  }

  setMillis(n: number) {
    this._state.millis = n
  }

  setCounter(n: number) {
    this._state.counter = n
  }

  setNode(n: string) {
    this._state.node = n
  }
}
