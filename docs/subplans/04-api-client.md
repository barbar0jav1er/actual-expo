# Subplan 4: API Client y Autenticacion (Infrastructure - API)

## Objetivo

Implementar cliente HTTP para comunicacion con el servidor Actual Budget, incluyendo autenticacion y encriptacion.

## Dependencias

- **Subplan 3:** CRDT Sync (para encoder/decoder de mensajes)

## Archivos a Crear

```
src/
└── infrastructure/
    ├── api/
    │   ├── HttpClient.ts
    │   ├── HttpClient.test.ts
    │   ├── ActualServerClient.ts
    │   ├── ActualServerClient.test.ts
    │   ├── endpoints/
    │   │   ├── AuthEndpoints.ts
    │   │   ├── AuthEndpoints.test.ts
    │   │   ├── SyncEndpoints.ts
    │   │   ├── SyncEndpoints.test.ts
    │   │   ├── FileEndpoints.ts
    │   │   ├── FileEndpoints.test.ts
    │   │   └── index.ts
    │   ├── types/
    │   │   ├── ApiResponses.ts
    │   │   └── ApiErrors.ts
    │   └── index.ts
    ├── crypto/
    │   ├── AESEncryptionService.ts
    │   ├── AESEncryptionService.test.ts
    │   ├── KeyDerivation.ts
    │   ├── KeyDerivation.test.ts
    │   └── index.ts
    └── storage/
        ├── SecureTokenStorage.ts
        └── index.ts
```

---

## HttpClient

Cliente HTTP base con manejo de errores.

```typescript
interface HttpClientConfig {
  baseUrl: string
  timeout?: number
}

interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
}

class HttpClient {
  constructor(private config: HttpClientConfig) {}

  async get<T>(path: string, options?: RequestOptions): Promise<T>

  async post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T>

  async postBinary(
    path: string,
    body: Uint8Array,
    options?: RequestOptions
  ): Promise<Uint8Array>

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`
    const timeout = options?.timeout ?? this.config.timeout ?? 30000

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw await this.parseError(response)
      }

      return response.json()
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout')
      }
      throw new NetworkError(error.message)
    }
  }

  private async parseError(response: Response): Promise<ApiError> {
    try {
      const body = await response.json()
      return new ApiError(
        response.status,
        body.reason ?? 'unknown',
        body.details
      )
    } catch {
      return new ApiError(response.status, 'unknown')
    }
  }
}
```

---

## API Errors

```typescript
class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    public readonly details?: string
  ) {
    super(`API Error: ${reason}`)
    this.name = 'ApiError'
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}
```

---

## ActualServerClient

Cliente principal para el servidor Actual.

```typescript
class ActualServerClient {
  private httpClient: HttpClient
  private token: string | null = null

  constructor(serverUrl: string) {
    this.httpClient = new HttpClient({ baseUrl: serverUrl })
  }

  setToken(token: string): void {
    this.token = token
  }

  clearToken(): void {
    this.token = null
  }

  get auth(): AuthEndpoints {
    return new AuthEndpoints(this.httpClient, () => this.token)
  }

  get sync(): SyncEndpoints {
    return new SyncEndpoints(this.httpClient, () => this.token)
  }

  get files(): FileEndpoints {
    return new FileEndpoints(this.httpClient, () => this.token)
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.token) {
      headers['x-actual-token'] = this.token
    }
    return headers
  }
}
```

---

## Auth Endpoints

```typescript
interface BootstrapInfo {
  bootstrapped: boolean
  loginMethod: 'password' | 'header' | 'openid'
  availableLoginMethods: Array<{
    method: string
    enabled: boolean
  }>
  multiuser: boolean
}

interface UserInfo {
  validated: boolean
  userName: string
  permission: 'owner' | 'admin' | 'user'
  userId: string
  displayName: string
  loginMethod: string
}

class AuthEndpoints {
  constructor(
    private http: HttpClient,
    private getToken: () => string | null
  ) {}

  async needsBootstrap(): Promise<BootstrapInfo> {
    const response = await this.http.get<{
      status: string
      data: BootstrapInfo
    }>('/account/needs-bootstrap')
    return response.data
  }

  async login(password: string): Promise<string> {
    const response = await this.http.post<{
      status: string
      data: { token: string }
    }>('/account/login', { password })
    return response.data.token
  }

  async validate(): Promise<UserInfo> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    const response = await this.http.get<{
      status: string
      data: UserInfo
    }>('/account/validate', {
      headers: { 'x-actual-token': token }
    })
    return response.data
  }

  async changePassword(newPassword: string): Promise<void> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    await this.http.post('/account/change-password', {
      password: newPassword
    }, {
      headers: { 'x-actual-token': token }
    })
  }
}
```

---

## Sync Endpoints

```typescript
interface EncryptionKey {
  id: string
  salt: string
  test: string
}

class SyncEndpoints {
  constructor(
    private http: HttpClient,
    private getToken: () => string | null
  ) {}

  async sync(request: Uint8Array): Promise<Uint8Array> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    return this.http.postBinary('/sync/sync', request, {
      headers: {
        'x-actual-token': token,
        'Content-Type': 'application/actual-sync'
      }
    })
  }

  async getUserKey(fileId: string): Promise<EncryptionKey | null> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    try {
      const response = await this.http.post<{
        status: string
        data: EncryptionKey
      }>('/sync/user-get-key', { fileId }, {
        headers: { 'x-actual-token': token }
      })
      return response.data
    } catch (error) {
      if (error instanceof ApiError && error.reason === 'file-not-found') {
        return null
      }
      throw error
    }
  }

  async createUserKey(
    fileId: string,
    keyId: string,
    keySalt: string,
    testContent: string
  ): Promise<void> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    await this.http.post('/sync/user-create-key', {
      fileId,
      keyId,
      keySalt,
      testContent
    }, {
      headers: { 'x-actual-token': token }
    })
  }
}
```

---

## File Endpoints

```typescript
interface FileInfo {
  deleted: boolean
  fileId: string
  groupId: string | null
  name: string
  encryptKeyId: string | null
  owner: string
}

interface FileMetadata {
  name: string
  groupId?: string
  encryptMeta?: { keyId: string }
  format?: number
}

class FileEndpoints {
  constructor(
    private http: HttpClient,
    private getToken: () => string | null
  ) {}

  async listFiles(): Promise<FileInfo[]> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    const response = await this.http.get<{
      status: string
      data: FileInfo[]
    }>('/sync/list-user-files', {
      headers: { 'x-actual-token': token }
    })
    return response.data
  }

  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    try {
      const response = await this.http.get<{
        status: string
        data: FileInfo
      }>('/sync/get-user-file-info', {
        headers: {
          'x-actual-token': token,
          'x-actual-file-id': fileId
        }
      })
      return response.data
    } catch (error) {
      if (error instanceof ApiError && error.reason === 'file-not-found') {
        return null
      }
      throw error
    }
  }

  async downloadFile(fileId: string): Promise<Uint8Array> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    const response = await fetch(
      `${this.http.baseUrl}/sync/download-user-file`,
      {
        headers: {
          'x-actual-token': token,
          'x-actual-file-id': fileId
        }
      }
    )

    if (!response.ok) {
      throw new ApiError(response.status, 'download-failed')
    }

    return new Uint8Array(await response.arrayBuffer())
  }

  async uploadFile(
    fileId: string,
    data: Uint8Array,
    metadata: FileMetadata
  ): Promise<{ groupId: string }> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    const response = await fetch(
      `${this.http.baseUrl}/sync/upload-user-file`,
      {
        method: 'POST',
        headers: {
          'x-actual-token': token,
          'x-actual-file-id': fileId,
          'x-actual-name': encodeURIComponent(metadata.name),
          ...(metadata.groupId && { 'x-actual-group-id': metadata.groupId }),
          ...(metadata.encryptMeta && {
            'x-actual-encrypt-meta': JSON.stringify(metadata.encryptMeta)
          }),
          ...(metadata.format && { 'x-actual-format': String(metadata.format) }),
          'Content-Type': 'application/encrypted-file'
        },
        body: data
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new ApiError(response.status, body.reason ?? 'upload-failed')
    }

    const result = await response.json()
    return { groupId: result.groupId }
  }

  async deleteFile(fileId: string): Promise<void> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    await this.http.post('/sync/delete-user-file', { fileId }, {
      headers: { 'x-actual-token': token }
    })
  }

  async resetFile(fileId: string): Promise<void> {
    const token = this.getToken()
    if (!token) throw new Error('No token set')

    await this.http.post('/sync/reset-user-file', { fileId }, {
      headers: { 'x-actual-token': token }
    })
  }
}
```

---

## AES Encryption Service

```typescript
import * as Crypto from 'expo-crypto'

interface EncryptedData {
  iv: string       // Base64
  authTag: string  // Base64
  data: Uint8Array
}

interface EncryptionService {
  encrypt(data: Uint8Array, key: CryptoKey): Promise<EncryptedData>
  decrypt(encrypted: EncryptedData, key: CryptoKey): Promise<Uint8Array>
}

class AESEncryptionService implements EncryptionService {
  async encrypt(data: Uint8Array, key: CryptoKey): Promise<EncryptedData> {
    // Generar IV aleatorio de 12 bytes
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Encriptar con AES-256-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    // Separar ciphertext y auth tag (ultimos 16 bytes)
    const encryptedArray = new Uint8Array(encrypted)
    const ciphertext = encryptedArray.slice(0, -16)
    const authTag = encryptedArray.slice(-16)

    return {
      iv: this.toBase64(iv),
      authTag: this.toBase64(authTag),
      data: ciphertext
    }
  }

  async decrypt(encrypted: EncryptedData, key: CryptoKey): Promise<Uint8Array> {
    const iv = this.fromBase64(encrypted.iv)
    const authTag = this.fromBase64(encrypted.authTag)

    // Concatenar ciphertext + authTag
    const combined = new Uint8Array(encrypted.data.length + authTag.length)
    combined.set(encrypted.data)
    combined.set(authTag, encrypted.data.length)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      combined
    )

    return new Uint8Array(decrypted)
  }

  private toBase64(data: Uint8Array): string {
    return btoa(String.fromCharCode(...data))
  }

  private fromBase64(str: string): Uint8Array {
    return Uint8Array.from(atob(str), c => c.charCodeAt(0))
  }
}
```

---

## Key Derivation

```typescript
class KeyDerivation {
  static async deriveKey(
    password: string,
    salt: string,
    iterations: number = 100000
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0))

    // Importar password como key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    // Derivar clave AES-256
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  static generateSalt(): string {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    return btoa(String.fromCharCode(...salt))
  }

  static generateKeyId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}
```

---

## Secure Token Storage

```typescript
import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'actual_auth_token'
const SERVER_KEY = 'actual_server_url'

class SecureTokenStorage {
  async saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  }

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY)
  }

  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  }

  async saveServerUrl(url: string): Promise<void> {
    await SecureStore.setItemAsync(SERVER_KEY, url)
  }

  async getServerUrl(): Promise<string | null> {
    return SecureStore.getItemAsync(SERVER_KEY)
  }
}
```

---

## Tests

### Auth Endpoints Tests

```typescript
describe('AuthEndpoints', () => {
  let mockHttp: MockHttpClient
  let auth: AuthEndpoints

  beforeEach(() => {
    mockHttp = new MockHttpClient()
    auth = new AuthEndpoints(mockHttp, () => 'test-token')
  })

  describe('login', () => {
    it('should return token on successful login', async () => {
      mockHttp.mockPost('/account/login', {
        status: 'ok',
        data: { token: 'new-token' }
      })

      const token = await auth.login('password123')

      expect(token).toBe('new-token')
    })

    it('should throw on invalid password', async () => {
      mockHttp.mockPostError('/account/login', 400, 'invalid-password')

      await expect(auth.login('wrong')).rejects.toThrow(ApiError)
    })
  })

  describe('validate', () => {
    it('should return user info', async () => {
      mockHttp.mockGet('/account/validate', {
        status: 'ok',
        data: {
          validated: true,
          userName: 'test',
          permission: 'owner',
          userId: 'user-123'
        }
      })

      const info = await auth.validate()

      expect(info.validated).toBe(true)
      expect(info.userName).toBe('test')
    })
  })
})
```

### Encryption Tests

```typescript
describe('AESEncryptionService', () => {
  let service: AESEncryptionService
  let key: CryptoKey

  beforeAll(async () => {
    service = new AESEncryptionService()
    key = await KeyDerivation.deriveKey('password', KeyDerivation.generateSalt())
  })

  it('should encrypt and decrypt data', async () => {
    const original = new TextEncoder().encode('Hello, World!')

    const encrypted = await service.encrypt(original, key)
    const decrypted = await service.decrypt(encrypted, key)

    expect(new TextDecoder().decode(decrypted)).toBe('Hello, World!')
  })

  it('should produce different ciphertext for same data', async () => {
    const data = new TextEncoder().encode('test')

    const encrypted1 = await service.encrypt(data, key)
    const encrypted2 = await service.encrypt(data, key)

    expect(encrypted1.iv).not.toBe(encrypted2.iv)
  })
})
```

---

## Verificacion

### Criterios de Exito

- [ ] HttpClient maneja timeouts correctamente
- [ ] AuthEndpoints login/validate funcionan
- [ ] SyncEndpoints envia/recibe mensajes binarios
- [ ] FileEndpoints list/download/upload funcionan
- [ ] AES encryption/decryption es correcto
- [ ] Key derivation es compatible con servidor
- [ ] SecureStore guarda/recupera tokens

### Test de Integracion (Opcional)

```typescript
it('should login and sync with real server', async () => {
  const client = new ActualServerClient('http://localhost:5006')

  const token = await client.auth.login('test-password')
  client.setToken(token)

  const files = await client.files.listFiles()
  expect(files).toBeDefined()
})
```

---

## Tiempo Estimado

- HttpClient: 2-3 horas
- Auth Endpoints: 2-3 horas
- Sync Endpoints: 2-3 horas
- File Endpoints: 3-4 horas
- AES Encryption: 2-3 horas
- Key Derivation: 1-2 horas
- Secure Storage: 1 hora
- Tests: 3-4 horas

**Total: 16-23 horas**
