# Subplan 2: Persistencia (Infrastructure - SQLite)

## Objetivo

Implementar la capa de persistencia usando expo-sqlite, con repositorios que implementen los ports definidos en el Subplan 1.

## Dependencias

- **Subplan 1:** Value Objects y Entidades del dominio

## Archivos a Crear

```
src/
└── infrastructure/
    └── persistence/
        └── sqlite/
            ├── SQLiteDatabase.ts
            ├── SQLiteDatabase.test.ts
            ├── migrations/
            │   ├── index.ts
            │   ├── 001_initial_schema.ts
            │   ├── 002_sync_tables.ts
            │   └── types.ts
            ├── repositories/
            │   ├── SQLiteAccountRepository.ts
            │   ├── SQLiteAccountRepository.test.ts
            │   ├── SQLiteTransactionRepository.ts
            │   ├── SQLiteTransactionRepository.test.ts
            │   ├── SQLiteCategoryRepository.ts
            │   ├── SQLiteCategoryRepository.test.ts
            │   ├── SQLiteCategoryGroupRepository.ts
            │   ├── SQLiteCategoryGroupRepository.test.ts
            │   ├── SQLitePayeeRepository.ts
            │   ├── SQLitePayeeRepository.test.ts
            │   └── index.ts
            ├── mappers/
            │   ├── AccountMapper.ts
            │   ├── AccountMapper.test.ts
            │   ├── TransactionMapper.ts
            │   ├── CategoryMapper.ts
            │   ├── PayeeMapper.ts
            │   └── index.ts
            └── index.ts
```

---

## SQLiteDatabase

Wrapper para expo-sqlite con helpers.

```typescript
import * as SQLite from 'expo-sqlite'

class SQLiteDatabase {
  private db: SQLite.SQLiteDatabase | null = null

  async open(name: string): Promise<void>
  async close(): Promise<void>

  async runMigrations(): Promise<void>

  async run(sql: string, params?: unknown[]): Promise<SQLite.SQLiteRunResult>
  async get<T>(sql: string, params?: unknown[]): Promise<T | null>
  async all<T>(sql: string, params?: unknown[]): Promise<T[]>

  async transaction<T>(fn: () => Promise<T>): Promise<T>

  isOpen(): boolean
}
```

---

## Migraciones

### Estructura

```typescript
// migrations/types.ts
interface Migration {
  version: number
  name: string
  up: (db: SQLiteDatabase) => Promise<void>
  down: (db: SQLiteDatabase) => Promise<void>
}

// migrations/index.ts
const migrations: Migration[] = [
  migration001,
  migration002,
  // ...
]

async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Crear tabla de migraciones si no existe
  // Ejecutar migraciones pendientes en orden
}
```

### 001_initial_schema.ts

```sql
-- Accounts
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  offbudget INTEGER DEFAULT 0,
  closed INTEGER DEFAULT 0,
  sort_order REAL DEFAULT 0,
  tombstone INTEGER DEFAULT 0
);

-- Category Groups
CREATE TABLE category_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_income INTEGER DEFAULT 0,
  sort_order REAL DEFAULT 0,
  hidden INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0
);

-- Categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cat_group TEXT NOT NULL,
  is_income INTEGER DEFAULT 0,
  sort_order REAL DEFAULT 0,
  hidden INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0,
  FOREIGN KEY (cat_group) REFERENCES category_groups(id)
);

-- Payees
CREATE TABLE payees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  transfer_acct TEXT,
  tombstone INTEGER DEFAULT 0,
  FOREIGN KEY (transfer_acct) REFERENCES accounts(id)
);

-- Transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  acct TEXT NOT NULL,
  category TEXT,
  amount INTEGER NOT NULL,
  description TEXT,
  notes TEXT,
  date INTEGER NOT NULL,
  cleared INTEGER DEFAULT 1,
  reconciled INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0,
  is_parent INTEGER DEFAULT 0,
  is_child INTEGER DEFAULT 0,
  parent_id TEXT,
  sort_order REAL DEFAULT 0,
  FOREIGN KEY (acct) REFERENCES accounts(id),
  FOREIGN KEY (category) REFERENCES categories(id),
  FOREIGN KEY (description) REFERENCES payees(id),
  FOREIGN KEY (parent_id) REFERENCES transactions(id)
);

-- Indices
CREATE INDEX idx_transactions_acct ON transactions(acct);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_parent ON transactions(parent_id);
CREATE INDEX idx_categories_group ON categories(cat_group);
```

### 002_sync_tables.ts

```sql
-- CRDT Messages
CREATE TABLE messages_crdt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL UNIQUE,
  dataset TEXT NOT NULL,
  row TEXT NOT NULL,
  column TEXT NOT NULL,
  value BLOB NOT NULL
);

CREATE INDEX idx_messages_timestamp ON messages_crdt(timestamp);
CREATE INDEX idx_messages_search ON messages_crdt(dataset, row, column);

-- Clock state
CREATE TABLE messages_clock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  clock TEXT NOT NULL
);

-- Category mapping (para IDs cambiados)
CREATE TABLE category_mapping (
  id TEXT PRIMARY KEY,
  transfer_id TEXT
);

-- Payee mapping
CREATE TABLE payee_mapping (
  id TEXT PRIMARY KEY,
  target_id TEXT
);
```

---

## Mappers

### AccountMapper

```typescript
interface AccountRow {
  id: string
  name: string
  offbudget: number  // 0 o 1
  closed: number
  sort_order: number | null
  tombstone: number
}

class AccountMapper {
  static toDomain(row: AccountRow): Account {
    return Account.reconstitute({
      id: EntityId.fromString(row.id),
      name: row.name,
      offbudget: row.offbudget === 1,
      closed: row.closed === 1,
      sortOrder: row.sort_order ?? 0,
      tombstone: row.tombstone === 1
    })
  }

  static toPersistence(account: Account): AccountRow {
    const props = account.toObject()
    return {
      id: props.id.toString(),
      name: props.name,
      offbudget: props.offbudget ? 1 : 0,
      closed: props.closed ? 1 : 0,
      sort_order: props.sortOrder,
      tombstone: props.tombstone ? 1 : 0
    }
  }
}
```

### TransactionMapper

```typescript
interface TransactionRow {
  id: string
  acct: string
  category: string | null
  amount: number
  description: string | null  // payee_id
  notes: string | null
  date: number  // YYYYMMDD
  cleared: number
  reconciled: number
  tombstone: number
  is_parent: number
  is_child: number
  parent_id: string | null
  sort_order: number | null
}

class TransactionMapper {
  static toDomain(row: TransactionRow): Transaction {
    return Transaction.reconstitute({
      id: EntityId.fromString(row.id),
      accountId: EntityId.fromString(row.acct),
      categoryId: row.category ? EntityId.fromString(row.category) : undefined,
      payeeId: row.description ? EntityId.fromString(row.description) : undefined,
      amount: Money.fromCents(row.amount),
      date: TransactionDate.fromNumber(row.date),
      notes: row.notes ?? undefined,
      cleared: row.cleared === 1,
      reconciled: row.reconciled === 1,
      tombstone: row.tombstone === 1,
      isParent: row.is_parent === 1,
      isChild: row.is_child === 1,
      parentId: row.parent_id ? EntityId.fromString(row.parent_id) : undefined,
      sortOrder: row.sort_order ?? 0
    })
  }

  static toPersistence(tx: Transaction): TransactionRow {
    const props = tx.toObject()
    return {
      id: props.id.toString(),
      acct: props.accountId.toString(),
      category: props.categoryId?.toString() ?? null,
      amount: props.amount.toCents(),
      description: props.payeeId?.toString() ?? null,
      notes: props.notes ?? null,
      date: props.date.toNumber(),
      cleared: props.cleared ? 1 : 0,
      reconciled: props.reconciled ? 1 : 0,
      tombstone: props.tombstone ? 1 : 0,
      is_parent: props.isParent ? 1 : 0,
      is_child: props.isChild ? 1 : 0,
      parent_id: props.parentId?.toString() ?? null,
      sort_order: props.sortOrder
    }
  }
}
```

---

## Repositories

### SQLiteAccountRepository

```typescript
class SQLiteAccountRepository implements IAccountRepository {
  constructor(private db: SQLiteDatabase) {}

  async findById(id: EntityId): Promise<Account | null> {
    const row = await this.db.get<AccountRow>(
      'SELECT * FROM accounts WHERE id = ?',
      [id.toString()]
    )
    return row ? AccountMapper.toDomain(row) : null
  }

  async findAll(): Promise<Account[]> {
    const rows = await this.db.all<AccountRow>(
      'SELECT * FROM accounts WHERE tombstone = 0 ORDER BY sort_order'
    )
    return rows.map(AccountMapper.toDomain)
  }

  async findActive(): Promise<Account[]> {
    const rows = await this.db.all<AccountRow>(
      'SELECT * FROM accounts WHERE tombstone = 0 AND closed = 0 ORDER BY sort_order'
    )
    return rows.map(AccountMapper.toDomain)
  }

  async save(account: Account): Promise<void> {
    const row = AccountMapper.toPersistence(account)
    await this.db.run(
      `INSERT INTO accounts (id, name, offbudget, closed, sort_order, tombstone)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         offbudget = excluded.offbudget,
         closed = excluded.closed,
         sort_order = excluded.sort_order,
         tombstone = excluded.tombstone`,
      [row.id, row.name, row.offbudget, row.closed, row.sort_order, row.tombstone]
    )
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'UPDATE accounts SET tombstone = 1 WHERE id = ?',
      [id.toString()]
    )
  }
}
```

### SQLiteTransactionRepository

```typescript
class SQLiteTransactionRepository implements ITransactionRepository {
  constructor(private db: SQLiteDatabase) {}

  async findById(id: EntityId): Promise<Transaction | null> {
    const row = await this.db.get<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ?',
      [id.toString()]
    )
    return row ? TransactionMapper.toDomain(row) : null
  }

  async findByAccount(accountId: EntityId): Promise<Transaction[]> {
    const rows = await this.db.all<TransactionRow>(
      `SELECT * FROM transactions
       WHERE acct = ? AND tombstone = 0
       ORDER BY date DESC, sort_order`,
      [accountId.toString()]
    )
    return rows.map(TransactionMapper.toDomain)
  }

  async findByDateRange(
    start: TransactionDate,
    end: TransactionDate
  ): Promise<Transaction[]> {
    const rows = await this.db.all<TransactionRow>(
      `SELECT * FROM transactions
       WHERE date >= ? AND date <= ? AND tombstone = 0
       ORDER BY date DESC`,
      [start.toNumber(), end.toNumber()]
    )
    return rows.map(TransactionMapper.toDomain)
  }

  async findByMonth(month: BudgetMonth): Promise<Transaction[]> {
    const startDate = month.toNumber() * 100 + 1  // YYYYMM01
    const endDate = month.toNumber() * 100 + 31   // YYYYMM31

    const rows = await this.db.all<TransactionRow>(
      `SELECT * FROM transactions
       WHERE date >= ? AND date <= ? AND tombstone = 0
       ORDER BY date DESC`,
      [startDate, endDate]
    )
    return rows.map(TransactionMapper.toDomain)
  }

  async findChildren(parentId: EntityId): Promise<Transaction[]> {
    const rows = await this.db.all<TransactionRow>(
      'SELECT * FROM transactions WHERE parent_id = ? AND tombstone = 0',
      [parentId.toString()]
    )
    return rows.map(TransactionMapper.toDomain)
  }

  async save(transaction: Transaction): Promise<void> {
    const row = TransactionMapper.toPersistence(transaction)
    await this.db.run(
      `INSERT INTO transactions
       (id, acct, category, amount, description, notes, date, cleared,
        reconciled, tombstone, is_parent, is_child, parent_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         acct = excluded.acct,
         category = excluded.category,
         amount = excluded.amount,
         description = excluded.description,
         notes = excluded.notes,
         date = excluded.date,
         cleared = excluded.cleared,
         reconciled = excluded.reconciled,
         tombstone = excluded.tombstone,
         is_parent = excluded.is_parent,
         is_child = excluded.is_child,
         parent_id = excluded.parent_id,
         sort_order = excluded.sort_order`,
      [row.id, row.acct, row.category, row.amount, row.description,
       row.notes, row.date, row.cleared, row.reconciled, row.tombstone,
       row.is_parent, row.is_child, row.parent_id, row.sort_order]
    )
  }

  async saveMany(transactions: Transaction[]): Promise<void> {
    await this.db.transaction(async () => {
      for (const tx of transactions) {
        await this.save(tx)
      }
    })
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.run(
      'UPDATE transactions SET tombstone = 1 WHERE id = ?',
      [id.toString()]
    )
  }
}
```

---

## Tests

### Test de Integracion

```typescript
// SQLiteAccountRepository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('SQLiteAccountRepository', () => {
  let db: SQLiteDatabase
  let repo: SQLiteAccountRepository

  beforeEach(async () => {
    db = new SQLiteDatabase()
    await db.open(':memory:')
    await db.runMigrations()
    repo = new SQLiteAccountRepository(db)
  })

  afterEach(async () => {
    await db.close()
  })

  it('should save and retrieve an account', async () => {
    const account = Account.create({ name: 'Checking' })

    await repo.save(account)
    const found = await repo.findById(account.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('Checking')
  })

  it('should find all active accounts', async () => {
    const account1 = Account.create({ name: 'Checking' })
    const account2 = Account.create({ name: 'Savings' })
    account2.close()

    await repo.save(account1)
    await repo.save(account2)

    const active = await repo.findActive()

    expect(active).toHaveLength(1)
    expect(active[0].name).toBe('Checking')
  })

  it('should update an existing account', async () => {
    const account = Account.create({ name: 'Checking' })
    await repo.save(account)

    account.rename('Main Checking')
    await repo.save(account)

    const found = await repo.findById(account.id)
    expect(found!.name).toBe('Main Checking')
  })

  it('should soft delete an account', async () => {
    const account = Account.create({ name: 'Checking' })
    await repo.save(account)

    await repo.delete(account.id)

    const all = await repo.findAll()
    expect(all).toHaveLength(0)
  })
})
```

---

## Verificacion

### Comandos

```bash
# Tests de integracion
npm run test:integration

# Tests con SQLite en memoria
npm run test -- --grep "SQLite"
```

### Criterios de Exito

- [ ] Migraciones se ejecutan correctamente
- [ ] Todos los repositorios implementan sus interfaces
- [ ] Mappers convierten correctamente en ambas direcciones
- [ ] Tests de integracion pasan con SQLite en memoria
- [ ] Transacciones funcionan correctamente
- [ ] Soft deletes funcionan (tombstone)

---

## Tiempo Estimado

- SQLiteDatabase wrapper: 2-3 horas
- Migraciones: 2-3 horas
- Mappers: 2-3 horas
- Repositories: 4-6 horas
- Tests de integracion: 3-4 horas

**Total: 13-19 horas**
