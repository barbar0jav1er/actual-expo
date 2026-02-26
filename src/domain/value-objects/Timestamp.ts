import { InvalidTimestampError } from '../errors'

// Regex for HULC timestamp format: 2024-02-26T12:00:00.000Z-0000-abc123def4567890
const TIMESTAMP_REGEX =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-([0-9a-fA-F]{4})-([0-9a-fA-F]{16})$/

export class Timestamp {
  static readonly MAX_DRIFT = 5 * 60 * 1000 // 5 minutes in milliseconds

  private constructor(
    private readonly millis: number,
    private readonly counter: number,
    private readonly node: string
  ) {}

  static now(node: string): Timestamp {
    if (!Timestamp.isValidNode(node)) {
      throw new InvalidTimestampError(`Invalid node ID: ${node}`)
    }
    return new Timestamp(Date.now(), 0, node)
  }

  static create(millis: number, counter: number, node: string): Timestamp {
    if (!Timestamp.isValidNode(node)) {
      throw new InvalidTimestampError(`Invalid node ID: ${node}`)
    }
    if (counter < 0 || counter > 0xffff) {
      throw new InvalidTimestampError(
        `Counter must be between 0 and 65535: ${counter}`
      )
    }
    return new Timestamp(millis, counter, node)
  }

  static parse(str: string): Timestamp | null {
    const match = str.match(TIMESTAMP_REGEX)
    if (!match) {
      return null
    }

    const [, isoDate, counterHex, node] = match
    const millis = new Date(isoDate).getTime()
    const counter = parseInt(counterHex, 16)

    if (isNaN(millis)) {
      return null
    }

    return new Timestamp(millis, counter, node.toLowerCase())
  }

  static isValidNode(node: string): boolean {
    return /^[0-9a-fA-F]{16}$/.test(node)
  }

  getMillis(): number {
    return this.millis
  }

  getCounter(): number {
    return this.counter
  }

  getNode(): string {
    return this.node
  }

  toString(): string {
    const isoDate = new Date(this.millis).toISOString()
    const counterHex = this.counter.toString(16).padStart(4, '0')
    return `${isoDate}-${counterHex}-${this.node}`
  }

  compareTo(other: Timestamp): number {
    // First compare by milliseconds
    if (this.millis !== other.millis) {
      return this.millis - other.millis
    }
    // Then by counter
    if (this.counter !== other.counter) {
      return this.counter - other.counter
    }
    // Finally by node (lexicographically)
    return this.node.localeCompare(other.node)
  }

  equals(other: Timestamp): boolean {
    return (
      this.millis === other.millis &&
      this.counter === other.counter &&
      this.node === other.node
    )
  }

  isAfter(other: Timestamp): boolean {
    return this.compareTo(other) > 0
  }

  isBefore(other: Timestamp): boolean {
    return this.compareTo(other) < 0
  }

  withCounter(counter: number): Timestamp {
    return Timestamp.create(this.millis, counter, this.node)
  }

  withMillis(millis: number): Timestamp {
    return Timestamp.create(millis, this.counter, this.node)
  }
}
