import type { SQLiteDatabase } from 'expo-sqlite'

export interface RawMessage {
  dataset: string
  row: string
  column: string
  value: string | number | null
}

/**
 * Applies a CRDT message directly to SQLite.
 * Port of apply() in loot-core/src/server/sync/index.ts
 */
export function applyMessage(db: SQLiteDatabase, msg: RawMessage): void {
  const { dataset, row, column, value } = msg

  if (dataset === 'prefs') return

  try {
    const prev = db.getFirstSync(
      `SELECT id FROM "${dataset}" WHERE id = ?`,
      [row],
    )

    if (prev) {
      db.runSync(
        `UPDATE "${dataset}" SET "${column}" = ? WHERE id = ?`,
        [value, row],
      )
    } else {
      db.runSync(
        `INSERT INTO "${dataset}" (id, "${column}") VALUES (?, ?)`,
        [row, value],
      )
    }
  } catch (error) {
    console.warn(`[loot-core apply] ${dataset}/${row}/${column}:`, error)
    throw error
  }
}
