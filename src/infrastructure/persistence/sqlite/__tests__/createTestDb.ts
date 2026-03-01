import Database from 'better-sqlite3'
import { runMigrations } from '../migrate'
import type { AppDatabase } from '../db'

class BetterSQLiteDatabase implements AppDatabase {
  constructor(private readonly raw: InstanceType<typeof Database>) {}

  async first<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (this.raw.prepare(sql).get(...params as any) as T) ?? null
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...params as any) as T[]
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    this.raw.prepare(sql).run(...params as any)
  }

  async exec(sql: string): Promise<void> {
    this.raw.exec(sql)
  }
}

export async function createTestDb(): Promise<AppDatabase> {
  const sqlite = new Database(':memory:')
  const db = new BetterSQLiteDatabase(sqlite)
  await runMigrations(db)
  return db
}
