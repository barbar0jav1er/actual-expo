# Subplan 3: Sincronizacion CRDT (Infrastructure - Sync)

## Objetivo

Implementar el motor de sincronizacion CRDT compatible con el servidor Actual Budget existente.

## Dependencias

- **Subplan 1:** Value Object `Timestamp`

## Archivos a Crear

```
src/
└── infrastructure/
    └── sync/
        ├── crdt/
        │   ├── Timestamp.ts
        │   ├── Timestamp.test.ts
        │   ├── MerkleTree.ts
        │   ├── MerkleTree.test.ts
        │   ├── Clock.ts
        │   ├── Clock.test.ts
        │   └── index.ts
        ├── protobuf/
        │   ├── sync.proto
        │   ├── generated/
        │   │   └── sync.ts
        │   ├── SyncEncoder.ts
        │   ├── SyncEncoder.test.ts
        │   ├── SyncDecoder.ts
        │   ├── SyncDecoder.test.ts
        │   └── index.ts
        ├── repositories/
        │   ├── SQLiteSyncRepository.ts
        │   ├── SQLiteSyncRepository.test.ts
        │   └── index.ts
        ├── ValueSerializer.ts
        ├── ValueSerializer.test.ts
        └── index.ts
```

---

## CRDT - Timestamp HULC

Hybrid Unique Logical Clock extendido con operaciones de sincronizacion.

### Formato

```
2024-02-26T12:00:00.000Z-0000-abc123def4567890
└────────ISO 8601───────┘ └ctr┘ └────node id────┘
```

- **millis:** Unix timestamp en milisegundos
- **counter:** 0x0000 - 0xFFFF (incrementa en mismo milisegundo)
- **node:** 16 caracteres hexadecimales (identificador unico del cliente)

### Implementacion

```typescript
class Timestamp {
  static MAX_DRIFT = 5 * 60 * 1000  // 5 minutos
  static MAX_COUNTER = 0xFFFF

  private constructor(
    private readonly millis: number,
    private readonly counter: number,
    private readonly node: string
  ) {}

  // Factory methods
  static create(millis: number, counter: number, node: string): Timestamp
  static now(node: string): Timestamp
  static parse(str: string): Timestamp | null

  // CRDT Operations
  static send(clock: ClockState): Timestamp {
    const physical = Date.now()
    const logical = Math.max(clock.timestamp.millis, physical)

    let counter: number
    if (logical === clock.timestamp.millis) {
      counter = clock.timestamp.counter + 1
      if (counter > Timestamp.MAX_COUNTER) {
        throw new TimestampOverflowError()
      }
    } else {
      counter = 0
    }

    // Validar drift
    if (logical - physical > Timestamp.MAX_DRIFT) {
      throw new ClockDriftError(logical - physical)
    }

    return new Timestamp(logical, counter, clock.node)
  }

  static recv(clock: ClockState, remote: Timestamp): Timestamp {
    const physical = Date.now()
    const logical = Math.max(
      clock.timestamp.millis,
      physical,
      remote.millis
    )

    let counter: number
    if (logical === clock.timestamp.millis && logical === remote.millis) {
      counter = Math.max(clock.timestamp.counter, remote.counter) + 1
    } else if (logical === clock.timestamp.millis) {
      counter = clock.timestamp.counter + 1
    } else if (logical === remote.millis) {
      counter = remote.counter + 1
    } else {
      counter = 0
    }

    if (counter > Timestamp.MAX_COUNTER) {
      throw new TimestampOverflowError()
    }

    if (logical - physical > Timestamp.MAX_DRIFT) {
      throw new ClockDriftError(logical - physical)
    }

    return new Timestamp(logical, counter, clock.node)
  }

  // Getters
  getMillis(): number
  getCounter(): number
  getNode(): string

  // Serialization
  toString(): string {
    const date = new Date(this.millis).toISOString()
    const ctr = this.counter.toString(16).padStart(4, '0')
    return `${date}-${ctr}-${this.node}`
  }

  // Comparison
  compareTo(other: Timestamp): number {
    if (this.millis !== other.millis) {
      return this.millis - other.millis
    }
    if (this.counter !== other.counter) {
      return this.counter - other.counter
    }
    return this.node.localeCompare(other.node)
  }

  equals(other: Timestamp): boolean {
    return this.compareTo(other) === 0
  }

  isAfter(other: Timestamp): boolean {
    return this.compareTo(other) > 0
  }

  isBefore(other: Timestamp): boolean {
    return this.compareTo(other) < 0
  }
}

// Errors
class TimestampOverflowError extends Error {
  constructor() {
    super('Timestamp counter overflow')
  }
}

class ClockDriftError extends Error {
  constructor(public readonly drift: number) {
    super(`Clock drift too large: ${drift}ms`)
  }
}
```

---

## CRDT - Merkle Tree

Arbol Merkle radix-3 para deteccion eficiente de diferencias.

### Estructura

```typescript
type TrieNode = {
  '0'?: TrieNode
  '1'?: TrieNode
  '2'?: TrieNode
  hash?: number
}
```

### Implementacion

```typescript
class MerkleTree {
  // Factory
  static emptyTrie(): TrieNode {
    return { hash: 0 }
  }

  // Insert timestamp into trie
  static insert(trie: TrieNode, timestamp: Timestamp): TrieNode {
    const key = this.timestampToKey(timestamp)
    const hash = this.hashTimestamp(timestamp)
    return this.insertKey({ ...trie }, key, hash, 0)
  }

  private static insertKey(
    node: TrieNode,
    key: string,
    hash: number,
    depth: number
  ): TrieNode {
    if (depth === key.length) {
      return { ...node, hash: (node.hash ?? 0) ^ hash }
    }

    const branch = key[depth] as '0' | '1' | '2'
    const child = node[branch] ?? { hash: 0 }
    const newChild = this.insertKey(child, key, hash, depth + 1)

    return {
      ...node,
      [branch]: newChild,
      hash: this.computeHash(node, branch, newChild)
    }
  }

  // Find divergence point between two tries
  static diff(trie1: TrieNode, trie2: TrieNode): number | null {
    if (trie1.hash === trie2.hash) {
      return null  // Identical
    }

    return this.findDiff(trie1, trie2, '')
  }

  private static findDiff(
    node1: TrieNode,
    node2: TrieNode,
    path: string
  ): number {
    for (const branch of ['0', '1', '2'] as const) {
      const child1 = node1[branch]
      const child2 = node2[branch]

      const hash1 = child1?.hash ?? 0
      const hash2 = child2?.hash ?? 0

      if (hash1 !== hash2) {
        const newPath = path + branch

        // Si alguno no tiene hijos, encontramos el punto
        if (!child1 || !child2) {
          return this.keyToTimestamp(newPath)
        }

        return this.findDiff(child1, child2, newPath)
      }
    }

    // Si llegamos aqui, la diferencia esta en este nivel
    return this.keyToTimestamp(path)
  }

  // Prune old branches to save memory
  static prune(trie: TrieNode, maxDepth: number = 2): TrieNode {
    return this.pruneNode(trie, 0, maxDepth)
  }

  private static pruneNode(
    node: TrieNode,
    depth: number,
    maxDepth: number
  ): TrieNode {
    if (depth >= maxDepth) {
      // Solo mantener el hash
      return { hash: node.hash }
    }

    const result: TrieNode = { hash: node.hash }

    for (const branch of ['0', '1', '2'] as const) {
      if (node[branch]) {
        result[branch] = this.pruneNode(node[branch]!, depth + 1, maxDepth)
      }
    }

    return result
  }

  // Serialization
  static serialize(trie: TrieNode): string {
    return JSON.stringify(trie)
  }

  static deserialize(json: string): TrieNode {
    return JSON.parse(json) as TrieNode
  }

  // Helpers
  private static timestampToKey(ts: Timestamp): string {
    // Convertir millis a minutos, luego a base 3
    const minutes = Math.floor(ts.getMillis() / 1000 / 60)
    return minutes.toString(3).padStart(16, '0')
  }

  private static keyToTimestamp(key: string): number {
    // Convertir key base 3 a millis
    const minutes = parseInt(key || '0', 3)
    return minutes * 60 * 1000
  }

  private static hashTimestamp(ts: Timestamp): number {
    // Simple hash usando MurmurHash-like
    const str = ts.toString()
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) ^ char
      hash = hash & hash  // Convert to 32bit integer
    }
    return hash
  }

  private static computeHash(
    node: TrieNode,
    updatedBranch: '0' | '1' | '2',
    newChild: TrieNode
  ): number {
    let hash = 0
    for (const branch of ['0', '1', '2'] as const) {
      const child = branch === updatedBranch ? newChild : node[branch]
      if (child) {
        hash ^= child.hash ?? 0
      }
    }
    return hash
  }
}
```

---

## CRDT - Clock

Estado del reloj CRDT.

```typescript
interface ClockState {
  timestamp: Timestamp
  merkle: TrieNode
  node: string
}

class Clock {
  private state: ClockState

  private constructor(state: ClockState) {
    this.state = state
  }

  // Factory
  static initialize(node?: string): Clock {
    const nodeId = node ?? this.generateNodeId()
    return new Clock({
      timestamp: Timestamp.now(nodeId),
      merkle: MerkleTree.emptyTrie(),
      node: nodeId
    })
  }

  static fromState(state: ClockState): Clock {
    return new Clock(state)
  }

  private static generateNodeId(): string {
    // Generar 16 caracteres hex aleatorios
    const array = new Uint8Array(8)
    crypto.getRandomValues(array)
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Operations
  send(): Timestamp {
    const newTimestamp = Timestamp.send(this.state)
    this.state = {
      ...this.state,
      timestamp: newTimestamp
    }
    return newTimestamp
  }

  recv(remote: Timestamp): void {
    const newTimestamp = Timestamp.recv(this.state, remote)
    this.state = {
      ...this.state,
      timestamp: newTimestamp
    }
  }

  // Merkle operations
  updateMerkle(timestamp: Timestamp): void {
    this.state = {
      ...this.state,
      merkle: MerkleTree.insert(this.state.merkle, timestamp)
    }
  }

  pruneMerkle(): void {
    this.state = {
      ...this.state,
      merkle: MerkleTree.prune(this.state.merkle)
    }
  }

  getMerkle(): TrieNode {
    return this.state.merkle
  }

  // Getters
  getNode(): string {
    return this.state.node
  }

  getTimestamp(): Timestamp {
    return this.state.timestamp
  }

  getState(): ClockState {
    return { ...this.state }
  }

  // Serialization
  serialize(): string {
    return JSON.stringify({
      timestamp: this.state.timestamp.toString(),
      merkle: this.state.merkle,
      node: this.state.node
    })
  }

  static deserialize(json: string): Clock {
    const data = JSON.parse(json)
    return new Clock({
      timestamp: Timestamp.parse(data.timestamp)!,
      merkle: data.merkle,
      node: data.node
    })
  }
}
```

---

## Protocol Buffers

### sync.proto

```protobuf
syntax = "proto3";

message EncryptedData {
  bytes iv = 1;
  bytes authTag = 2;
  bytes data = 3;
}

message Message {
  string dataset = 1;
  string row = 2;
  string column = 3;
  string value = 4;
}

message MessageEnvelope {
  string timestamp = 1;
  bool isEncrypted = 2;
  bytes content = 3;
}

message SyncRequest {
  repeated MessageEnvelope messages = 1;
  string fileId = 2;
  string groupId = 3;
  string keyId = 5;
  string since = 6;
}

message SyncResponse {
  repeated MessageEnvelope messages = 1;
  string merkle = 2;
}
```

### SyncEncoder

```typescript
import * as protobuf from 'protobufjs'

interface SyncMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string
  isEncrypted?: boolean
}

class SyncEncoder {
  private root: protobuf.Root

  async init(): Promise<void> {
    this.root = await protobuf.load('sync.proto')
  }

  encode(params: {
    messages: SyncMessage[]
    fileId: string
    groupId: string
    keyId?: string
    since: string
  }): Uint8Array {
    const SyncRequest = this.root.lookupType('SyncRequest')
    const MessageEnvelope = this.root.lookupType('MessageEnvelope')
    const Message = this.root.lookupType('Message')

    const envelopes = params.messages.map(msg => {
      const message = Message.create({
        dataset: msg.dataset,
        row: msg.row,
        column: msg.column,
        value: msg.value
      })

      const content = Message.encode(message).finish()

      return MessageEnvelope.create({
        timestamp: msg.timestamp,
        isEncrypted: msg.isEncrypted ?? false,
        content
      })
    })

    const request = SyncRequest.create({
      messages: envelopes,
      fileId: params.fileId,
      groupId: params.groupId,
      keyId: params.keyId,
      since: params.since
    })

    return SyncRequest.encode(request).finish() as Uint8Array
  }
}
```

### SyncDecoder

```typescript
class SyncDecoder {
  private root: protobuf.Root

  async init(): Promise<void> {
    this.root = await protobuf.load('sync.proto')
  }

  decode(buffer: Uint8Array): {
    messages: SyncMessage[]
    merkle: TrieNode
  } {
    const SyncResponse = this.root.lookupType('SyncResponse')
    const MessageEnvelope = this.root.lookupType('MessageEnvelope')
    const Message = this.root.lookupType('Message')

    const response = SyncResponse.decode(buffer)

    const messages = response.messages.map((envelope: any) => {
      const content = Message.decode(envelope.content)

      return {
        timestamp: envelope.timestamp,
        dataset: content.dataset,
        row: content.row,
        column: content.column,
        value: content.value,
        isEncrypted: envelope.isEncrypted
      }
    })

    return {
      messages,
      merkle: JSON.parse(response.merkle)
    }
  }
}
```

---

## Value Serializer

Serializa valores para almacenamiento en CRDT.

```typescript
// Formato: "TIPO:VALOR"
// null -> "0:"
// number -> "N:123"
// string -> "S:texto"

class ValueSerializer {
  static serialize(value: unknown): string {
    if (value === null || value === undefined) {
      return '0:'
    }
    if (typeof value === 'number') {
      return `N:${value}`
    }
    if (typeof value === 'string') {
      return `S:${value}`
    }
    throw new Error(`Cannot serialize value of type ${typeof value}`)
  }

  static deserialize(str: string): unknown {
    const colonIndex = str.indexOf(':')
    if (colonIndex === -1) {
      throw new Error(`Invalid serialized value: ${str}`)
    }

    const type = str.substring(0, colonIndex)
    const value = str.substring(colonIndex + 1)

    switch (type) {
      case '0':
        return null
      case 'N':
        return parseInt(value, 10)
      case 'S':
        return value
      default:
        throw new Error(`Unknown type: ${type}`)
    }
  }
}
```

---

## SQLite Sync Repository

```typescript
interface StoredMessage {
  timestamp: string
  dataset: string
  row: string
  column: string
  value: string
}

interface ISyncRepository {
  getMessages(since: string): Promise<StoredMessage[]>
  saveMessage(message: StoredMessage): Promise<void>
  saveMessages(messages: StoredMessage[]): Promise<void>
  hasMessage(timestamp: string): Promise<boolean>

  getClock(): Promise<ClockState | null>
  saveClock(clock: ClockState): Promise<void>
}

class SQLiteSyncRepository implements ISyncRepository {
  constructor(private db: SQLiteDatabase) {}

  async getMessages(since: string): Promise<StoredMessage[]> {
    return this.db.all<StoredMessage>(
      `SELECT timestamp, dataset, row, column, value
       FROM messages_crdt
       WHERE timestamp > ?
       ORDER BY timestamp`,
      [since]
    )
  }

  async saveMessage(message: StoredMessage): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO messages_crdt
       (timestamp, dataset, row, column, value)
       VALUES (?, ?, ?, ?, ?)`,
      [message.timestamp, message.dataset, message.row,
       message.column, message.value]
    )
  }

  async saveMessages(messages: StoredMessage[]): Promise<void> {
    await this.db.transaction(async () => {
      for (const msg of messages) {
        await this.saveMessage(msg)
      }
    })
  }

  async hasMessage(timestamp: string): Promise<boolean> {
    const result = await this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM messages_crdt WHERE timestamp = ?',
      [timestamp]
    )
    return (result?.count ?? 0) > 0
  }

  async getClock(): Promise<ClockState | null> {
    const row = await this.db.get<{ clock: string }>(
      'SELECT clock FROM messages_clock WHERE id = 1'
    )
    if (!row) return null

    const data = JSON.parse(row.clock)
    return {
      timestamp: Timestamp.parse(data.timestamp)!,
      merkle: data.merkle,
      node: data.node
    }
  }

  async saveClock(clock: ClockState): Promise<void> {
    const json = JSON.stringify({
      timestamp: clock.timestamp.toString(),
      merkle: clock.merkle,
      node: clock.node
    })

    await this.db.run(
      `INSERT INTO messages_clock (id, clock) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET clock = excluded.clock`,
      [json]
    )
  }
}
```

---

## Tests

### Timestamp Tests

```typescript
describe('Timestamp', () => {
  describe('parse', () => {
    it('should parse valid timestamp string', () => {
      const ts = Timestamp.parse('2024-02-26T12:00:00.000Z-0001-abc123def4567890')

      expect(ts).not.toBeNull()
      expect(ts!.getCounter()).toBe(1)
      expect(ts!.getNode()).toBe('abc123def4567890')
    })

    it('should return null for invalid string', () => {
      expect(Timestamp.parse('invalid')).toBeNull()
    })
  })

  describe('send', () => {
    it('should increment counter on same millisecond', () => {
      const clock: ClockState = {
        timestamp: Timestamp.parse('2024-02-26T12:00:00.000Z-0000-abc123def4567890')!,
        merkle: MerkleTree.emptyTrie(),
        node: 'abc123def4567890'
      }

      // Mock Date.now to return same time
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-02-26T12:00:00.000Z').getTime())

      const newTs = Timestamp.send(clock)

      expect(newTs.getCounter()).toBe(1)
    })
  })

  describe('compareTo', () => {
    it('should order by millis first', () => {
      const ts1 = Timestamp.parse('2024-02-26T12:00:00.000Z-0000-abc123def4567890')!
      const ts2 = Timestamp.parse('2024-02-26T12:00:01.000Z-0000-abc123def4567890')!

      expect(ts1.compareTo(ts2)).toBeLessThan(0)
      expect(ts2.compareTo(ts1)).toBeGreaterThan(0)
    })
  })
})
```

### MerkleTree Tests

```typescript
describe('MerkleTree', () => {
  it('should detect identical tries', () => {
    const trie1 = MerkleTree.emptyTrie()
    const trie2 = MerkleTree.emptyTrie()

    expect(MerkleTree.diff(trie1, trie2)).toBeNull()
  })

  it('should detect differences after insert', () => {
    const ts = Timestamp.parse('2024-02-26T12:00:00.000Z-0000-abc123def4567890')!

    const trie1 = MerkleTree.emptyTrie()
    const trie2 = MerkleTree.insert(trie1, ts)

    expect(MerkleTree.diff(trie1, trie2)).not.toBeNull()
  })

  it('should serialize and deserialize correctly', () => {
    const ts = Timestamp.parse('2024-02-26T12:00:00.000Z-0000-abc123def4567890')!
    const trie = MerkleTree.insert(MerkleTree.emptyTrie(), ts)

    const json = MerkleTree.serialize(trie)
    const restored = MerkleTree.deserialize(json)

    expect(MerkleTree.diff(trie, restored)).toBeNull()
  })
})
```

---

## Verificacion

### Criterios de Exito

- [ ] Timestamp genera y parsea correctamente el formato HULC
- [ ] Timestamp.send() incrementa el contador correctamente
- [ ] Timestamp.recv() sincroniza relojes correctamente
- [ ] MerkleTree detecta diferencias entre tries
- [ ] MerkleTree.prune() reduce el tamano del arbol
- [ ] Protocol Buffers codifica/decodifica correctamente
- [ ] SyncRepository persiste mensajes y clock

### Test de Compatibilidad

Verificar que los mensajes generados son compatibles con el servidor:

```typescript
it('should generate messages compatible with actual server', async () => {
  const encoder = new SyncEncoder()
  await encoder.init()

  const buffer = encoder.encode({
    messages: [{
      timestamp: '2024-02-26T12:00:00.000Z-0000-abc123def4567890',
      dataset: 'transactions',
      row: 'tx-123',
      column: 'amount',
      value: 'N:5000'
    }],
    fileId: 'test-file',
    groupId: 'test-group',
    since: '2024-02-26T00:00:00.000Z-0000-0000000000000000'
  })

  // Verificar que el buffer tiene el formato esperado
  expect(buffer).toBeInstanceOf(Uint8Array)
  expect(buffer.length).toBeGreaterThan(0)
})
```

---

## Tiempo Estimado

- Timestamp HULC: 3-4 horas
- MerkleTree: 4-5 horas
- Clock: 2-3 horas
- Protocol Buffers: 3-4 horas
- SyncRepository: 2-3 horas
- Tests: 3-4 horas

**Total: 17-23 horas**
