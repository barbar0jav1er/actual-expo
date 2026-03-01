import {
  decodeEncryptedData,
  decodeMessage,
  decodeMessageEnvelope,
  decodeSyncResponse,
  type ProtoEncryptedData,
  type ProtoMessage,
  type ProtoMessageEnvelope,
} from './generated/sync'
import type { TrieNode } from '@loot-core/crdt/merkle'

export interface DecodedMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string
  isEncrypted: boolean
  /** Raw EncryptedData when isEncrypted = true (iv, authTag, data as bytes) */
  encryptedData?: ProtoEncryptedData
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
        if (envelope.isEncrypted) {
          // Content is a serialized EncryptedData protobuf message
          const encryptedData = decodeEncryptedData(envelope.content)
          return {
            timestamp: envelope.timestamp,
            dataset: '',
            row: '',
            column: '',
            value: '',
            isEncrypted: true,
            encryptedData,
          }
        }

        let content: ProtoMessage = { dataset: '', row: '', column: '', value: '' }
        if (envelope.content.length > 0) {
          content = decodeMessage(envelope.content)
        }

        return {
          timestamp: envelope.timestamp,
          dataset: content.dataset,
          row: content.row,
          column: content.column,
          value: content.value,
          isEncrypted: false,
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
