import type { RawSQLiteAdapter } from '@infrastructure/sync/RawSQLiteAdapter'

export interface RawMessage {
  dataset: string
  row: string
  column: string
  value: string | number | null
}

/**
 * Defaults for NOT NULL columns per dataset.
 * Applied when inserting a brand-new row via field-by-field CRDT messages,
 * mirroring Actual's approach (their schema has no NOT NULL constraints).
 */
const DATASET_DEFAULTS: Record<string, Record<string, unknown>> = {
  transactions: {
    acct: '',
    amount: 0,
    date: 0,
    cleared: 1,
    reconciled: 0,
    tombstone: 0,
    isParent: 0,
    isChild: 0,
  },
  accounts: {
    name: '',
    offbudget: 0,
    closed: 0,
    tombstone: 0,
  },
  categories: {
    name: '',
    cat_group: '',
    is_income: 0,
    hidden: 0,
    tombstone: 0,
  },
  category_groups: {
    name: '',
    is_income: 0,
    hidden: 0,
    tombstone: 0,
  },
  payees: {
    name: '',
    tombstone: 0,
  },
}

/**
 * Applies a CRDT message directly to SQLite.
 * Port of apply() in loot-core/src/server/sync/index.ts
 *
 * On a new row: INSERT with NOT NULL defaults + the incoming column value.
 * On an existing row: UPDATE the specific column.
 * Unknown columns are silently skipped (matching Actual's behaviour).
 */
export function applyMessage(db: RawSQLiteAdapter, msg: RawMessage): void {
  const { dataset, row, column, value } = msg

  if (dataset === 'prefs') return

  try {
    const exists = db.getFirstSync(
      `SELECT id FROM "${dataset}" WHERE id = ?`,
      [row],
    )

    if (!exists) {
      // Build INSERT with defaults to satisfy NOT NULL constraints.
      // The actual column value overrides any default for that column.
      const defaults = DATASET_DEFAULTS[dataset] ?? {}
      const merged: Record<string, unknown> = { ...defaults }
      if (column !== 'id') {
        merged[column] = value
      }

      const entries = Object.entries(merged)
      const colList = entries.map(([c]) => `"${c}"`).join(', ')
      const valList = entries.map(() => '?').join(', ')

      db.runSync(
        `INSERT OR IGNORE INTO "${dataset}" ("id", ${colList}) VALUES (?, ${valList})`,
        [row, ...entries.map(([, v]) => v)],
      )
    } else if (column !== 'id') {
      db.runSync(
        `UPDATE "${dataset}" SET "${column}" = ? WHERE id = ?`,
        [value, row],
      )
    }
  } catch (err) {
    console.log(`[loot-core apply] ${dataset}/${row}/${column}:`, err)
    // Silently skip — unknown columns, schema mismatches, etc.
  }
}
