import { Clock } from '@infrastructure/sync/crdt/Clock'
import { MerkleTree } from '@infrastructure/sync/crdt/MerkleTree'
import { Timestamp } from '@domain/value-objects'
import type { SyncRepository } from '@infrastructure/sync/repositories/SQLiteSyncRepository'
import type { SyncEndpoints } from '@infrastructure/api/endpoints/SyncEndpoints'
import type { SyncEncoder } from '@infrastructure/sync/protobuf/SyncEncoder'
import type { SyncDecoder } from '@infrastructure/sync/protobuf/SyncDecoder'
import type { ApplyRemoteChanges } from './ApplyRemoteChanges'

export interface FullSyncOutput {
  messagesReceived: number
  messagesSent: number
  success: boolean
}

export class FullSync {
  constructor(
    private readonly syncRepo: SyncRepository,
    private readonly syncEndpoints: SyncEndpoints,
    private readonly syncEncoder: SyncEncoder,
    private readonly syncDecoder: SyncDecoder,
    private readonly applyRemoteChanges: ApplyRemoteChanges,
    private readonly fileId: string,
    private readonly groupId: string
  ) {}

  async execute(): Promise<FullSyncOutput> {
    // 1. Get or initialize clock
    let clockState = await this.syncRepo.getClock()
    if (!clockState) {
      const newClock = Clock.initialize()
      clockState = newClock.getState()
      await this.syncRepo.saveClock(clockState)
    }

    const clock = Clock.fromState(clockState)
    const since = clock.getTimestamp().toString()

    // 2. Get local messages since last sync
    const localMessages = await this.syncRepo.getMessages(since)

    // 3. Encode request
    const requestBuffer = this.syncEncoder.encode({
      messages: localMessages,
      fileId: this.fileId,
      groupId: this.groupId,
      since,
    })

    // 4. Send to server
    const responseBuffer = await this.syncEndpoints.sync(requestBuffer)

    // 5. Decode response
    const { messages: remoteMessages, merkle: remoteMerkle } =
      this.syncDecoder.decode(responseBuffer)

    // 6. Save remote messages locally and apply them
    if (remoteMessages.length > 0) {
      await this.syncRepo.saveMessages(
        remoteMessages.map(m => ({
          timestamp: m.timestamp,
          dataset: m.dataset,
          row: m.row,
          column: m.column,
          value: m.value,
        }))
      )

      await this.applyRemoteChanges.execute({ messages: remoteMessages })
    }

    // 7. Update clock with remote timestamps
    for (const msg of remoteMessages) {
      const ts = Timestamp.parse(msg.timestamp)
      if (ts) {
        clock.recv(ts)
        clock.updateMerkle(ts)
      }
    }

    // 8. Check merkle diff for divergence
    const diff = MerkleTree.diff(clock.getMerkle(), remoteMerkle)
    if (diff !== null) {
      console.warn('Merkle divergence detected at timestamp:', diff)
    }

    // 9. Prune and save clock state
    clock.pruneMerkle()
    await this.syncRepo.saveClock(clock.getState())

    return {
      messagesReceived: remoteMessages.length,
      messagesSent: localMessages.length,
      success: diff === null,
    }
  }
}
