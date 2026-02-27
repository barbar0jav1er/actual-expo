import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  offbudget: integer('offbudget').notNull().default(0),
  closed:    integer('closed').notNull().default(0),
  sortOrder: real('sort_order').default(0),
  tombstone: integer('tombstone').notNull().default(0),
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
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  transferAcct: text('transfer_acct').references(() => accounts.id),
  tombstone:    integer('tombstone').notNull().default(0),
})

export const transactions = sqliteTable('transactions', {
  id:          text('id').primaryKey(),
  acct:        text('acct').notNull().references(() => accounts.id),
  category:    text('category').references(() => categories.id),
  amount:      integer('amount').notNull(),
  description: text('description').references(() => payees.id), // payee_id
  notes:       text('notes'),
  date:        integer('date').notNull(), // YYYYMMDD
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
  value:     text('value').notNull(), // blob como text base64
})

export const messagesClock = sqliteTable('messages_clock', {
  id:    integer('id').primaryKey(),
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
