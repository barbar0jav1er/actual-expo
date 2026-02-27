// Re-export domain Timestamp for use across the CRDT module
export { Timestamp } from '@domain/value-objects'

export const MAX_COUNTER = 0xffff
export const MAX_DRIFT = 5 * 60 * 1000 // 5 minutes in ms

export class TimestampOverflowError extends Error {
  constructor() {
    super('Timestamp counter overflow')
  }
}

export class ClockDriftError extends Error {
  constructor(public readonly drift: number) {
    super(`Clock drift too large: ${drift}ms`)
  }
}
