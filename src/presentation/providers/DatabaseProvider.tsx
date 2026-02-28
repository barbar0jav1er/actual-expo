import React, { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { createDatabase } from '@infrastructure/persistence/sqlite/database'
import { runMigrations } from '@infrastructure/persistence/sqlite/migrate'
import {
  DrizzleAccountRepository,
  DrizzleTransactionRepository,
  DrizzleCategoryRepository,
  DrizzleCategoryGroupRepository,
  DrizzlePayeeRepository,
} from '@infrastructure/persistence/sqlite/repositories'
import { DrizzleBudgetRepository } from '@infrastructure/persistence/sqlite/repositories/DrizzleBudgetRepository'
import { SQLiteSyncRepository } from '@infrastructure/sync/repositories/SQLiteSyncRepository'
import { Clock } from '@infrastructure/sync/crdt/Clock'
import { CrdtSyncService } from '@application/services'
import { GetAccounts, CreateAccount } from '@application/use-cases/accounts'
import { GetTransactions, CreateTransaction } from '@application/use-cases/transactions'
import { FullSync, ApplyRemoteChanges } from '@application/use-cases/sync'
import { SyncEncoder } from '@infrastructure/sync/protobuf/SyncEncoder'
import { SyncDecoder } from '@infrastructure/sync/protobuf/SyncDecoder'
import { ActualServerClient } from '@infrastructure/api'
import { SecureTokenStorage } from '@infrastructure/storage'
import {
  initializeAccountsStore,
  initializeTransactionsStore,
  initializeSyncStore,
  setSyncRefreshCallback,
  useFileStore,
  useAccountsStore,
  useTransactionsStore,
  useSyncStore,
} from '../stores'
import { LoadingScreen } from '../components/common'

interface DatabaseProviderProps {
  children: React.ReactNode
}

const storage = new SecureTokenStorage()

async function refreshAllStores(): Promise<void> {
  await Promise.all([
    useAccountsStore.getState().fetchAccounts(),
    useTransactionsStore.getState().fetchTransactions(),
  ])
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeFileId = useFileStore(s => s.activeFileId)
  const activeGroupId = useFileStore(s => s.activeGroupId)

  useEffect(() => {
    if (!activeFileId) return

    async function initialize() {
      // Phase 1: Critical setup — DB, repos, stores
      // If this fails, show a blocking error screen
      let fullSync: FullSync | null = null

      try {
        const db = createDatabase(`${activeFileId}.db`)
        await runMigrations(db)

        const accountRepo = new DrizzleAccountRepository(db)
        const transactionRepo = new DrizzleTransactionRepository(db)
        const categoryRepo = new DrizzleCategoryRepository(db)
        const categoryGroupRepo = new DrizzleCategoryGroupRepository(db)
        const payeeRepo = new DrizzlePayeeRepository(db)
        const budgetRepo = new DrizzleBudgetRepository(db)

        const syncRepo = new SQLiteSyncRepository(db as any)

        // Bug 6 fix: load persisted clock so nodeId stays consistent across mounts
        const savedClockState = await syncRepo.getClock()
        const clock = savedClockState ? Clock.fromState(savedClockState) : Clock.initialize()
        const syncService = new CrdtSyncService(clock, syncRepo)

        const getAccounts = new GetAccounts(accountRepo, transactionRepo)
        const createAccount = new CreateAccount(accountRepo, transactionRepo, payeeRepo, syncService)
        const getTransactions = new GetTransactions(
          transactionRepo,
          accountRepo,
          categoryRepo,
          payeeRepo
        )
        const createTransaction = new CreateTransaction(
          transactionRepo,
          accountRepo,
          categoryRepo,
          payeeRepo,
          syncService
        )

        initializeAccountsStore(getAccounts, createAccount)
        initializeTransactionsStore(getTransactions, createTransaction)

        // Setup FullSync if server credentials are available
        const serverUrl = await storage.getServerUrl()
        const token = await storage.getToken()

        if (serverUrl && token) {
          const client = new ActualServerClient(serverUrl)
          client.setToken(token)

          // Bug 4 fix: resolve groupId from server if not cached locally
          let resolvedGroupId = activeGroupId
          if (!resolvedGroupId) {
            try {
              const info = await client.files.getFileInfo(activeFileId!)
              if (info?.groupId) {
                resolvedGroupId = info.groupId
                await storage.saveActiveGroupId(info.groupId)
                useFileStore.getState().setActiveGroupId(info.groupId)
              }
            } catch {
              // Can't resolve groupId — sync will be skipped
            }
          }

          if (resolvedGroupId) {
            const applyRemoteChanges = new ApplyRemoteChanges(
              accountRepo,
              transactionRepo,
              categoryRepo,
              categoryGroupRepo,
              payeeRepo
            )

            fullSync = new FullSync(
              syncRepo,
              client.sync,
              new SyncEncoder(),
              new SyncDecoder(),
              applyRemoteChanges,
              activeFileId!,
              resolvedGroupId
            )

            initializeSyncStore(fullSync)
            setSyncRefreshCallback(refreshAllStores)
          }
        }

        // Suppress unused variable warnings — repos available for future use
        void categoryGroupRepo
        void budgetRepo

        // Mark app as ready so the user sees the tabs immediately
        setIsReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Database initialization failed')
        return
      }

      // Phase 2: Sync (non-blocking) — failures show in Settings, never block the UI
      if (fullSync) {
        try {
          await fullSync.execute()
          // Bug 1 fix: refresh ALL stores after sync (not just accounts)
          await refreshAllStores()
          useSyncStore.setState({ lastSyncAt: new Date(), error: null })
        } catch (syncErr) {
          useSyncStore.getState().setError(
            syncErr instanceof Error ? syncErr.message : 'Sync failed'
          )
        }
      }
    }

    initialize()
  }, [activeFileId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isReady) return

    const SYNC_INTERVAL_MS = 5 * 60 * 1000

    const interval = setInterval(() => {
      void useSyncStore.getState().triggerSync()
    }, SYNC_INTERVAL_MS)

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void useSyncStore.getState().triggerSync()
      }
    })

    return () => {
      clearInterval(interval)
      subscription.remove()
    }
  }, [isReady])

  if (error) {
    return <LoadingScreen message={`Error: ${error}`} />
  }

  if (!isReady) {
    return <LoadingScreen message="Initializing database..." />
  }

  return <>{children}</>
}
