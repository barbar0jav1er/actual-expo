import type { SQLiteDatabase } from 'expo-sqlite'
import type { RawSQLiteAdapter } from './RawSQLiteAdapter'

/**
 * Adapter that wraps expo-sqlite's SQLiteDatabase for use with applyMessage().
 * This keeps expo-sqlite confined to infrastructure and out of loot-core.
 */
export class ExpoSQLiteAdapter implements RawSQLiteAdapter {
  constructor(private readonly db: SQLiteDatabase) {}

  getFirstSync(sql: string, params: unknown[]): unknown {
    return this.db.getFirstSync(sql, params) ?? null
  }

  runSync(sql: string, params: unknown[]): void {
    this.db.runSync(sql, params)
  }
}
