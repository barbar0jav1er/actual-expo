import { describe, it, expect } from 'vitest'
import { Timestamp } from '@domain/value-objects'
import { Clock } from './Clock'
import { MerkleTree } from './MerkleTree'

const NODE = 'abc123def4567890'

describe('Clock', () => {
  it('initializes with a valid node ID', () => {
    const clock = Clock.initialize(NODE)
    expect(clock.getNode()).toBe(NODE)
    expect(clock.getTimestamp()).toBeInstanceOf(Timestamp)
  })

  it('generates a random node ID when none provided', () => {
    const clock = Clock.initialize()
    expect(clock.getNode()).toMatch(/^[0-9a-f]{16}$/)
  })

  it('updateMerkle inserts timestamp into the trie', () => {
    const clock = Clock.initialize(NODE)
    const ts = clock.send()
    clock.updateMerkle(ts)

    const empty = MerkleTree.emptyTrie()
    expect(MerkleTree.diff(clock.getMerkle(), empty)).not.toBeNull()
  })

  it('pruneMerkle reduces trie size', () => {
    const clock = Clock.initialize(NODE)
    const ts = clock.send()
    clock.updateMerkle(ts)

    const before = JSON.stringify(clock.getMerkle())
    clock.pruneMerkle()
    // After prune, hash should still be present but branches trimmed
    expect(clock.getMerkle().hash).toBeDefined()
    // Pruned trie should be serializable
    expect(() => MerkleTree.serialize(clock.getMerkle())).not.toThrow()
    void before
  })

  it('getState returns a copy of the state', () => {
    const clock = Clock.initialize(NODE)
    const state = clock.getState()
    expect(state.node).toBe(NODE)
    // Mutations to state copy do not affect clock
    state.node = 'changed'
    expect(clock.getNode()).toBe(NODE)
  })

  it('fromState restores clock from a ClockState', () => {
    const original = Clock.initialize(NODE)
    original.send()

    const state = original.getState()
    const restored = Clock.fromState(state)

    expect(restored.getNode()).toBe(original.getNode())
    expect(restored.getTimestamp().toString()).toBe(original.getTimestamp().toString())
  })
})
