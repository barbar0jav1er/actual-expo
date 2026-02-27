import { openDatabaseSync } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from './schema'

export type AppDatabase = ReturnType<typeof createDatabase>

export function createDatabase(name = 'actual.db') {
  const expo = openDatabaseSync(name, { enableChangeListener: true })
  return drizzle(expo, { schema })
}
