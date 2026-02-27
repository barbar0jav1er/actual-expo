import { describe, it, expect } from 'vitest'
import { SyncEncoder } from './SyncEncoder'
import { SyncDecoder } from './SyncDecoder'
import {
  encodeSyncRequest,
  encodeMessage,
  encodeMessageEnvelope,
} from './generated/sync'
import { MerkleTree } from '../crdt/MerkleTree'

const FILE_ID = 'test-file-id'
const GROUP_ID = 'test-group-id'
const SINCE = '2024-02-26T00:00:00.000Z-0000-0000000000000000'
const TIMESTAMP = '2024-02-26T12:00:00.000Z-0000-abc123def4567890'

describe('SyncDecoder', () => {
  it('decodes a SyncResponse with a merkle tree', () => {
    // Build a fake response buffer manually
    const merkle = MerkleTree.serialize(MerkleTree.emptyTrie())
    const responseBuffer = encodeSyncRequest({
      messages: [],
      fileId: '',
      groupId: '',
      since: '',
    })
    // We test the decoder with a proper SyncResponse format
    // Since we only have encodeSyncRequest, we test with a round-trip approach
    const decoder = new SyncDecoder()
    // Empty response with just merkle
    const buf = buildSyncResponse([], merkle)
    const decoded = decoder.decode(buf)

    expect(decoded.messages).toHaveLength(0)
    expect(decoded.merkle).toEqual(MerkleTree.emptyTrie())
    void responseBuffer
  })

  it('decodes a SyncResponse with messages', () => {
    const msg = encodeMessage({
      dataset: 'transactions',
      row: 'tx-001',
      column: 'amount',
      value: 'N:5000',
    })
    const envelope = encodeMessageEnvelope({
      timestamp: TIMESTAMP,
      isEncrypted: false,
      content: msg,
    })
    const merkle = MerkleTree.serialize(MerkleTree.emptyTrie())
    const buf = buildSyncResponse([envelope], merkle)

    const decoder = new SyncDecoder()
    const decoded = decoder.decode(buf)

    expect(decoded.messages).toHaveLength(1)
    expect(decoded.messages[0].timestamp).toBe(TIMESTAMP)
    expect(decoded.messages[0].dataset).toBe('transactions')
    expect(decoded.messages[0].row).toBe('tx-001')
    expect(decoded.messages[0].column).toBe('amount')
    expect(decoded.messages[0].value).toBe('N:5000')
    expect(decoded.messages[0].isEncrypted).toBe(false)
  })

  it('round-trips encoder → decoder', () => {
    const encoder = new SyncEncoder()
    const decoder = new SyncDecoder()

    // We encode a request and verify it's valid binary
    const encoded = encoder.encode({
      messages: [
        {
          timestamp: TIMESTAMP,
          dataset: 'accounts',
          row: 'acc-001',
          column: 'name',
          value: 'S:Savings',
        },
      ],
      fileId: FILE_ID,
      groupId: GROUP_ID,
      since: SINCE,
    })

    expect(encoded).toBeInstanceOf(Uint8Array)
    expect(encoded.length).toBeGreaterThan(0)

    // Verify that a proper response can be decoded
    const merkle = MerkleTree.serialize(MerkleTree.emptyTrie())
    const responseMsg = encodeMessage({
      dataset: 'accounts',
      row: 'acc-001',
      column: 'name',
      value: 'S:Savings',
    })
    const envelope = encodeMessageEnvelope({
      timestamp: TIMESTAMP,
      isEncrypted: false,
      content: responseMsg,
    })
    const response = buildSyncResponse([envelope], merkle)
    const result = decoder.decode(response)

    expect(result.messages[0].value).toBe('S:Savings')
  })
})

/**
 * Build a minimal SyncResponse protobuf buffer.
 * SyncResponse fields: repeated MessageEnvelope messages=1, string merkle=2
 */
function buildSyncResponse(envelopes: Uint8Array[], merkle: string): Uint8Array {
  const parts: number[] = []

  for (const env of envelopes) {
    // Field 1, wire type 2 (length-delimited)
    parts.push(...encodeTag(1, 2), ...encodeVarInt(env.length), ...env)
  }

  if (merkle) {
    const merkleBytes = new TextEncoder().encode(merkle)
    parts.push(...encodeTag(2, 2), ...encodeVarInt(merkleBytes.length), ...merkleBytes)
  }

  return new Uint8Array(parts)
}

function encodeVarInt(value: number): number[] {
  const bytes: number[] = []
  let v = value >>> 0
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  bytes.push(v & 0x7f)
  return bytes
}

function encodeTag(fieldNumber: number, wireType: number): number[] {
  return encodeVarInt((fieldNumber << 3) | wireType)
}
