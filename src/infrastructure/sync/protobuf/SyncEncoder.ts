import {
  encodeEncryptedData,
  encodeMessage,
  encodeSyncRequest,
  type ProtoSyncRequest,
} from './generated/sync'

export interface SyncMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string
  isEncrypted?: boolean
  /** Pre-encrypted content (iv + authTag + data as raw bytes) */
  encryptedData?: {
    iv: Uint8Array
    authTag: Uint8Array
    data: Uint8Array
  }
}

export interface SyncEncodeParams {
  messages: SyncMessage[]
  fileId: string
  groupId: string
  keyId?: string
  since: string
}

export class SyncEncoder {
  encode(params: SyncEncodeParams): Uint8Array {
    const request: ProtoSyncRequest = {
      fileId: params.fileId,
      groupId: params.groupId,
      keyId: params.keyId,
      since: params.since,
      messages: params.messages.map(msg => ({
        timestamp: msg.timestamp,
        isEncrypted: msg.isEncrypted ?? false,
        content: msg.isEncrypted && msg.encryptedData
          ? encodeEncryptedData(msg.encryptedData)
          : encodeMessage({
              dataset: msg.dataset,
              row: msg.row,
              column: msg.column,
              value: msg.value,
            }),
      })),
    }

    return encodeSyncRequest(request)
  }
}
