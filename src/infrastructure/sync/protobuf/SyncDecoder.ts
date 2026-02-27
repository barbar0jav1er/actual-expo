import {
  decodeMessage,
  decodeMessageEnvelope,
  decodeSyncResponse,
  type ProtoMessage,
  type ProtoMessageEnvelope,
} from './generated/sync'
import type { TrieNode } from '../crdt/MerkleTree'

export interface DecodedMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string
  isEncrypted: boolean
}

export interface DecodedSyncResponse {
  messages: DecodedMessage[]
  merkle: TrieNode
}

export class SyncDecoder {
  decode(buffer: Uint8Array): DecodedSyncResponse {
    const response = decodeSyncResponse(buffer)

    const messages: DecodedMessage[] = response.messages.map(
      (envelope: ProtoMessageEnvelope) => {
        let content: ProtoMessage = {
          dataset: '',
          row: '',
          column: '',
          value: '',
        }

        if (!envelope.isEncrypted && envelope.content.length > 0) {
          content = decodeMessage(envelope.content)
        }

        return {
          timestamp: envelope.timestamp,
          dataset: content.dataset,
          row: content.row,
          column: content.column,
          value: content.value,
          isEncrypted: envelope.isEncrypted,
        }
      }
    )

    const merkle: TrieNode =
      response.merkle ? (JSON.parse(response.merkle) as TrieNode) : { hash: 0 }

    return { messages, merkle }
  }

  decodeEnvelope(buffer: Uint8Array): ProtoMessageEnvelope {
    return decodeMessageEnvelope(buffer)
  }
}
