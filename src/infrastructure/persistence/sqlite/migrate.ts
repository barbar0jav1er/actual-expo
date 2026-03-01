import { migrations } from './migrations'
import type { AppDatabase } from './db'

export async function runMigrations(db: AppDatabase): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS __migrations__ (id INTEGER PRIMARY KEY NOT NULL)`,
  )
  const applied = await db.all<{ id: number }>('SELECT id FROM __migrations__')
  const appliedIds = new Set(applied.map(r => r.id))

  for (const m of migrations) {
    if (appliedIds.has(m.id)) continue
    if (m.sql) await db.exec(m.sql)
    await db.run('INSERT OR IGNORE INTO __migrations__ (id) VALUES (?)', [m.id])
  }
}
