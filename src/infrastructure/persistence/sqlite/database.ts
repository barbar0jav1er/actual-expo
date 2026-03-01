import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from './schema'

function _createDrizzle(expo: SQLiteDatabase) {
  return drizzle(expo, { schema })
}

// AppDatabase is the Drizzle db type — used by migrate.ts and repositories
export type AppDatabase = ReturnType<typeof _createDrizzle>

export function createDatabase(name = 'actual.db'): { db: AppDatabase; expoDb: SQLiteDatabase } {
  const expoDb = openDatabaseSync(name, { enableChangeListener: true })
  const db = _createDrizzle(expoDb)
  return { db, expoDb }
}
