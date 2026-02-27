import { Clock } from '@infrastructure/sync/crdt/Clock'
import { MerkleTree } from '@infrastructure/sync/crdt/MerkleTree'
import { Timestamp } from '@domain/value-objects'
import type { SyncRepository, StoredMessage } from '@infrastructure/sync/repositories/SQLiteSyncRepository'
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

    // Compute initial since once before the loop
    let since = clock.getMerkle().hash === 0
      ? '1970-01-01T00:00:00.000Z-0000-0000000000000000'
      : clock.getTimestamp().toString()

    let lastLocalMessages: StoredMessage[] = []

    while (!converged && iterations < maxIterations) {
      iterations++
      const prevMerkle = clock.getMerkle()

      // 2. Get local messages since last sync
      const localMessages = await this.syncRepo.getMessages(since)
      lastLocalMessages = localMessages
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

      // 6. Process only NEW remote messages
      const newMessages: typeof remoteMessages = []
      for (const msg of remoteMessages) {
        const exists = await this.syncRepo.hasMessage(msg.timestamp)
        if (!exists) {
          newMessages.push(msg)
        }
      }

      messagesReceivedCount += newMessages.length

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

        // Update clock timestamp with new messages (no longer building own Merkle)
        for (const msg of newMessages) {
          const ts = Timestamp.parse(msg.timestamp)
          if (ts) {
            clock.recv(ts)
          }
        }
      }

      // Adopt server's Merkle (we don't generate local CRDT messages)
      clock.setMerkle(remoteMerkle)

      // 8. Check merkle diff for convergence
      const diff = MerkleTree.diff(prevMerkle, remoteMerkle)
      if (diff === null) {
        converged = true
      } else {
        // Advance since to divergence time for next iteration.
        // newMessages may be 0 here if server absorbed our local messages and
        // its Merkle changed — iter 2 will re-send them and confirm convergence.
        since = Timestamp.create(diff, 0, '0000000000000000').toString()
      }
    }

    // 9. Advance clock past all locally-generated messages that were just confirmed
    // as sent. This prevents future syncs from re-sending them unnecessarily.
    for (const msg of lastLocalMessages) {
      const ts = Timestamp.parse(msg.timestamp)
      if (ts) clock.recv(ts)
    }

    // 10. Save clock state
    await this.syncRepo.saveClock(clock.getState())

    return {
      messagesReceived: messagesReceivedCount,
      messagesSent: messagesSentCount,
      success: converged,
    }
  }
}
