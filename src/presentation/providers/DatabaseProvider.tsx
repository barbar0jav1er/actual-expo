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
import { initializeAccountsStore, initializeTransactionsStore } from '../stores'
import { LoadingScreen } from '../components/common'

interface DatabaseProviderProps {
  children: React.ReactNode
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initialize() {
      try {
        const db = createDatabase()
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

        // Suppress unused variable warnings — repos available for future use
        void categoryGroupRepo
        void budgetRepo

        setIsReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Database initialization failed')
      }
    }

    initialize()
  }, [])

  if (error) {
    return <LoadingScreen message={`Error: ${error}`} />
  }

  if (!isReady) {
    return <LoadingScreen message="Initializing..." />
  }

  return <>{children}</>
}
