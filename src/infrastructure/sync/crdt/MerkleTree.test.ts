import { describe, it, expect } from 'vitest'
import { Timestamp } from '@domain/value-objects'
import { MerkleTree } from './MerkleTree'

const NODE = 'abc123def4567890'

function makeTs(iso: string, counter = 0): Timestamp {
  return Timestamp.parse(`${iso}-${counter.toString(16).padStart(4, '0')}-${NODE}`)!
}

describe('MerkleTree', () => {
  it('creates an empty trie with hash 0', () => {
    const trie = MerkleTree.emptyTrie()
    expect(trie.hash).toBe(0)
    expect(trie['0']).toBeUndefined()
  })

  it('detects identical tries as null diff', () => {
    const trie1 = MerkleTree.emptyTrie()
    const trie2 = MerkleTree.emptyTrie()
    expect(MerkleTree.diff(trie1, trie2)).toBeNull()
  })

  it('detects difference after inserting a timestamp', () => {
    const ts = makeTs('2024-02-26T12:00:00.000Z')
    const trie1 = MerkleTree.emptyTrie()
    const trie2 = MerkleTree.insert(trie1, ts)

    expect(MerkleTree.diff(trie1, trie2)).not.toBeNull()
  })

  it('returns null diff after inserting same timestamp to both tries', () => {
    const ts = makeTs('2024-02-26T12:00:00.000Z')
    const trie1 = MerkleTree.insert(MerkleTree.emptyTrie(), ts)
    const trie2 = MerkleTree.insert(MerkleTree.emptyTrie(), ts)

    expect(MerkleTree.diff(trie1, trie2)).toBeNull()
  })

  it('diff result is a timestamp in milliseconds (multiple of 60000)', () => {
    const ts = makeTs('2024-02-26T12:00:00.000Z')
    const trie1 = MerkleTree.emptyTrie()
    const trie2 = MerkleTree.insert(trie1, ts)

    const diff = MerkleTree.diff(trie1, trie2)
    expect(diff).not.toBeNull()
    expect(diff! % 60000).toBe(0)
  })

  it('inserts multiple timestamps and keeps consistent hash', () => {
    const ts1 = makeTs('2024-02-26T12:00:00.000Z', 0)
    const ts2 = makeTs('2024-02-26T12:01:00.000Z', 0)
    const ts3 = makeTs('2024-02-26T12:02:00.000Z', 0)

    let trie = MerkleTree.emptyTrie()
    trie = MerkleTree.insert(trie, ts1)
    trie = MerkleTree.insert(trie, ts2)
    trie = MerkleTree.insert(trie, ts3)

    expect(trie.hash).not.toBe(0)
  })

  it('prune reduces tree depth', () => {
    const ts = makeTs('2024-02-26T12:00:00.000Z')
    let trie = MerkleTree.emptyTrie()
    trie = MerkleTree.insert(trie, ts)

    const pruned = MerkleTree.prune(trie, 1)
    // At depth 1, children should have no sub-children
    for (const branch of ['0', '1', '2'] as const) {
      if (pruned[branch]) {
        expect(pruned[branch]!['0']).toBeUndefined()
        expect(pruned[branch]!['1']).toBeUndefined()
        expect(pruned[branch]!['2']).toBeUndefined()
      }
    }
  })

  it('serializes and deserializes correctly', () => {
    const ts = makeTs('2024-02-26T12:00:00.000Z')
    const trie = MerkleTree.insert(MerkleTree.emptyTrie(), ts)

    const json = MerkleTree.serialize(trie)
    const restored = MerkleTree.deserialize(json)

    expect(MerkleTree.diff(trie, restored)).toBeNull()
  })
})
