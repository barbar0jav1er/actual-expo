import { describe, it, expect } from 'vitest'
import { SyncEncoder } from './SyncEncoder'

const FILE_ID = 'test-file-id'
const GROUP_ID = 'test-group-id'
const SINCE = '2024-02-26T00:00:00.000Z-0000-0000000000000000'
const TIMESTAMP = '2024-02-26T12:00:00.000Z-0000-abc123def4567890'

describe('SyncEncoder', () => {
  it('encodes a sync request to a non-empty Uint8Array', () => {
    const encoder = new SyncEncoder()

    const buffer = encoder.encode({
      messages: [
        {
          timestamp: TIMESTAMP,
          dataset: 'transactions',
          row: 'tx-001',
          column: 'amount',
          value: 'N:5000',
        },
      ],
      fileId: FILE_ID,
      groupId: GROUP_ID,
      since: SINCE,
    })

    expect(buffer).toBeInstanceOf(Uint8Array)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('encodes an empty messages array', () => {
    const encoder = new SyncEncoder()

    const buffer = encoder.encode({
      messages: [],
      fileId: FILE_ID,
      groupId: GROUP_ID,
      since: SINCE,
    })

    expect(buffer).toBeInstanceOf(Uint8Array)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('encodes multiple messages', () => {
    const encoder = new SyncEncoder()

    const single = encoder.encode({
      messages: [
        {
          timestamp: TIMESTAMP,
          dataset: 'accounts',
          row: 'acc-001',
          column: 'name',
          value: 'S:Checking',
        },
      ],
      fileId: FILE_ID,
      groupId: GROUP_ID,
      since: SINCE,
    })

    const multi = encoder.encode({
      messages: [
        {
          timestamp: TIMESTAMP,
          dataset: 'accounts',
          row: 'acc-001',
          column: 'name',
          value: 'S:Checking',
        },
        {
          timestamp: '2024-02-26T12:00:01.000Z-0000-abc123def4567890',
          dataset: 'accounts',
          row: 'acc-001',
          column: 'offbudget',
          value: 'N:0',
        },
      ],
      fileId: FILE_ID,
      groupId: GROUP_ID,
      since: SINCE,
    })

    expect(multi.length).toBeGreaterThan(single.length)
  })

  it('includes keyId field when provided', () => {
    const encoder = new SyncEncoder()

    const withKey = encoder.encode({
      messages: [],
      fileId: FILE_ID,
      groupId: GROUP_ID,
      keyId: 'key-123',
      since: SINCE,
    })

    const withoutKey = encoder.encode({
      messages: [],
      fileId: FILE_ID,
      groupId: GROUP_ID,
      since: SINCE,
    })

    expect(withKey.length).toBeGreaterThan(withoutKey.length)
  })
})
