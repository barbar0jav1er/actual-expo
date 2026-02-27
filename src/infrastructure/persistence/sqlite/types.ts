import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type * as schema from './schema'

// Tipo compatible con drizzle expo-sqlite (async) y better-sqlite3 (sync) — para tests
export type DrizzleDB = BaseSQLiteDatabase<'async' | 'sync', any, typeof schema>
