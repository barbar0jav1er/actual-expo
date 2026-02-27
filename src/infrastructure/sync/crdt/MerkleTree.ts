import type { Timestamp } from './Timestamp'

export type TrieNode = {
  '0'?: TrieNode
  '1'?: TrieNode
  '2'?: TrieNode
  hash?: number
}

export class MerkleTree {
  static emptyTrie(): TrieNode {
    return { hash: 0 }
  }

  static insert(trie: TrieNode, timestamp: Timestamp): TrieNode {
    const key = this.timestampToKey(timestamp)
    const hash = this.hashTimestamp(timestamp)
    return this.insertKey({ ...trie }, key, hash, 0)
  }

  private static insertKey(
    node: TrieNode,
    key: string,
    hash: number,
    depth: number
  ): TrieNode {
    if (depth === key.length) {
      return { ...node, hash: (node.hash ?? 0) ^ hash }
    }

    const branch = key[depth] as '0' | '1' | '2'
    const child = node[branch] ?? { hash: 0 }
    const newChild = this.insertKey({ ...child }, key, hash, depth + 1)

    return {
      ...node,
      [branch]: newChild,
      hash: this.computeHash(node, branch, newChild),
    }
  }

  /**
   * Returns the earliest divergence timestamp (in ms) between two tries,
   * or null if they are identical.
   */
  static diff(trie1: TrieNode, trie2: TrieNode): number | null {
    if (trie1.hash === trie2.hash) {
      return null
    }
    return this.findDiff(trie1, trie2, '')
  }

  private static findDiff(
    node1: TrieNode,
    node2: TrieNode,
    path: string
  ): number {
    for (const branch of ['0', '1', '2'] as const) {
      const child1 = node1[branch]
      const child2 = node2[branch]

      const hash1 = child1?.hash ?? 0
      const hash2 = child2?.hash ?? 0

      if (hash1 !== hash2) {
        const newPath = path + branch

        if (!child1 || !child2) {
          return this.keyToTimestamp(newPath)
        }

        return this.findDiff(child1, child2, newPath)
      }
    }

    return this.keyToTimestamp(path)
  }

  /** Prune old branches beyond maxDepth to reduce memory usage */
  static prune(trie: TrieNode, maxDepth = 2): TrieNode {
    return this.pruneNode(trie, 0, maxDepth)
  }

  private static pruneNode(
    node: TrieNode,
    depth: number,
    maxDepth: number
  ): TrieNode {
    if (depth >= maxDepth) {
      return { hash: node.hash }
    }

    const result: TrieNode = { hash: node.hash }

    for (const branch of ['0', '1', '2'] as const) {
      if (node[branch]) {
        result[branch] = this.pruneNode(node[branch]!, depth + 1, maxDepth)
      }
    }

    return result
  }

  static serialize(trie: TrieNode): string {
    return JSON.stringify(trie)
  }

  static deserialize(json: string): TrieNode {
    return JSON.parse(json) as TrieNode
  }

  // Convert timestamp millis to a base-3 key (per-minute granularity)
  private static timestampToKey(ts: Timestamp): string {
    const minutes = Math.floor(ts.getMillis() / 1000 / 60)
    return minutes.toString(3).padStart(16, '0')
  }

  // Convert base-3 key back to millis
  private static keyToTimestamp(key: string): number {
    const minutes = parseInt(key || '0', 3)
    return minutes * 60 * 1000
  }

  // Djb2-style hash of timestamp string
  private static hashTimestamp(ts: Timestamp): number {
    const str = ts.toString()
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
      hash = hash | 0 // keep as 32-bit integer
    }
    return hash
  }

  private static computeHash(
    node: TrieNode,
    updatedBranch: '0' | '1' | '2',
    newChild: TrieNode
  ): number {
    let hash = 0
    for (const branch of ['0', '1', '2'] as const) {
      const child = branch === updatedBranch ? newChild : node[branch]
      if (child) {
        hash ^= child.hash ?? 0
      }
    }
    return hash
  }
}
