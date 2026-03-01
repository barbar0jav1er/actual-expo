import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'

/**
 * Minimal database interface — mirrors Actual server's db.ts helper functions.
 * Three implementations: ExpoDatabase (prod), BetterSQLiteDatabase (tests), BunDatabase (smoke-test).
 */
export interface AppDatabase {
  first<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  run(sql: string, params?: unknown[]): Promise<void>
  exec(sql: string): Promise<void>
}

class ExpoDatabase implements AppDatabase {
  constructor(private readonly raw: SQLiteDatabase) {}

  first<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    return this.raw.getFirstAsync<T>(sql, params as any)
  }

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.raw.getAllAsync<T>(sql, params as any)
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.raw.runAsync(sql, params as any)
  }

  exec(sql: string): Promise<void> {
    return this.raw.execAsync(sql)
  }
}

export function createDatabase(name = 'actual.db'): { db: AppDatabase; expoDb: SQLiteDatabase } {
  const expoDb = openDatabaseSync(name, { enableChangeListener: true })
  return { db: new ExpoDatabase(expoDb), expoDb }
}
