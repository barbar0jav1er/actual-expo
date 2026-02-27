import { describe, it, expect, vi, afterEach } from 'vitest'
import { HttpClient } from '../HttpClient'
import { SyncEndpoints } from './SyncEndpoints'
import { ApiError } from '../types/ApiErrors'

const TOKEN = 'test-token'

function makeMockHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({}),
    postBinary: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    baseUrl: 'http://localhost:5006',
    ...overrides,
  } as unknown as HttpClient
}

describe('SyncEndpoints', () => {
  afterEach(() => vi.restoreAllMocks())

  describe('sync', () => {
    it('posts binary and returns response bytes', async () => {
      const http = makeMockHttp()
      const endpoint = new SyncEndpoints(http, () => TOKEN)
      const request = new Uint8Array([10, 20, 30])

      const result = await endpoint.sync(request)

      expect(result).toBeInstanceOf(Uint8Array)
      expect(http.postBinary).toHaveBeenCalledWith('/sync/sync', request, {
        headers: {
          'x-actual-token': TOKEN,
          'Content-Type': 'application/actual-sync',
        },
      })
    })

    it('throws when no token', async () => {
      const http = makeMockHttp()
      const endpoint = new SyncEndpoints(http, () => null)
      await expect(endpoint.sync(new Uint8Array())).rejects.toThrow('No auth token set')
    })
  })

  describe('getUserKey', () => {
    it('returns encryption key on success', async () => {
      const key = { id: 'key-1', salt: 'abc=', test: 'encrypted' }
      const http = makeMockHttp({
        post: vi.fn().mockResolvedValue({ status: 'ok', data: key }),
      })
      const endpoint = new SyncEndpoints(http, () => TOKEN)

      const result = await endpoint.getUserKey('file-1')

      expect(result).toEqual(key)
    })

    it('returns null when file not found', async () => {
      const http = makeMockHttp({
        post: vi.fn().mockRejectedValue(new ApiError(400, 'file-not-found')),
      })
      const endpoint = new SyncEndpoints(http, () => TOKEN)

      const result = await endpoint.getUserKey('missing-file')

      expect(result).toBeNull()
    })

    it('re-throws other errors', async () => {
      const http = makeMockHttp({
        post: vi.fn().mockRejectedValue(new ApiError(401, 'unauthorized')),
      })
      const endpoint = new SyncEndpoints(http, () => TOKEN)

      await expect(endpoint.getUserKey('file-1')).rejects.toThrow(ApiError)
    })
  })

  describe('createUserKey', () => {
    it('sends all key fields', async () => {
      const http = makeMockHttp()
      const endpoint = new SyncEndpoints(http, () => TOKEN)

      await endpoint.createUserKey('file-1', 'key-1', 'salt=', 'test-content')

      expect(http.post).toHaveBeenCalledWith(
        '/sync/user-create-key',
        { fileId: 'file-1', keyId: 'key-1', keySalt: 'salt=', testContent: 'test-content' },
        { headers: { 'x-actual-token': TOKEN } }
      )
    })
  })
})
