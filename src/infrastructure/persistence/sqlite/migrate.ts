import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import migrations from '../../../../drizzle/migrations'
import type { AppDatabase } from './database'

export async function runMigrations(db: AppDatabase): Promise<void> {
  await migrate(db, migrations)
}
