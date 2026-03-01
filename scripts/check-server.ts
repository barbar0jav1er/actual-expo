import { SyncEncoder } from '@infrastructure/sync/protobuf/SyncEncoder'
import { SyncDecoder } from '@infrastructure/sync/protobuf/SyncDecoder'

const SERVER   = 'http://localhost:5006'
const PASSWORD = 'test'
const SINCE_ZERO = '1970-01-01T00:00:00.000Z-0000-0000000000000000'

const loginRes = await fetch(`${SERVER}/account/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD }),
})
const { data: { token } } = await loginRes.json() as any

const filesRes = await fetch(`${SERVER}/sync/list-user-files`, { headers: { 'x-actual-token': token } })
const { data: files } = await filesRes.json() as any
const f = files.find((x: any) => !x.deleted)
const { fileId, groupId } = f
console.log(`File: "${f.name}" fileId=${fileId.slice(0,8)}… groupId=${groupId.slice(0,8)}…`)

// Pull all messages from server
const encoder = new SyncEncoder()
const decoder = new SyncDecoder()
const req = encoder.encode({ fileId, groupId, since: SINCE_ZERO, messages: [] })

const syncRes = await fetch(`${SERVER}/sync/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/actual-sync', 'x-actual-token': token, 'x-actual-file-id': fileId },
  body: req,
})

if (!syncRes.ok) {
  const err = await syncRes.text()
  console.log(`\nSync FAILED (${syncRes.status}):`, err)
  process.exit(1)
}

const bytes = new Uint8Array(await syncRes.arrayBuffer())
const decoded = decoder.decode(bytes)
console.log(`\nSync OK — ${decoded.messages.length} total messages on server`)

// Group by table
const byTable: Record<string, number> = {}
for (const m of decoded.messages) {
  byTable[m.dataset] = (byTable[m.dataset] ?? 0) + 1
}
console.log('Messages by table:')
for (const [t, n] of Object.entries(byTable).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${t}: ${n}`)
}

// Show accounts on server
const accountMsgs = decoded.messages.filter(m => m.dataset === 'accounts' && m.column === 'name')
console.log(`\nAccount names: ${accountMsgs.map(m => `"${m.value.replace('S:','')}"(${m.row.slice(0,6)})` ).join(', ')}`)
