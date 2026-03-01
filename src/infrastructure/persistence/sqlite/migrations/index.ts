/**
 * Schema migrations — ordered array of { id, sql }.
 * Applied by runMigrations() at startup; applied IDs tracked in __migrations__ table.
 * Column names match Actual's init.sql exactly (isParent, isChild, targetId, transferId).
 * All columns nullable — supports CRDT field-by-field INSERT.
 */
export const migrations: { id: number; sql: string }[] = [
  {
    id: 0,
    sql: `
CREATE TABLE IF NOT EXISTS __migrations__ (
  id INTEGER PRIMARY KEY NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT,
  offbudget INTEGER DEFAULT 0,
  closed INTEGER DEFAULT 0,
  sort_order REAL,
  tombstone INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS category_groups (
  id TEXT PRIMARY KEY,
  name TEXT,
  is_income INTEGER DEFAULT 0,
  sort_order REAL,
  hidden INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT,
  is_income INTEGER DEFAULT 0,
  cat_group TEXT,
  sort_order REAL,
  hidden INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY,
  name TEXT,
  transfer_acct TEXT,
  tombstone INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  isParent INTEGER DEFAULT 0,
  isChild INTEGER DEFAULT 0,
  acct TEXT,
  category TEXT,
  amount INTEGER,
  description TEXT,
  notes TEXT,
  date INTEGER,
  starting_balance_flag INTEGER DEFAULT 0,
  transferred_id TEXT,
  sort_order REAL,
  tombstone INTEGER DEFAULT 0,
  cleared INTEGER DEFAULT 1,
  reconciled INTEGER DEFAULT 0,
  parent_id TEXT
);
CREATE TABLE IF NOT EXISTS payee_mapping (
  id TEXT PRIMARY KEY,
  targetId TEXT
);
CREATE TABLE IF NOT EXISTS category_mapping (
  id TEXT PRIMARY KEY,
  transferId TEXT
);
CREATE TABLE IF NOT EXISTS zero_budgets (
  id TEXT PRIMARY KEY,
  month INTEGER,
  category TEXT,
  amount INTEGER DEFAULT 0,
  carryover INTEGER DEFAULT 0,
  goal INTEGER
);
CREATE TABLE IF NOT EXISTS created_budgets (
  month INTEGER PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS messages_crdt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL UNIQUE,
  dataset TEXT NOT NULL,
  row TEXT NOT NULL,
  column TEXT NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages_clock (
  id INTEGER PRIMARY KEY,
  clock TEXT
);
    `.trim(),
  },
]
