import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from './HttpClient'
import { ApiError, NetworkError } from './types/ApiErrors'

function mockFetch(response: Partial<Response>) {
  return vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

function mockFetchReject(error: Error) {
  return vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
}

describe('HttpClient', () => {
  let client: HttpClient

  beforeEach(() => {
    client = new HttpClient({ baseUrl: 'http://localhost:5006' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('get', () => {
    it('returns parsed JSON on 200', async () => {
      mockFetch({
        ok: true,
        json: async () => ({ status: 'ok', data: { id: '1' } }),
      })

      const result = await client.get<{ status: string; data: { id: string } }>('/test')
      expect(result.data.id).toBe('1')
    })

    it('throws ApiError on non-ok response', async () => {
      mockFetch({
        ok: false,
        status: 401,
        json: async () => ({ reason: 'unauthorized' }),
      })

      await expect(client.get('/test')).rejects.toThrow(ApiError)
    })

    it('throws ApiError with correct status and reason', async () => {
      mockFetch({
        ok: false,
        status: 400,
        json: async () => ({ reason: 'file-not-found' }),
      })

      const error = await client.get('/test').catch(e => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(400)
      expect(error.reason).toBe('file-not-found')
    })

    it('throws NetworkError on fetch rejection', async () => {
      mockFetchReject(new Error('Connection refused'))

      await expect(client.get('/test')).rejects.toThrow(NetworkError)
    })
  })

  describe('post', () => {
    it('sends JSON body and returns parsed response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', data: { token: 'abc' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      await client.post('/account/login', { password: 'secret' })

      const call = fetchMock.mock.calls[0]
      expect(call[1].body).toBe(JSON.stringify({ password: 'secret' }))
      expect(call[1].headers['Content-Type']).toBe('application/json')
    })
  })

  describe('postBinary', () => {
    it('sends binary body and returns Uint8Array', async () => {
      const responseData = new Uint8Array([1, 2, 3])
      mockFetch({
        ok: true,
        arrayBuffer: async () => responseData.buffer,
      })

      const result = await client.postBinary('/sync/sync', new Uint8Array([4, 5, 6]))
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result).toEqual(responseData)
    })

    it('throws ApiError on non-ok binary response', async () => {
      mockFetch({
        ok: false,
        status: 422,
        json: async () => ({ reason: 'since-required' }),
      })

      await expect(client.postBinary('/sync/sync', new Uint8Array())).rejects.toThrow(ApiError)
    })
  })

  describe('baseUrl', () => {
    it('strips trailing slash from baseUrl', () => {
      const c = new HttpClient({ baseUrl: 'http://localhost:5006/' })
      expect(c.baseUrl).toBe('http://localhost:5006')
    })
  })

  describe('ApiError helpers', () => {
    it('isUnauthorized returns true for 401', () => {
      const err = new ApiError(401, 'unauthorized')
      expect(err.isUnauthorized).toBe(true)
    })

    it('isNotFound returns true for 404', () => {
      const err = new ApiError(404, 'not-found')
      expect(err.isNotFound).toBe(true)
    })
  })
})
