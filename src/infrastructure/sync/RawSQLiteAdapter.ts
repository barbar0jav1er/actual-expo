/**
 * Minimal synchronous SQLite interface needed by applyMessage().
 * Decouples loot-core sync from expo-sqlite specifics.
 */
export interface RawSQLiteAdapter {
  getFirstSync(sql: string, params: unknown[]): unknown
  runSync(sql: string, params: unknown[]): void
}
