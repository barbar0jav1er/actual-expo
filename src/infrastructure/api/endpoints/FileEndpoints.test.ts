import { describe, it, expect, vi, afterEach } from 'vitest'
import { HttpClient } from '../HttpClient'
import { FileEndpoints } from './FileEndpoints'
import { ApiError } from '../types/ApiErrors'

const TOKEN = 'test-token'
const BASE_URL = 'http://localhost:5006'

function makeMockHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    get: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
    post: vi.fn().mockResolvedValue({}),
    postBinary: vi.fn(),
    baseUrl: BASE_URL,
    ...overrides,
  } as unknown as HttpClient
}

describe('FileEndpoints', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listFiles', () => {
    it('returns list of files', async () => {
      const files = [
        { fileId: 'f-1', name: 'Budget', groupId: 'g-1', encryptKeyId: null, deleted: false, owner: 'u-1' },
      ]
      const http = makeMockHttp({
        get: vi.fn().mockResolvedValue({ status: 'ok', data: files }),
      })
      const endpoint = new FileEndpoints(http, () => TOKEN)

      const result = await endpoint.listFiles()

      expect(result).toHaveLength(1)
      expect(result[0].fileId).toBe('f-1')
    })

    it('throws when no token', async () => {
      const http = makeMockHttp()
      const endpoint = new FileEndpoints(http, () => null)
      await expect(endpoint.listFiles()).rejects.toThrow('No auth token set')
    })
  })

  describe('getFileInfo', () => {
    it('returns file info', async () => {
      const file = { fileId: 'f-1', name: 'Budget', groupId: 'g-1', encryptKeyId: 'k-1', deleted: false, owner: 'u-1' }
      const http = makeMockHttp({
        get: vi.fn().mockResolvedValue({ status: 'ok', data: file }),
      })
      const endpoint = new FileEndpoints(http, () => TOKEN)

      const result = await endpoint.getFileInfo('f-1')

      expect(result).toEqual(file)
    })

    it('returns null when file not found', async () => {
      const http = makeMockHttp({
        get: vi.fn().mockRejectedValue(new ApiError(400, 'file-not-found')),
      })
      const endpoint = new FileEndpoints(http, () => TOKEN)

      expect(await endpoint.getFileInfo('missing')).toBeNull()
    })
  })

  describe('downloadFile', () => {
    it('returns file bytes on success', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4])
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      }))
      const http = makeMockHttp()
      const endpoint = new FileEndpoints(http, () => TOKEN)

      const result = await endpoint.downloadFile('f-1')

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result).toEqual(bytes)
    })

    it('throws ApiError on download failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ reason: 'file-not-found' }),
      }))
      const http = makeMockHttp()
      const endpoint = new FileEndpoints(http, () => TOKEN)

      await expect(endpoint.downloadFile('missing')).rejects.toThrow(ApiError)
    })
  })

  describe('uploadFile', () => {
    it('returns groupId on success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ groupId: 'g-new' }),
      }))
      const http = makeMockHttp()
      const endpoint = new FileEndpoints(http, () => TOKEN)

      const result = await endpoint.uploadFile(
        'f-1',
        new Uint8Array([1, 2, 3]),
        { name: 'My Budget' }
      )

      expect(result.groupId).toBe('g-new')
    })

    it('includes optional headers when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ groupId: 'g-1' }),
      })
      vi.stubGlobal('fetch', fetchMock)
      const http = makeMockHttp()
      const endpoint = new FileEndpoints(http, () => TOKEN)

      await endpoint.uploadFile('f-1', new Uint8Array(), {
        name: 'Budget',
        groupId: 'g-1',
        encryptMeta: { keyId: 'k-1' },
        format: 2,
      })

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['x-actual-group-id']).toBe('g-1')
      expect(headers['x-actual-encrypt-meta']).toBe(JSON.stringify({ keyId: 'k-1' }))
      expect(headers['x-actual-format']).toBe('2')
    })
  })

  describe('deleteFile / resetFile', () => {
    it('deleteFile calls correct endpoint', async () => {
      const http = makeMockHttp()
      const endpoint = new FileEndpoints(http, () => TOKEN)

      await endpoint.deleteFile('f-1')

      expect(http.post).toHaveBeenCalledWith(
        '/sync/delete-user-file',
        { fileId: 'f-1' },
        { headers: { 'x-actual-token': TOKEN } }
      )
    })

    it('resetFile calls correct endpoint', async () => {
      const http = makeMockHttp()
      const endpoint = new FileEndpoints(http, () => TOKEN)

      await endpoint.resetFile('f-1')

      expect(http.post).toHaveBeenCalledWith(
        '/sync/reset-user-file',
        { fileId: 'f-1' },
        { headers: { 'x-actual-token': TOKEN } }
      )
    })
  })
})
