#!/usr/bin/env bun
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '@infrastructure/persistence/sqlite/schema'
import type { DrizzleDB } from '@infrastructure/persistence/sqlite/types'
import { DrizzleAccountRepository } from '@infrastructure/persistence/sqlite/repositories'

const bunDb = new Database(':memory:')
const db = drizzle(bunDb, { schema }) as unknown as DrizzleDB
const accountRepo = new DrizzleAccountRepository(db)
console.log('ok')
