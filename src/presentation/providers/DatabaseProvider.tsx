import React, { useEffect, useState } from 'react'
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
  useFileStore,
  useAccountsStore,
} from '../stores'
import { LoadingScreen } from '../components/common'

interface DatabaseProviderProps {
  children: React.ReactNode
}

const storage = new SecureTokenStorage()

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeFileId = useFileStore(s => s.activeFileId)
  const activeGroupId = useFileStore(s => s.activeGroupId)

  useEffect(() => {
    if (!activeFileId) return

    async function initialize() {
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
        const clock = Clock.initialize()
        const syncService = new CrdtSyncService(clock, syncRepo)

        const getAccounts = new GetAccounts(accountRepo, transactionRepo)
        const createAccount = new CreateAccount(accountRepo, payeeRepo, syncService)
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

        // Setup FullSync
        const serverUrl = await storage.getServerUrl()
        const token = await storage.getToken()
        
        if (serverUrl && token && activeFileId && activeGroupId) {
          const client = new ActualServerClient(serverUrl)
          client.setToken(token)

          const applyRemoteChanges = new ApplyRemoteChanges(
            accountRepo,
            transactionRepo,
            categoryRepo,
            categoryGroupRepo,
            payeeRepo
          )

          const fullSync = new FullSync(
            syncRepo,
            client.sync,
            new SyncEncoder(),
            new SyncDecoder(),
            applyRemoteChanges,
            activeFileId,
            activeGroupId
          )

          initializeSyncStore(fullSync)

          // Trigger initial sync to fetch data
          await fullSync.execute()
          
          // Refresh accounts list after sync
          await useAccountsStore.getState().fetchAccounts()
        }

        // Suppress unused variable warnings — repos available for future use
        void categoryGroupRepo
        void budgetRepo

        setIsReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Database initialization failed')
      }
    }

    initialize()
  }, [activeFileId, activeGroupId])

  if (error) {
    return <LoadingScreen message={`Error: ${error}`} />
  }

  if (!isReady) {
    return <LoadingScreen message="Initializing database..." />
  }

  return <>{children}</>
}
