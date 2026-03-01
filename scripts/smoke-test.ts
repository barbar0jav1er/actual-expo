#!/usr/bin/env bun
/**
 * Smoke-test: integration test against the real Actual Budget server.
 *
 * Uses the actual application use-cases, repositories, and services.
 * BunDatabase wraps bun:sqlite so this runs in bun without React Native.
 *
 * Run: bun scripts/smoke-test.ts
 */

// ─── Bun DB setup ─────────────────────────────────────────────────────────────
import { Database } from 'bun:sqlite'
import type { AppDatabase } from '@infrastructure/persistence/sqlite/db'
import { runMigrations } from '@infrastructure/persistence/sqlite/migrate'

class BunDatabase implements AppDatabase {
  constructor(private readonly raw: Database) {}
  async first<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (this.raw.prepare(sql).get(...(params as any)) as T) ?? null
  }
  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...(params as any)) as T[]
  }
  async run(sql: string, params: unknown[] = []): Promise<void> {
    this.raw.prepare(sql).run(...(params as any))
  }
  async exec(sql: string): Promise<void> {
    this.raw.exec(sql)
  }
}

// ─── Platform adapter (inline — keeps bun:sqlite out of src/) ─────────────────
import type { RawSQLiteAdapter } from '@infrastructure/sync/RawSQLiteAdapter'

class BunSQLiteAdapter implements RawSQLiteAdapter {
  constructor(private readonly sqlite: Database) {}
  getFirstSync(sql: string, params: unknown[]): unknown {
    return (this.sqlite.prepare(sql).get(...(params as Parameters<typeof this.sqlite.prepare>)) as unknown) ?? null
  }
  runSync(sql: string, params: unknown[]): void {
    this.sqlite.prepare(sql).run(...(params as Parameters<typeof this.sqlite.prepare>))
  }
}

// ─── App imports ──────────────────────────────────────────────────────────────
import {
  setCryptoProvider,
  setClock,
  makeClock,
  makeClientId,
  Timestamp as LootCoreTimestamp,
} from '@loot-core/crdt/timestamp'
import { WebCryptoProvider } from '@platform/WebCryptoProvider'

// Repositories
import { SqliteAccountRepository }       from '@infrastructure/persistence/sqlite/repositories/SqliteAccountRepository'
import { SqliteTransactionRepository }   from '@infrastructure/persistence/sqlite/repositories/SqliteTransactionRepository'
import { SqliteCategoryRepository }      from '@infrastructure/persistence/sqlite/repositories/SqliteCategoryRepository'
import { SqliteCategoryGroupRepository } from '@infrastructure/persistence/sqlite/repositories/SqliteCategoryGroupRepository'
import { SqlitePayeeRepository }         from '@infrastructure/persistence/sqlite/repositories/SqlitePayeeRepository'
import { SqliteBudgetRepository }        from '@infrastructure/persistence/sqlite/repositories/SqliteBudgetRepository'
import { SQLiteSyncRepository }          from '@infrastructure/sync/repositories/SQLiteSyncRepository'

// Services
import { CrdtSyncService }          from '@application/services'
import { BudgetCalculationService } from '@application/services/BudgetCalculationService'

// Use-cases
import { GetAccounts }    from '@application/use-cases/accounts/GetAccounts'
import { CreateAccount }  from '@application/use-cases/accounts/CreateAccount'
import { GetTransactions }    from '@application/use-cases/transactions/GetTransactions'
import { CreateTransaction }  from '@application/use-cases/transactions/CreateTransaction'
import { GetCategories }        from '@application/use-cases/categories/GetCategories'
import { CreateCategory }       from '@application/use-cases/categories/CreateCategory'
import { CreateCategoryGroup }  from '@application/use-cases/categories/CreateCategoryGroup'
import { GetPayees }   from '@application/use-cases/payees/GetPayees'
import { CreatePayee } from '@application/use-cases/payees/CreatePayee'
import { GetBudgetSummary } from '@application/use-cases/budget/GetBudgetSummary'
import { SetBudgetAmount }  from '@application/use-cases/budget/SetBudgetAmount'

// Sync
import { ApplyRemoteChanges } from '@application/use-cases/sync/ApplyRemoteChanges'
import { FullSync }           from '@application/use-cases/sync/FullSync'
import { SyncEncoder }        from '@infrastructure/sync/protobuf/SyncEncoder'
import { SyncDecoder }        from '@infrastructure/sync/protobuf/SyncDecoder'

// API
import { ActualServerClient } from '@infrastructure/api/ActualServerClient'

// ─── Config ───────────────────────────────────────────────────────────────────
const SERVER   = 'http://localhost:5006'
const PASSWORD = 'test'
const TODAY    = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD
const MONTH    = TODAY.slice(0, 7)                        // YYYY-MM

// ─── Result tracking ──────────────────────────────────────────────────────────
type Result = { label: string; ok: boolean; detail: string }
const results: Result[] = []

function pass(label: string, detail = '') {
  results.push({ label, ok: true, detail })
  console.log(`  \x1b[32m✓\x1b[0m  [${label}] ${detail}`)
}

function fail(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  results.push({ label, ok: false, detail: msg })
  console.log(`  \x1b[31m✗\x1b[0m  [${label}] ${msg}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n\x1b[1mActual Budget — Smoke Test\x1b[0m')
  console.log(`Server: ${SERVER}  |  Date: ${TODAY}\n`)

  // ── Phase 0: Setup ──────────────────────────────────────────────────────────
  setCryptoProvider(new WebCryptoProvider())

  const sqlite = new Database(':memory:')
  const db: AppDatabase = new BunDatabase(sqlite)

  try {
    await runMigrations(db)
    pass('SETUP', 'in-memory SQLite migrated')
  } catch (err) {
    fail('SETUP', err)
    process.exit(1)
  }

  // ── Repos ───────────────────────────────────────────────────────────────────
  const accountRepo       = new SqliteAccountRepository(db)
  const transactionRepo   = new SqliteTransactionRepository(db)
  const categoryRepo      = new SqliteCategoryRepository(db)
  const categoryGroupRepo = new SqliteCategoryGroupRepository(db)
  const payeeRepo         = new SqlitePayeeRepository(db)
  const budgetRepo        = new SqliteBudgetRepository(db)
  const syncRepo          = new SQLiteSyncRepository(db)

  // ── Init loot-core global HLC clock ─────────────────────────────────────────
  setClock(makeClock(new LootCoreTimestamp(0, 0, makeClientId())))

  // ── Services ────────────────────────────────────────────────────────────────
  const syncService  = new CrdtSyncService(syncRepo)
  const calcService  = new BudgetCalculationService()

  // ── Use-Cases ───────────────────────────────────────────────────────────────
  const getAccounts   = new GetAccounts(accountRepo, transactionRepo)
  const createAccount = new CreateAccount(accountRepo, transactionRepo, payeeRepo, categoryRepo, syncService)

  const getTransactions   = new GetTransactions(transactionRepo, accountRepo, categoryRepo, payeeRepo)
  const createTransaction = new CreateTransaction(transactionRepo, accountRepo, categoryRepo, payeeRepo, syncService)

  const getCategories      = new GetCategories(categoryRepo, categoryGroupRepo)
  const createCategory     = new CreateCategory(categoryRepo, categoryGroupRepo, syncService)
  const createCategoryGroup = new CreateCategoryGroup(categoryGroupRepo, syncService)

  const getPayees   = new GetPayees(payeeRepo)
  const createPayee = new CreatePayee(payeeRepo, syncService)

  const getBudgetSummary = new GetBudgetSummary(budgetRepo, categoryRepo, categoryGroupRepo, transactionRepo, calcService)
  const setBudgetAmount  = new SetBudgetAmount(budgetRepo, syncService)

  // ── Phase 1: Auth ───────────────────────────────────────────────────────────
  console.log('\n\x1b[2mAutenticación\x1b[0m')
  const client = new ActualServerClient(SERVER)
  let token = ''

  try {
    token = await client.auth.login(PASSWORD)
    client.setToken(token)
    pass('AUTH:LOGIN', `token: ${token.slice(0, 8)}…`)
  } catch (err) { fail('AUTH:LOGIN', err) }

  if (token) {
    try {
      const info = await client.auth.validate()
      pass('AUTH:VALIDATE', `usuario: "${info.displayName ?? info.userName}"`)
    } catch (err) { fail('AUTH:VALIDATE', err) }
  }

  // ── Phase 2: Archivo ────────────────────────────────────────────────────────
  console.log('\n\x1b[2mArchivo\x1b[0m')
  let fileId  = ''
  let groupId = ''
  let fullSync: FullSync | null = null

  if (token) {
    try {
      const files  = await client.files.listFiles()
      const active = files.filter(f => !f.deleted)

      if (active.length === 0) {
        pass('FILES:LIST', '0 archivos — sync omitido')
      } else {
        const f = active[0]
        fileId  = f.fileId
        groupId = f.groupId ?? ''
        if (!groupId) {
          const info = await client.files.getFileInfo(fileId).catch(() => null)
          groupId = info?.groupId ?? ''
        }
        pass('FILES:LIST', `"${f.name}"  fileId: ${fileId.slice(0,8)}…  groupId: ${groupId ? groupId.slice(0,8)+'…' : 'null'}`)
      }
    } catch (err) { fail('FILES:LIST', err) }
  }

  if (token && fileId && groupId) {
    const bunAdapter = new BunSQLiteAdapter(sqlite)
    fullSync = new FullSync(
      syncRepo,
      client.sync,
      new SyncEncoder(),
      new SyncDecoder(),
      new ApplyRemoteChanges(bunAdapter),
      fileId,
      groupId,
    )
  }

  // ── Phase 3: SYNC:PULL ───────────────────────────────────────────────────────
  if (fullSync) {
    console.log('\n\x1b[2mSync inicial (pull)\x1b[0m')
    try {
      const result = await fullSync.execute()
      pass('SYNC:PULL', `recibidos ${result.messagesReceived} mensajes, convergido=${result.success}`)
    } catch (err) { fail('SYNC:PULL', err) }
  }

  // ── Phase 4: Cuenta de Prueba ────────────────────────────────────────────────
  console.log('\n\x1b[2mCuenta\x1b[0m')
  let accountId = ''

  try {
    const result = await createAccount.execute({ name: 'Cuenta de Prueba', initialBalance: 100_000 })
    accountId = result.account.id

    const { accounts } = await getAccounts.execute()
    const found = accounts.find(a => a.id === accountId)
    if (found?.name === 'Cuenta de Prueba') {
      pass('ACCT:CREATE', `"${found.name}"  balance=$${(result.balance / 100).toFixed(2)}`)
    } else {
      fail('ACCT:CREATE', new Error(`cuenta no encontrada después de crear (name=${found?.name})`))
    }
  } catch (err) { fail('ACCT:CREATE', err) }

  // ── Phase 5: Categorías ──────────────────────────────────────────────────────
  console.log('\n\x1b[2mCategorías\x1b[0m')
  let categoryId = ''

  try {
    const groupResult = await createCategoryGroup.execute({ name: 'prueba', isIncome: false })
    pass('CAT:GROUP', `grupo "prueba" creado`)

    const catResult = await createCategory.execute({
      name: 'Gastos',
      groupId: groupResult.group.id,
      isIncome: false,
    })
    categoryId = catResult.category.id

    const { groups } = await getCategories.execute()
    const found = groups.flatMap(g => g.categories).find(c => c.id === categoryId)
    if (found) {
      pass('CAT:CREATE', `categoría "${found.name}" en grupo "${found.groupName}"`)
    } else {
      fail('CAT:CREATE', new Error('categoría no encontrada después de crear'))
    }
  } catch (err) {
    fail('CAT:GROUP', err)
    fail('CAT:CREATE', err)
  }

  // ── Phase 6: Transacción ──────────────────────────────────────────────────────
  console.log('\n\x1b[2mTransacción\x1b[0m')
  let txId = ''

  if (accountId) {
    try {
      const result = await createTransaction.execute({
        accountId,
        amount: -2_300,
        date: TODAY,
        categoryId: categoryId || undefined,
        notes: 'nota de prueba',
      })
      txId = result.transaction.id

      const { transactions } = await getTransactions.execute({})
      const found = transactions.find(t => t.id === txId)
      if (
        found &&
        found.amount === -2_300 &&
        found.notes === 'nota de prueba' &&
        found.categoryName === 'Gastos'
      ) {
        pass('TX:CREATE', `$${(found.amount / 100).toFixed(2)}  categoría="${found.categoryName}"  nota="${found.notes}"`)
      } else {
        fail('TX:CREATE', new Error(
          `amount=${found?.amount}, categoryName="${found?.categoryName}", notes="${found?.notes}"`
        ))
      }
    } catch (err) { fail('TX:CREATE', err) }

    try {
      const { accounts } = await getAccounts.execute()
      const acct = accounts.find(a => a.id === accountId)
      const expectedBalance = 100_000 - 2_300
      if (acct?.balance === expectedBalance) {
        pass('ACCT:BALANCE', `balance=$${(acct.balance / 100).toFixed(2)} ✓ (1000.00 − 23.00)`)
      } else {
        fail('ACCT:BALANCE', new Error(`balance=${acct?.balance} (esperado ${expectedBalance})`))
      }
    } catch (err) { fail('ACCT:BALANCE', err) }
  }

  // ── Phase 7: SYNC:PUSH ────────────────────────────────────────────────────────
  if (fullSync) {
    console.log('\n\x1b[2mSync final (push)\x1b[0m')
    try {
      const result = await fullSync.execute()
      if (result.success) {
        pass('SYNC:PUSH', `enviados ${result.messagesSent} mensajes, recibidos ${result.messagesReceived}`)
      } else {
        fail('SYNC:PUSH', new Error('sync no convergió'))
      }
    } catch (err) { fail('SYNC:PUSH', err) }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  console.log('\n' + '─'.repeat(52))
  if (failed === 0) {
    console.log(`\x1b[32m\x1b[1mAll ${passed} checks passed ✓\x1b[0m\n`)
  } else {
    console.log(`\x1b[32m${passed} passed\x1b[0m  \x1b[31m${failed} failed ✗\x1b[0m\n`)
    console.log('Failed:')
    results.filter(r => !r.ok).forEach(r => console.log(`  ✗ [${r.label}] ${r.detail}`))
    console.log()
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n\x1b[31mError no manejado:\x1b[0m', err)
  process.exit(1)
})
