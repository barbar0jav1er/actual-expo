import {
  getClock,
  setClock,
  makeClock,
  makeClientId,
  Timestamp,
} from '@loot-core/crdt/timestamp'
import { merkle } from '@loot-core/crdt'
import { Timestamp as DomainTimestamp } from '@domain/value-objects'
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
    private readonly groupId: string,
  ) {}

  async execute(): Promise<FullSyncOutput> {
    // 1. Load or initialize the loot-core global clock
    const storedClock = await this.syncRepo.getClock()
    if (storedClock) {
      setClock(
        makeClock(
          new Timestamp(
            storedClock.timestamp.getMillis(),
            storedClock.timestamp.getCounter(),
            storedClock.node,
          ),
          storedClock.merkle,
        ),
      )
    } else {
      const node = makeClientId()
      setClock(makeClock(new Timestamp(0, 0, node)))
    }

    let messagesReceivedCount = 0
    let messagesSentCount = 0
    let converged = false
    let iterations = 0
    const maxIterations = 50

    // Compute initial since
    let since =
      getClock().merkle.hash === 0
        ? Timestamp.zero.toString()
        : getClock().timestamp.toString()

    let lastLocalMessages: StoredMessage[] = []

    while (!converged && iterations < maxIterations) {
      iterations++
      const prevMerkle = getClock().merkle

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

      // 6. Filter only NEW remote messages
      const newMessages: typeof remoteMessages = []
      for (const msg of remoteMessages) {
        const exists = await this.syncRepo.hasMessage(msg.timestamp)
        if (!exists) {
          newMessages.push(msg)
        }
      }

      messagesReceivedCount += newMessages.length

      if (newMessages.length > 0) {
        // Apply changes to SQLite directly
        // If this throws, messages are NOT saved so next sync will retry them
        await this.applyRemoteChanges.execute({ messages: newMessages })

        // Only mark as seen after successful apply
        await this.syncRepo.saveMessages(
          newMessages.map(m => ({
            timestamp: m.timestamp,
            dataset: m.dataset,
            row: m.row,
            column: m.column,
            value: m.value,
          })),
        )

        // Advance loot-core clock with received timestamps
        for (const msg of newMessages) {
          const ts = Timestamp.parse(msg.timestamp)
          if (ts) Timestamp.recv(ts)
        }
      }

      // 7. Adopt server's Merkle tree
      setClock({ ...getClock(), merkle: remoteMerkle })

      // 8. Check merkle diff for convergence
      const diff = merkle.diff(prevMerkle, remoteMerkle)
      if (diff === null) {
        converged = true
      } else {
        // Advance since to divergence time for next iteration
        since = new Timestamp(diff, 0, '0000000000000000').toString()
      }
    }

    // 9. Advance clock past locally-confirmed sent messages
    for (const msg of lastLocalMessages) {
      const ts = Timestamp.parse(msg.timestamp)
      if (ts) Timestamp.recv(ts)
    }

    // 10. Save clock state (convert loot-core Clock back to ClockState for repository)
    const lootClock = getClock()
    const node = lootClock.timestamp.node()
    const domainTs = DomainTimestamp.create(
      lootClock.timestamp.millis(),
      lootClock.timestamp.counter(),
      node,
    )
    await this.syncRepo.saveClock({
      timestamp: domainTs,
      merkle: lootClock.merkle,
      node,
    })

    return {
      messagesReceived: messagesReceivedCount,
      messagesSent: messagesSentCount,
      success: converged,
    }
  }
}
