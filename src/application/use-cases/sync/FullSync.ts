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
    let messagesReceivedCount = 0
    let messagesSentCount = 0
    let converged = false
    let iterations = 0
    const maxIterations = 50

    while (!converged && iterations < maxIterations) {
      iterations++
      // If it's a new clock, we want to fetch all messages, so we use an early timestamp
      const since = clockState.merkle.hash === 0 
        ? '1970-01-01T00:00:00.000Z-0000-0000000000000000'
        : clock.getTimestamp().toString()

      // 2. Get local messages since last sync
      const localMessages = await this.syncRepo.getMessages(since)
      messagesSentCount += localMessages.length

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
      
      messagesReceivedCount += remoteMessages.length

      // 6. Process only NEW remote messages
      const newMessages: typeof remoteMessages = []
      for (const msg of remoteMessages) {
        const exists = await this.syncRepo.hasMessage(msg.timestamp)
        if (!exists) {
          newMessages.push(msg)
        }
      }

      if (newMessages.length > 0) {
        // Save them first so they are in the DB
        await this.syncRepo.saveMessages(
          newMessages.map(m => ({
            timestamp: m.timestamp,
            dataset: m.dataset,
            row: m.row,
            column: m.column,
            value: m.value,
          }))
        )

        // Apply changes to domain entities
        await this.applyRemoteChanges.execute({ messages: newMessages })

        // Update clock and Merkle only with these NEW messages
        for (const msg of newMessages) {
          const ts = Timestamp.parse(msg.timestamp)
          if (ts) {
            clock.recv(ts)
            clock.updateMerkle(ts)
          }
        }
      }

      // 8. Check merkle diff for divergence
      const diff = MerkleTree.diff(clock.getMerkle(), remoteMerkle)
      if (diff === null) {
        converged = true
      } else {
        if (remoteMessages.length === 0) {
          // No more messages but still divergent? Something is wrong with the implementation
          // or we have local messages the server doesn't have yet.
          console.warn('Merkle divergence detected but no messages returned at timestamp:', diff)
          break
        }
      }
    }

    // 9. Prune and save clock state
    clock.pruneMerkle()
    await this.syncRepo.saveClock(clock.getState())

    return {
      messagesReceived: messagesReceivedCount,
      messagesSent: messagesSentCount,
      success: converged,
    }
  }
}
