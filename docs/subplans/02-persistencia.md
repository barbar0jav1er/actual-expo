# Subplan 2: Persistencia (Infrastructure - SQLite + Drizzle ORM)

## Estado: ✅ IMPLEMENTADO

### Archivos creados
- `drizzle.config.ts` — configuracion drizzle-kit
- `drizzle/0000_*.sql` + `_journal.json` + `migrations.js` — auto-generados por `npx drizzle-kit generate`
- `src/infrastructure/persistence/sqlite/schema.ts` — todas las tablas (accounts, categories, payees, transactions, messages_crdt, messages_clock, categoryMapping, payeeMapping)
- `src/infrastructure/persistence/sqlite/database.ts` — factory para drizzle + expo-sqlite
- `src/infrastructure/persistence/sqlite/migrate.ts` — aplica migraciones en runtime
- `src/infrastructure/persistence/sqlite/mappers/` — AccountMapper, TransactionMapper, CategoryMapper, CategoryGroupMapper, PayeeMapper + index.ts
- `src/infrastructure/persistence/sqlite/repositories/` — DrizzleAccountRepository, DrizzleTransactionRepository, DrizzleCategoryRepository, DrizzleCategoryGroupRepository, DrizzlePayeeRepository + tests + index.ts
- `src/infrastructure/persistence/sqlite/__tests__/createTestDb.ts` — helper de test con better-sqlite3

---

## Objetivo

Implementar la capa de persistencia usando **Drizzle ORM** sobre **expo-sqlite**, con repositorios que implementen los ports definidos en el Subplan 1. Drizzle provee type-safety end-to-end, un query builder ergonómico y generación automática de migraciones via `drizzle-kit`.

## Dependencias

- **Subplan 1:** Value Objects y Entidades del dominio
- **Runtime:** `drizzle-orm`, `expo-sqlite`
- **Dev:** `drizzle-kit`, `babel-plugin-inline-import`, `better-sqlite3` (para tests en Node)

## Decisión de diseño

Con Drizzle ORM el approach cambia respecto al plan original:

| Aspecto | Plan original (raw SQLite) | Nuevo (Drizzle ORM) |
|---------|---------------------------|---------------------|
| Conexión DB | Clase `SQLiteDatabase` wrapper | `drizzle(openDatabaseSync(...))` |
| Migraciones | Archivos TypeScript manuales | Generadas con `drizzle-kit generate` |
| Tipos de fila | Interfaces `AccountRow` manuales | `typeof schema.accounts.$inferSelect` |
| Queries | SQL strings con `?` params | Query builder type-safe |
| Transacciones | `db.transaction(fn)` expo-sqlite | `db.transaction(fn)` drizzle |
| Tests (Node) | No compatible con expo-sqlite | `better-sqlite3` + `drizzle-orm/better-sqlite3` |

## Archivos a Crear

```
actual-expo/
├── drizzle.config.ts                          # Config de drizzle-kit
├── drizzle/                                   # Generado por drizzle-kit generate
│   └── *.sql + meta/
└── src/
    └── infrastructure/
        └── persistence/
            └── sqlite/
                ├── schema.ts                  # Definiciones de tablas Drizzle
                ├── database.ts                # Factory: crea instancia drizzle
                ├── migrate.ts                 # Aplica migraciones en runtime (expo)
                ├── mappers/
                │   ├── AccountMapper.ts
                │   ├── TransactionMapper.ts
                │   ├── CategoryMapper.ts
                │   ├── CategoryGroupMapper.ts
                │   ├── PayeeMapper.ts
                │   └── index.ts
                ├── repositories/
                │   ├── DrizzleAccountRepository.ts
                │   ├── DrizzleAccountRepository.test.ts
                │   ├── DrizzleTransactionRepository.ts
                │   ├── DrizzleTransactionRepository.test.ts
                │   ├── DrizzleCategoryRepository.ts
                │   ├── DrizzleCategoryRepository.test.ts
                │   ├── DrizzleCategoryGroupRepository.ts
                │   ├── DrizzleCategoryGroupRepository.test.ts
                │   ├── DrizzlePayeeRepository.ts
                │   ├── DrizzlePayeeRepository.test.ts
                │   └── index.ts
                └── index.ts
```

---

## Configuración inicial

### Instalar dependencias

```bash
bun add drizzle-orm expo-sqlite
bun add -D drizzle-kit babel-plugin-inline-import better-sqlite3 @types/better-sqlite3
```

### metro.config.js

```js
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.resolver.sourceExts.push('sql')  // para bundlear archivos .sql

module.exports = config
```

### babel.config.js

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]], // bundlea .sql como string
  }
}
```

### drizzle.config.ts

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',               // driver especial para Expo (bundlea .sql)
  schema: './src/infrastructure/persistence/sqlite/schema.ts',
  out: './drizzle',
})
```

---

## Schema (Drizzle)

`src/infrastructure/persistence/sqlite/schema.ts`

```ts
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  offbudget:  integer('offbudget').notNull().default(0),
  closed:     integer('closed').notNull().default(0),
  sortOrder:  real('sort_order').default(0),
  tombstone:  integer('tombstone').notNull().default(0),
})

export const categoryGroups = sqliteTable('category_groups', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  isIncome:  integer('is_income').notNull().default(0),
  sortOrder: real('sort_order').default(0),
  hidden:    integer('hidden').notNull().default(0),
  tombstone: integer('tombstone').notNull().default(0),
})

export const categories = sqliteTable('categories', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  catGroup:  text('cat_group').notNull().references(() => categoryGroups.id),
  isIncome:  integer('is_income').notNull().default(0),
  sortOrder: real('sort_order').default(0),
  hidden:    integer('hidden').notNull().default(0),
  tombstone: integer('tombstone').notNull().default(0),
})

export const payees = sqliteTable('payees', {
  id:              text('id').primaryKey(),
  name:            text('name').notNull(),
  transferAcct:    text('transfer_acct').references(() => accounts.id),
  tombstone:       integer('tombstone').notNull().default(0),
})

export const transactions = sqliteTable('transactions', {
  id:          text('id').primaryKey(),
  acct:        text('acct').notNull().references(() => accounts.id),
  category:    text('category').references(() => categories.id),
  amount:      integer('amount').notNull(),
  description: text('description').references(() => payees.id), // payee_id
  notes:       text('notes'),
  date:        integer('date').notNull(),                        // YYYYMMDD
  cleared:     integer('cleared').notNull().default(1),
  reconciled:  integer('reconciled').notNull().default(0),
  tombstone:   integer('tombstone').notNull().default(0),
  isParent:    integer('is_parent').notNull().default(0),
  isChild:     integer('is_child').notNull().default(0),
  parentId:    text('parent_id'),
  sortOrder:   real('sort_order').default(0),
})

// Tablas de sincronización CRDT
export const messagesCrdt = sqliteTable('messages_crdt', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull().unique(),
  dataset:   text('dataset').notNull(),
  row:       text('row').notNull(),
  column:    text('column').notNull(),
  value:     text('value').notNull(),  // blob almacenado como text base64
})

export const messagesClock = sqliteTable('messages_clock', {
  id:    integer('id').primaryKey(),   // CHECK id = 1 via constraint manual
  clock: text('clock').notNull(),
})

export const categoryMapping = sqliteTable('category_mapping', {
  id:         text('id').primaryKey(),
  transferId: text('transfer_id'),
})

export const payeeMapping = sqliteTable('payee_mapping', {
  id:       text('id').primaryKey(),
  targetId: text('target_id'),
})
```

---

## Database factory

`src/infrastructure/persistence/sqlite/database.ts`

```ts
import { openDatabaseSync } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from './schema'

export type AppDatabase = ReturnType<typeof createDatabase>

export function createDatabase(name = 'actual.db') {
  const expo = openDatabaseSync(name, { enableChangeListener: true })
  return drizzle(expo, { schema })
}
```

---

## Migraciones en runtime

`src/infrastructure/persistence/sqlite/migrate.ts`

```ts
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import migrations from '../../../../drizzle/migrations'  // auto-generado por drizzle-kit
import type { AppDatabase } from './database'

export async function runMigrations(db: AppDatabase): Promise<void> {
  await migrate(db, migrations)
}
```

> **Nota:** Ejecutar `bunx drizzle-kit generate` para generar los archivos SQL en `drizzle/`.
> El archivo `drizzle/migrations.js` es importado directamente gracias al plugin `inline-import`.

---

## Tipo compartido para repositorios

Para soportar tanto expo-sqlite (runtime) como better-sqlite3 (tests), los repositorios aceptan el tipo genérico de Drizzle:

```ts
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

// Tipo compatible con drizzle-orm/expo-sqlite y drizzle-orm/better-sqlite3
export type DrizzleDB = BaseSQLiteDatabase<'async' | 'sync', any, typeof schema>
```

---

## Mappers

Con Drizzle, los tipos de fila se infieren del schema, eliminando las interfaces `*Row` manuales.

### AccountMapper

```ts
import type { accounts } from '../schema'
import { Account } from '@domain/entities/Account'
import { EntityId } from '@domain/value-objects/EntityId'

type AccountRow = typeof accounts.$inferSelect

export class AccountMapper {
  static toDomain(row: AccountRow): Account {
    return Account.reconstitute({
      id:        EntityId.fromString(row.id),
      name:      row.name,
      offbudget: row.offbudget === 1,
      closed:    row.closed === 1,
      sortOrder: row.sortOrder ?? 0,
      tombstone: row.tombstone === 1,
    })
  }

  static toPersistence(account: Account): typeof accounts.$inferInsert {
    const props = account.toObject()
    return {
      id:        props.id.toString(),
      name:      props.name,
      offbudget: props.offbudget ? 1 : 0,
      closed:    props.closed ? 1 : 0,
      sortOrder: props.sortOrder,
      tombstone: props.tombstone ? 1 : 0,
    }
  }
}
```

### TransactionMapper

```ts
import type { transactions } from '../schema'
import { Transaction } from '@domain/entities/Transaction'
import { EntityId } from '@domain/value-objects/EntityId'
import { Money } from '@domain/value-objects/Money'
import { TransactionDate } from '@domain/value-objects/TransactionDate'

type TransactionRow = typeof transactions.$inferSelect

export class TransactionMapper {
  static toDomain(row: TransactionRow): Transaction {
    return Transaction.reconstitute({
      id:          EntityId.fromString(row.id),
      accountId:   EntityId.fromString(row.acct),
      categoryId:  row.category   ? EntityId.fromString(row.category)   : undefined,
      payeeId:     row.description ? EntityId.fromString(row.description) : undefined,
      amount:      Money.fromCents(row.amount),
      date:        TransactionDate.fromNumber(row.date),
      notes:       row.notes ?? undefined,
      cleared:     row.cleared === 1,
      reconciled:  row.reconciled === 1,
      tombstone:   row.tombstone === 1,
      isParent:    row.isParent === 1,
      isChild:     row.isChild === 1,
      parentId:    row.parentId ? EntityId.fromString(row.parentId) : undefined,
      sortOrder:   row.sortOrder ?? 0,
    })
  }

  static toPersistence(tx: Transaction): typeof transactions.$inferInsert {
    const props = tx.toObject()
    return {
      id:          props.id.toString(),
      acct:        props.accountId.toString(),
      category:    props.categoryId?.toString() ?? null,
      amount:      props.amount.toCents(),
      description: props.payeeId?.toString() ?? null,
      notes:       props.notes ?? null,
      date:        props.date.toNumber(),
      cleared:     props.cleared ? 1 : 0,
      reconciled:  props.reconciled ? 1 : 0,
      tombstone:   props.tombstone ? 1 : 0,
      isParent:    props.isParent ? 1 : 0,
      isChild:     props.isChild ? 1 : 0,
      parentId:    props.parentId?.toString() ?? null,
      sortOrder:   props.sortOrder,
    }
  }
}
```

> Los mappers de `Category`, `CategoryGroup` y `Payee` siguen el mismo patrón.

---

## Repositorios

### DrizzleAccountRepository

```ts
import { eq, and } from 'drizzle-orm'
import { accounts } from '../schema'
import { AccountMapper } from '../mappers/AccountMapper'
import type { AccountRepository } from '@domain/repositories/AccountRepository'
import type { Account } from '@domain/entities/Account'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { DrizzleDB } from '../types'

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: EntityId): Promise<Account | null> {
    const row = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id.toString()))
      .get()
    return row ? AccountMapper.toDomain(row) : null
  }

  async findAll(): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.tombstone, 0))
      .orderBy(accounts.sortOrder)
      .all()
    return rows.map(AccountMapper.toDomain)
  }

  async findActive(): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tombstone, 0), eq(accounts.closed, 0)))
      .orderBy(accounts.sortOrder)
      .all()
    return rows.map(AccountMapper.toDomain)
  }

  async save(account: Account): Promise<void> {
    const row = AccountMapper.toPersistence(account)
    await this.db
      .insert(accounts)
      .values(row)
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          name:      row.name,
          offbudget: row.offbudget,
          closed:    row.closed,
          sortOrder: row.sortOrder,
          tombstone: row.tombstone,
        },
      })
  }

  async delete(id: EntityId): Promise<void> {
    await this.db
      .update(accounts)
      .set({ tombstone: 1 })
      .where(eq(accounts.id, id.toString()))
  }
}
```

### DrizzleTransactionRepository

```ts
import { eq, and, gte, lte } from 'drizzle-orm'
import { transactions } from '../schema'
import { TransactionMapper } from '../mappers/TransactionMapper'
import type { TransactionRepository } from '@domain/repositories/TransactionRepository'
import type { Transaction } from '@domain/entities/Transaction'
import type { EntityId } from '@domain/value-objects/EntityId'
import type { TransactionDate } from '@domain/value-objects/TransactionDate'
import type { BudgetMonth } from '@domain/value-objects/BudgetMonth'
import type { DrizzleDB } from '../types'

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: EntityId): Promise<Transaction | null> {
    const row = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id.toString()))
      .get()
    return row ? TransactionMapper.toDomain(row) : null
  }

  async findByAccount(accountId: EntityId): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.acct, accountId.toString()), eq(transactions.tombstone, 0)))
      .orderBy(transactions.date, transactions.sortOrder)
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async findByDateRange(start: TransactionDate, end: TransactionDate): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, start.toNumber()),
          lte(transactions.date, end.toNumber()),
          eq(transactions.tombstone, 0),
        )
      )
      .orderBy(transactions.date)
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async findByMonth(month: BudgetMonth): Promise<Transaction[]> {
    const startDate = month.toNumber() * 100 + 1   // YYYYMM01
    const endDate   = month.toNumber() * 100 + 31  // YYYYMM31
    return this.findByDateRange(
      { toNumber: () => startDate } as any,
      { toNumber: () => endDate   } as any,
    )
  }

  async findChildren(parentId: EntityId): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.parentId, parentId.toString()), eq(transactions.tombstone, 0)))
      .all()
    return rows.map(TransactionMapper.toDomain)
  }

  async save(tx: Transaction): Promise<void> {
    const row = TransactionMapper.toPersistence(tx)
    await this.db
      .insert(transactions)
      .values(row)
      .onConflictDoUpdate({ target: transactions.id, set: row })
  }

  async saveMany(txs: Transaction[]): Promise<void> {
    await this.db.transaction(async (trx) => {
      for (const tx of txs) {
        const row = TransactionMapper.toPersistence(tx)
        await trx
          .insert(transactions)
          .values(row)
          .onConflictDoUpdate({ target: transactions.id, set: row })
      }
    })
  }

  async delete(id: EntityId): Promise<void> {
    await this.db
      .update(transactions)
      .set({ tombstone: 1 })
      .where(eq(transactions.id, id.toString()))
  }
}
```

> Los repositorios de `Category`, `CategoryGroup` y `Payee` siguen el mismo patrón.

---

## Tests

Los tests usan `better-sqlite3` + `drizzle-orm/better-sqlite3` para correr SQLite en Node sin necesidad de un emulador Expo. El schema es el mismo, lo que garantiza paridad.

### Setup compartido

```ts
// src/infrastructure/persistence/sqlite/test-helpers/createTestDb.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../schema'

export function createTestDb() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './drizzle' })
  return db
}
```

### DrizzleAccountRepository.test.ts

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '../test-helpers/createTestDb'
import { DrizzleAccountRepository } from './DrizzleAccountRepository'
import { Account } from '@domain/entities/Account'

describe('DrizzleAccountRepository', () => {
  let repo: DrizzleAccountRepository

  beforeEach(() => {
    const db = createTestDb()
    repo = new DrizzleAccountRepository(db)
  })

  it('saves and retrieves an account', async () => {
    const account = Account.create({ name: 'Checking' })

    await repo.save(account)
    const found = await repo.findById(account.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('Checking')
  })

  it('returns only active accounts', async () => {
    const active = Account.create({ name: 'Checking' })
    const closed = Account.create({ name: 'Savings' })
    closed.close()

    await repo.save(active)
    await repo.save(closed)

    const result = await repo.findActive()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Checking')
  })

  it('updates an existing account (upsert)', async () => {
    const account = Account.create({ name: 'Checking' })
    await repo.save(account)

    account.rename('Main Checking')
    await repo.save(account)

    const found = await repo.findById(account.id)
    expect(found!.name).toBe('Main Checking')
  })

  it('soft-deletes an account (tombstone)', async () => {
    const account = Account.create({ name: 'Checking' })
    await repo.save(account)

    await repo.delete(account.id)

    const all = await repo.findAll()
    expect(all).toHaveLength(0)
  })
})
```

---

## Verificación

### Comandos

```bash
# Generar migraciones (ejecutar tras cambios en schema.ts)
bunx drizzle-kit generate

# Correr tests de integración
bun run test

# Type check
bun run typecheck
```

### Criterios de Éxito

- [x] Schema Drizzle cubre todas las tablas del dominio (accounts, categories, payees, transactions, CRDT)
- [x] `drizzle-kit generate` genera migraciones sin errores
- [x] Migraciones se aplican correctamente en runtime (expo) y en tests (better-sqlite3)
- [x] Todos los repositorios implementan sus interfaces del dominio
- [x] Mappers convierten correctamente en ambas direcciones usando tipos inferidos del schema
- [x] Tests de integración pasan con SQLite en memoria (better-sqlite3)
- [x] Transacciones (`saveMany`) son atómicas
- [x] Soft deletes funcionan (tombstone = 1, excluidos en findAll/findActive)
- [x] Sin errores de TypeScript (`bun run typecheck`)
