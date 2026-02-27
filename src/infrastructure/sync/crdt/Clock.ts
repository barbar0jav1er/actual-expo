import { Timestamp } from '@domain/value-objects'
import { ClockDriftError, MAX_COUNTER, MAX_DRIFT, TimestampOverflowError } from './Timestamp'
import { MerkleTree, TrieNode } from './MerkleTree'

export interface ClockState {
  timestamp: Timestamp
  merkle: TrieNode
  node: string
}

export class Clock {
  private state: ClockState

  private constructor(state: ClockState) {
    this.state = state
  }

  static initialize(node?: string): Clock {
    const nodeId = node ?? Clock.generateNodeId()
    return new Clock({
      timestamp: Timestamp.now(nodeId),
      merkle: MerkleTree.emptyTrie(),
      node: nodeId,
    })
  }

  static fromState(state: ClockState): Clock {
    return new Clock({ ...state })
  }

  private static generateNodeId(): string {
    const array = new Uint8Array(8)
    crypto.getRandomValues(array)
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Generate a new timestamp for a local message.
   * Advances the logical clock and returns the new timestamp.
   */
  send(): Timestamp {
    const physical = Date.now()
    const logical = Math.max(this.state.timestamp.getMillis(), physical)

    let counter: number
    if (logical === this.state.timestamp.getMillis()) {
      counter = this.state.timestamp.getCounter() + 1
      if (counter > MAX_COUNTER) {
        throw new TimestampOverflowError()
      }
    } else {
      counter = 0
    }

    if (logical - physical > MAX_DRIFT) {
      throw new ClockDriftError(logical - physical)
    }

    const newTimestamp = Timestamp.create(logical, counter, this.state.node)
    this.state = { ...this.state, timestamp: newTimestamp }
    return newTimestamp
  }

  /**
   * Reconcile clock with a remote timestamp received during sync.
   */
  recv(remote: Timestamp): void {
    const physical = Date.now()
    const logical = Math.max(
      this.state.timestamp.getMillis(),
      physical,
      remote.getMillis()
    )

    let counter: number
    if (
      logical === this.state.timestamp.getMillis() &&
      logical === remote.getMillis()
    ) {
      counter =
        Math.max(this.state.timestamp.getCounter(), remote.getCounter()) + 1
    } else if (logical === this.state.timestamp.getMillis()) {
      counter = this.state.timestamp.getCounter() + 1
    } else if (logical === remote.getMillis()) {
      counter = remote.getCounter() + 1
    } else {
      counter = 0
    }

    if (counter > MAX_COUNTER) {
      throw new TimestampOverflowError()
    }

    if (logical - physical > MAX_DRIFT) {
      throw new ClockDriftError(logical - physical)
    }

    const newTimestamp = Timestamp.create(logical, counter, this.state.node)
    this.state = { ...this.state, timestamp: newTimestamp }
  }

  updateMerkle(timestamp: Timestamp): void {
    this.state = {
      ...this.state,
      merkle: MerkleTree.insert(this.state.merkle, timestamp),
    }
  }

  pruneMerkle(): void {
    this.state = {
      ...this.state,
      merkle: MerkleTree.prune(this.state.merkle),
    }
  }

  getMerkle(): TrieNode {
    return this.state.merkle
  }

  getNode(): string {
    return this.state.node
  }

  getTimestamp(): Timestamp {
    return this.state.timestamp
  }

  getState(): ClockState {
    return { ...this.state }
  }

  serialize(): string {
    return JSON.stringify({
      timestamp: this.state.timestamp.toString(),
      merkle: this.state.merkle,
      node: this.state.node,
    })
  }

  static deserialize(json: string): Clock {
    const data = JSON.parse(json) as {
      timestamp: string
      merkle: TrieNode
      node: string
    }
    return new Clock({
      timestamp: Timestamp.parse(data.timestamp)!,
      merkle: data.merkle,
      node: data.node,
    })
  }
}
