# Guia de Replicacion de Actual Budget con Expo

## Resumen Ejecutivo

**Actual Budget** es una aplicacion de finanzas personales **local-first** con sincronizacion CRDT. Este documento describe todo lo necesario para crear una version compatible con Expo que se sincronice con el servidor existente.

---

## 1. Arquitectura General

### 1.1 Stack Tecnologico Original

| Componente | Tecnologia |
|------------|------------|
| Frontend Web/Desktop | React 19 + Vite + Redux Toolkit |
| Desktop App | Electron 39 |
| Base de Datos Local | SQLite (better-sqlite3 / sql.js) |
| Sincronizacion | CRDT + Merkle Trees + Protocol Buffers |
| Servidor | Node.js + Express 5 |
| Encriptacion | AES-256-GCM |

### 1.2 Arquitectura para Expo

```
┌─────────────────────────────────────────────────────────┐
│                    APP EXPO (React Native)              │
├─────────────────────────────────────────────────────────┤
│  UI Layer         │  React Native + Expo Components     │
│  State Management │  Redux Toolkit o Zustand            │
│  Database         │  expo-sqlite                        │
│  Sync Layer       │  CRDT Client (reimplementar)        │
│  Network          │  fetch / axios                      │
│  Crypto           │  expo-crypto                        │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              SERVIDOR EXISTENTE (Sin cambios)           │
│  POST /sync/sync          - Sincronizacion CRDT        │
│  POST /sync/upload-user-file                           │
│  GET  /sync/download-user-file                         │
│  POST /account/login                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Modelo de Datos

### 2.1 Tablas Principales (SQLite)

```sql
-- ACCOUNTS (Cuentas bancarias)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  offbudget INTEGER DEFAULT 0,
  closed INTEGER DEFAULT 0,
  sort_order REAL,
  tombstone INTEGER DEFAULT 0,
  account_id TEXT,
  balance_current INTEGER,
  balance_available INTEGER,
  balance_limit INTEGER,
  mask TEXT,
  official_name TEXT,
  account_sync_source TEXT,
  last_reconciled TEXT,
  last_sync TEXT
);

-- TRANSACTIONS (Transacciones)
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  isParent INTEGER DEFAULT 0,
  isChild INTEGER DEFAULT 0,
  acct TEXT NOT NULL,
  category TEXT,
  amount INTEGER NOT NULL,
  description TEXT,
  notes TEXT,
  date INTEGER NOT NULL,
  financial_id TEXT,
  imported_description TEXT,
  starting_balance_flag INTEGER DEFAULT 0,
  transferred_id TEXT,
  sort_order REAL,
  parent_id TEXT,
  tombstone INTEGER DEFAULT 0,
  cleared INTEGER DEFAULT 1,
  reconciled INTEGER DEFAULT 0,
  schedule TEXT
);

-- CATEGORIES (Categorias)
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_income INTEGER DEFAULT 0,
  cat_group TEXT NOT NULL,
  sort_order REAL,
  tombstone INTEGER DEFAULT 0,
  hidden INTEGER DEFAULT 0,
  goal_def TEXT
);

-- CATEGORY_GROUPS (Grupos de categorias)
CREATE TABLE category_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_income INTEGER DEFAULT 0,
  sort_order REAL,
  tombstone INTEGER DEFAULT 0,
  hidden INTEGER DEFAULT 0
);

-- PAYEES (Beneficiarios)
CREATE TABLE payees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  transfer_acct TEXT,
  tombstone INTEGER DEFAULT 0,
  favorite INTEGER DEFAULT 0
);

-- ZERO_BUDGETS (Presupuestos por categoria/mes)
CREATE TABLE zero_budgets (
  id TEXT PRIMARY KEY,
  month INTEGER,
  category TEXT NOT NULL,
  amount INTEGER,
  carryover INTEGER,
  goal INTEGER
);

-- RULES (Reglas de automatizacion)
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  stage TEXT,
  conditions TEXT,
  actions TEXT,
  conditions_op TEXT,
  tombstone INTEGER DEFAULT 0
);

-- SCHEDULES (Transacciones recurrentes)
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  name TEXT,
  rule TEXT NOT NULL,
  active INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  posts_transaction INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0
);

-- MESSAGES_CRDT (Cambios CRDT para sincronizacion)
CREATE TABLE messages_crdt (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL UNIQUE,
  dataset TEXT NOT NULL,
  row TEXT NOT NULL,
  column TEXT NOT NULL,
  value BLOB NOT NULL
);

-- MESSAGES_CLOCK (Reloj logico)
CREATE TABLE messages_clock (
  id INTEGER PRIMARY KEY,
  clock TEXT NOT NULL
);

-- CATEGORY_MAPPING (Mapeo de IDs de categorias)
CREATE TABLE category_mapping (
  id TEXT PRIMARY KEY,
  transferId TEXT
);

-- PAYEE_MAPPING (Mapeo de IDs de payees)
CREATE TABLE payee_mapping (
  id TEXT PRIMARY KEY,
  targetId TEXT
);
```

### 2.2 Tipos TypeScript para Entidades

```typescript
// Montos en centavos (integer)
type IntegerAmount = number;

interface AccountEntity {
  id: string;
  name: string;
  offbudget: 0 | 1;
  closed: 0 | 1;
  sort_order: number;
  tombstone: 0 | 1;
  account_sync_source: 'simpleFin' | 'goCardless' | 'pluggyai' | null;
  last_sync: string | null;
}

interface TransactionEntity {
  id: string;
  is_parent?: boolean;
  is_child?: boolean;
  parent_id?: string;
  account: string;
  category?: string;
  amount: IntegerAmount;
  payee?: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  cleared?: boolean;
  reconciled?: boolean;
  tombstone?: boolean;
  schedule?: string;
  subtransactions?: TransactionEntity[];
}

interface CategoryEntity {
  id: string;
  name: string;
  is_income?: boolean;
  group: string;
  sort_order?: number;
  tombstone?: boolean;
  hidden?: boolean;
}

interface PayeeEntity {
  id: string;
  name: string;
  transfer_acct?: string;
  favorite?: boolean;
  tombstone?: boolean;
}
```

---

## 3. Sistema de Sincronizacion CRDT

### 3.1 Componentes Clave a Implementar

#### 3.1.1 Timestamp HULC (Hybrid Unique Logical Clock)

```typescript
// Formato: "2015-04-24T22:23:42.123Z-1000-0123456789ABCDEF"
//           └─────────ISO 8601─────────┘ └ctr┘ └───node id────┘

class Timestamp {
  private millis: number;   // Unix timestamp en ms
  private counter: number;  // 0x0000 - 0xFFFF
  private node: string;     // 16 chars hex

  static MAX_DRIFT = 5 * 60 * 1000; // 5 minutos

  // Generar timestamp para envio
  static send(clock: Clock): Timestamp {
    const physical = Date.now();
    const logical = Math.max(clock.timestamp.millis, physical);

    let counter: number;
    if (logical === clock.timestamp.millis) {
      counter = clock.timestamp.counter + 1;
      if (counter > 0xFFFF) throw new Error('OverflowError');
    } else {
      counter = 0;
    }

    // Validar drift
    if (logical - physical > Timestamp.MAX_DRIFT) {
      throw new Error('ClockDriftError');
    }

    return new Timestamp(logical, counter, clock.node);
  }

  // Recibir timestamp remoto
  static recv(clock: Clock, remote: Timestamp): Timestamp {
    const physical = Date.now();
    const logical = Math.max(clock.timestamp.millis, physical, remote.millis);

    let counter: number;
    if (logical === clock.timestamp.millis && logical === remote.millis) {
      counter = Math.max(clock.timestamp.counter, remote.counter) + 1;
    } else if (logical === clock.timestamp.millis) {
      counter = clock.timestamp.counter + 1;
    } else if (logical === remote.millis) {
      counter = remote.counter + 1;
    } else {
      counter = 0;
    }

    if (counter > 0xFFFF) throw new Error('OverflowError');
    if (logical - physical > Timestamp.MAX_DRIFT) {
      throw new Error('ClockDriftError');
    }

    return new Timestamp(logical, counter, clock.node);
  }

  // Parsear string
  static parse(str: string): Timestamp | null {
    const match = str.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-([0-9a-fA-F]{4})-([0-9a-fA-F]{16})$/
    );
    if (!match) return null;

    const millis = new Date(match[1]).getTime();
    const counter = parseInt(match[2], 16);
    const node = match[3];

    return new Timestamp(millis, counter, node);
  }

  toString(): string {
    const date = new Date(this.millis).toISOString();
    const ctr = this.counter.toString(16).padStart(4, '0');
    return `${date}-${ctr}-${this.node}`;
  }
}
```

#### 3.1.2 Merkle Tree (Arbol de Hash)

```typescript
type TrieNode = {
  '0'?: TrieNode;
  '1'?: TrieNode;
  '2'?: TrieNode;
  hash?: number;
};

class MerkleTree {
  // Crear arbol vacio
  static emptyTrie(): TrieNode {
    return { hash: 0 };
  }

  // Insertar timestamp
  static insert(trie: TrieNode, timestamp: Timestamp): TrieNode {
    const key = this.timestampToKey(timestamp);
    const hash = this.hashTimestamp(timestamp);
    return this.insertKey(trie, key, hash);
  }

  // Encontrar diferencia entre dos arboles
  static diff(trie1: TrieNode, trie2: TrieNode): number | null {
    if (trie1.hash === trie2.hash) return null;

    // Buscar recursivamente la rama donde difieren
    let node1 = trie1;
    let node2 = trie2;
    let key = '';

    while (true) {
      for (const branch of ['0', '1', '2']) {
        const child1 = node1[branch as keyof TrieNode];
        const child2 = node2[branch as keyof TrieNode];

        const hash1 = (child1 as TrieNode)?.hash ?? 0;
        const hash2 = (child2 as TrieNode)?.hash ?? 0;

        if (hash1 !== hash2) {
          key += branch;
          node1 = (child1 as TrieNode) ?? { hash: 0 };
          node2 = (child2 as TrieNode) ?? { hash: 0 };
          break;
        }
      }

      // Si llegamos a una hoja, convertir key a timestamp
      if (!node1['0'] && !node1['1'] && !node1['2']) {
        return this.keyToTimestamp(key);
      }
    }
  }

  // Podar arbol para eficiencia
  static prune(trie: TrieNode, depth: number = 2): TrieNode {
    // Mantiene solo las ultimas `depth` generaciones
    // Implementacion recursiva...
  }

  private static timestampToKey(ts: Timestamp): string {
    // Convertir millis a base 3 (ternaria)
    const minutes = Math.floor(ts.millis / 1000 / 60);
    return minutes.toString(3);
  }

  private static keyToTimestamp(key: string): number {
    // Convertir key base 3 a millis
    const minutes = parseInt(key, 3);
    return minutes * 60 * 1000;
  }

  private static hashTimestamp(ts: Timestamp): number {
    // Hash simple XOR del timestamp string
    let hash = 0;
    const str = ts.toString();
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
    }
    return hash;
  }
}
```

### 3.2 Serializacion de Valores

```typescript
// Formato: "TIPO:VALOR"
function serializeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '0:';
  }
  if (typeof value === 'number') {
    return `N:${value}`;
  }
  if (typeof value === 'string') {
    return `S:${value}`;
  }
  throw new Error(`Unsupported type: ${typeof value}`);
}

function deserializeValue(str: string): unknown {
  const [type, ...rest] = str.split(':');
  const value = rest.join(':');

  switch (type) {
    case '0': return null;
    case 'N': return parseInt(value, 10);
    case 'S': return value;
    default: throw new Error(`Unknown type: ${type}`);
  }
}
```

### 3.3 Protocol Buffers (Mensajes de Sync)

```protobuf
// sync.proto - Definicion de mensajes

message EncryptedData {
  bytes iv = 1;
  bytes authTag = 2;
  bytes data = 3;
}

message Message {
  string dataset = 1;   // Tabla: "transactions", "accounts", etc.
  string row = 2;       // ID de la fila
  string column = 3;    // Nombre de columna
  string value = 4;     // Valor serializado
}

message MessageEnvelope {
  string timestamp = 1;
  bool isEncrypted = 2;
  bytes content = 3;    // Message o EncryptedData serializado
}

message SyncRequest {
  repeated MessageEnvelope messages = 1;
  string fileId = 2;
  string groupId = 3;
  string keyId = 5;
  string since = 6;     // REQUERIDO
}

message SyncResponse {
  repeated MessageEnvelope messages = 1;
  string merkle = 2;    // JSON serializado del Merkle tree
}
```

**Nota para Expo:** Usar `protobufjs` o `google-protobuf` para serializar/deserializar.

---

## 4. API del Servidor

### 4.1 Autenticacion

#### Login
```http
POST /account/login
Content-Type: application/json

{
  "password": "tu_password"
}

Response:
{
  "status": "ok",
  "data": {
    "token": "eyJhbGc..."
  }
}
```

#### Validar Token
```http
GET /account/validate
x-actual-token: <token>

Response:
{
  "status": "ok",
  "data": {
    "validated": true,
    "userName": "user",
    "userId": "uuid",
    "permission": "owner"
  }
}
```

### 4.2 Sincronizacion

#### Obtener Clave de Encriptacion
```http
POST /sync/user-get-key
x-actual-token: <token>
Content-Type: application/json

{
  "fileId": "mi-archivo-id"
}

Response:
{
  "status": "ok",
  "data": {
    "id": "keyId",
    "salt": "base64_salt",
    "test": "encrypted_test_content"
  }
}
```

#### Sincronizar Cambios
```http
POST /sync/sync
x-actual-token: <token>
Content-Type: application/actual-sync

Body: SyncRequest (Protocol Buffer binario)

Response:
Content-Type: application/actual-sync
X-ACTUAL-SYNC-METHOD: simple

Body: SyncResponse (Protocol Buffer binario)
```

#### Listar Archivos
```http
GET /sync/list-user-files
x-actual-token: <token>

Response:
{
  "status": "ok",
  "data": [
    {
      "fileId": "abc123",
      "name": "Mi Presupuesto",
      "groupId": "uuid",
      "encryptKeyId": "key123"
    }
  ]
}
```

#### Descargar Archivo
```http
GET /sync/download-user-file
x-actual-token: <token>
x-actual-file-id: <fileId>

Response: Binary (archivo completo)
```

#### Subir Archivo
```http
POST /sync/upload-user-file
x-actual-token: <token>
x-actual-name: Mi%20Presupuesto
x-actual-file-id: <fileId>
x-actual-group-id: <groupId>  (opcional)
x-actual-encrypt-meta: {"keyId":"key123"}
Content-Type: application/encrypted-file

Body: Binary (archivo encriptado)

Response:
{
  "status": "ok",
  "groupId": "uuid-generado"
}
```

### 4.3 Errores Comunes

| Codigo | Razon | Descripcion |
|--------|-------|-------------|
| 400 | `file-not-found` | Archivo no existe |
| 400 | `file-old-version` | Formato obsoleto |
| 400 | `file-needs-upload` | Necesita subir archivo primero |
| 400 | `file-key-mismatch` | Clave de encriptacion incorrecta |
| 400 | `file-has-reset` | El archivo fue reseteado |
| 401 | `unauthorized` | Token invalido o expirado |
| 422 | `since-required` | Falta parametro `since` |

---

## 5. Flujo de Sincronizacion

### 5.1 Flujo Completo

```
1. INICIALIZACION
   ├─ Generar node ID unico (16 chars hex)
   ├─ Inicializar clock local
   └─ Crear tablas SQLite

2. LOGIN
   ├─ POST /account/login
   └─ Guardar token

3. LISTAR ARCHIVOS
   ├─ GET /sync/list-user-files
   └─ Usuario selecciona archivo

4. DESCARGAR ARCHIVO (si es nuevo dispositivo)
   ├─ GET /sync/download-user-file
   ├─ Desencriptar archivo
   └─ Importar a SQLite local

5. SINCRONIZACION INCREMENTAL
   ├─ Leer cambios locales desde messages_crdt
   ├─ Codificar en SyncRequest (protobuf)
   ├─ POST /sync/sync
   ├─ Decodificar SyncResponse
   ├─ Aplicar cambios remotos a BD local
   └─ Actualizar merkle tree local

6. DETECCION DE CONFLICTOS
   ├─ Comparar merkle local vs servidor
   ├─ Si difieren: resincronizar desde punto de divergencia
   └─ LWW (Last-Write-Wins) por timestamp
```

### 5.2 Aplicar Cambios Locales

```typescript
async function applyLocalChange(
  db: SQLiteDatabase,
  clock: Clock,
  table: string,
  rowId: string,
  column: string,
  value: unknown
): Promise<void> {
  // 1. Generar timestamp
  const timestamp = Timestamp.send(clock);
  clock.timestamp = timestamp;

  // 2. Serializar valor
  const serialized = serializeValue(value);

  // 3. Guardar en messages_crdt
  await db.runAsync(
    `INSERT INTO messages_crdt (timestamp, dataset, row, column, value)
     VALUES (?, ?, ?, ?, ?)`,
    [timestamp.toString(), table, rowId, column, serialized]
  );

  // 4. Actualizar tabla de datos
  await db.runAsync(
    `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
    [value, rowId]
  );

  // 5. Actualizar merkle tree
  clock.merkle = MerkleTree.insert(clock.merkle, timestamp);

  // 6. Persistir clock
  await saveClock(db, clock);

  // 7. Programar sincronizacion
  scheduleSync();
}
```

### 5.3 Recibir Cambios Remotos

```typescript
async function receiveRemoteChanges(
  db: SQLiteDatabase,
  clock: Clock,
  messages: Message[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const msg of messages) {
      // 1. Sincronizar reloj
      const remoteTs = Timestamp.parse(msg.timestamp)!;
      clock.timestamp = Timestamp.recv(clock, remoteTs);

      // 2. Verificar si ya tenemos este mensaje
      const existing = await db.getFirstAsync(
        `SELECT 1 FROM messages_crdt WHERE timestamp = ?`,
        [msg.timestamp]
      );
      if (existing) continue;

      // 3. Deserializar valor
      const value = deserializeValue(msg.value);

      // 4. Guardar en messages_crdt
      await db.runAsync(
        `INSERT INTO messages_crdt (timestamp, dataset, row, column, value)
         VALUES (?, ?, ?, ?, ?)`,
        [msg.timestamp, msg.dataset, msg.row, msg.column, msg.value]
      );

      // 5. Aplicar a tabla de datos (LWW)
      await applyToDataTable(db, msg.dataset, msg.row, msg.column, value);

      // 6. Actualizar merkle
      clock.merkle = MerkleTree.insert(clock.merkle, remoteTs);
    }

    // 7. Podar y guardar
    clock.merkle = MerkleTree.prune(clock.merkle);
    await saveClock(db, clock);
  });
}
```

---

## 6. Encriptacion

### 6.1 Derivacion de Clave

```typescript
import * as Crypto from 'expo-crypto';

async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  // PBKDF2 con SHA-256
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

### 6.2 Encriptar/Desencriptar

```typescript
async function encrypt(
  data: Uint8Array,
  key: CryptoKey
): Promise<{ iv: string; authTag: string; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const ciphertext = new Uint8Array(encrypted.slice(0, -16));
  const authTag = new Uint8Array(encrypted.slice(-16));

  return {
    iv: btoa(String.fromCharCode(...iv)),
    authTag: btoa(String.fromCharCode(...authTag)),
    ciphertext
  };
}

async function decrypt(
  ciphertext: Uint8Array,
  iv: string,
  authTag: string,
  key: CryptoKey
): Promise<Uint8Array> {
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const tagBytes = Uint8Array.from(atob(authTag), c => c.charCodeAt(0));

  // Concatenar ciphertext + authTag para AES-GCM
  const combined = new Uint8Array(ciphertext.length + tagBytes.length);
  combined.set(ciphertext);
  combined.set(tagBytes, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    combined
  );

  return new Uint8Array(decrypted);
}
```

---

## 7. Dependencias Recomendadas para Expo

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-sqlite": "~15.0.0",
    "expo-crypto": "~14.0.0",
    "expo-secure-store": "~14.0.0",
    "protobufjs": "^7.0.0",
    "@reduxjs/toolkit": "^2.0.0",
    "react-redux": "^9.0.0",
    "uuid": "^9.0.0",
    "date-fns": "^3.0.0"
  }
}
```

### 7.1 Notas sobre expo-sqlite

```typescript
import * as SQLite from 'expo-sqlite';

// Abrir base de datos
const db = await SQLite.openDatabaseAsync('actual.db');

// Ejecutar query
await db.runAsync('INSERT INTO accounts (id, name) VALUES (?, ?)', ['id1', 'Checking']);

// Leer datos
const rows = await db.getAllAsync('SELECT * FROM accounts');

// Transaccion
await db.withTransactionAsync(async () => {
  await db.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [1000, 'id1']);
  await db.runAsync('INSERT INTO transactions ...');
});
```

---

## 8. Estructura de Proyecto Sugerida

```
expo-actual/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Dashboard
│   │   ├── accounts.tsx       # Lista de cuentas
│   │   ├── budget.tsx         # Presupuesto
│   │   └── settings.tsx       # Configuracion
│   ├── account/[id].tsx       # Detalle de cuenta
│   ├── transaction/[id].tsx   # Detalle de transaccion
│   └── _layout.tsx
├── src/
│   ├── db/
│   │   ├── schema.ts          # Definicion de tablas
│   │   ├── migrations.ts      # Migraciones
│   │   └── queries.ts         # Queries comunes
│   ├── sync/
│   │   ├── timestamp.ts       # HULC Clock
│   │   ├── merkle.ts          # Merkle Tree
│   │   ├── encoder.ts         # Protobuf encoding
│   │   ├── encryption.ts      # AES-256-GCM
│   │   └── sync-client.ts     # Cliente de sync
│   ├── store/
│   │   ├── store.ts           # Redux store
│   │   ├── accountsSlice.ts
│   │   ├── transactionsSlice.ts
│   │   └── budgetSlice.ts
│   ├── api/
│   │   └── actual-server.ts   # Cliente HTTP
│   ├── types/
│   │   └── models.ts          # Tipos de entidades
│   └── utils/
│       └── money.ts           # Utilidades de moneda
├── assets/
├── package.json
└── app.json
```

---

## 9. Consideraciones Importantes

### 9.1 Compatibilidad

- **Formato de fecha**: Usar `YYYYMMDD` como integer en BD, `YYYY-MM-DD` en UI
- **Montos**: Siempre en centavos (integer), nunca floats
- **IDs**: Usar UUIDs v4 (mismo formato que el cliente web)
- **Timestamps CRDT**: Mantener formato exacto para compatibilidad

### 9.2 Soft Deletes

Todas las entidades usan `tombstone = 1` para eliminacion logica. Nunca borrar fisicamente.

### 9.3 Mappings

Los mappings de categorias y payees deben mantenerse en memoria para busquedas rapidas:

```typescript
const categoryMap = new Map<string, string>(); // id original -> id actual
const payeeMap = new Map<string, string>();
```

### 9.4 Sincronizacion Offline

- Acumular cambios locales cuando no hay conexion
- Sincronizar automaticamente al recuperar conexion
- Mostrar indicador de estado de sync en UI

### 9.5 Manejo de Errores de Sync

```typescript
type SyncError =
  | 'out-of-sync'       // Reintentar desde punto de divergencia
  | 'network-failure'   // Reintentar mas tarde
  | 'decrypt-failure'   // Verificar password/clave
  | 'file-not-found'    // Archivo eliminado en servidor
  | 'unauthorized';     // Re-login requerido
```

---

## 10. Proximos Pasos

1. **Configurar proyecto Expo** con las dependencias listadas
2. **Implementar capa de base de datos** con expo-sqlite
3. **Implementar CRDT** (Timestamp, Merkle Tree)
4. **Implementar cliente de API** para el servidor
5. **Implementar Protocol Buffers** para mensajes de sync
6. **Implementar encriptacion** AES-256-GCM
7. **Crear UI basica** para cuentas y transacciones
8. **Implementar flujo de login** y seleccion de archivo
9. **Implementar sincronizacion** bidireccional
10. **Implementar presupuestos** (envelope budgeting)

---

## Apendice A: Archivos de Referencia en el Proyecto Original

| Funcionalidad | Ubicacion |
|---------------|-----------|
| Schema SQLite | `packages/loot-core/src/server/sql/init.sql` |
| Migraciones | `packages/loot-core/migrations/` |
| CRDT Timestamp | `packages/crdt/src/crdt/timestamp.ts` |
| Merkle Tree | `packages/crdt/src/crdt/merkle.ts` |
| Protocol Buffers | `packages/crdt/src/proto/sync.proto` |
| Sync Client | `packages/loot-core/src/server/sync/index.ts` |
| Encoder/Decoder | `packages/loot-core/src/server/sync/encoder.ts` |
| Tipos de Entidades | `packages/loot-core/src/types/models/` |
| API Server | `packages/sync-server/src/app-sync.ts` |
| Autenticacion | `packages/sync-server/src/app-account.js` |

---

*Documento generado para facilitar la replicacion de Actual Budget con Expo.*
