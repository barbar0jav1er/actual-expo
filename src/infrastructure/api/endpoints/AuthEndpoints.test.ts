import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../HttpClient'
import { AuthEndpoints } from './AuthEndpoints'
import { ApiError } from '../types/ApiErrors'

function makeMockHttp(getResponse: unknown, postResponse?: unknown) {
  return {
    get: vi.fn().mockResolvedValue(getResponse),
    post: vi.fn().mockResolvedValue(postResponse ?? {}),
    postBinary: vi.fn(),
    baseUrl: 'http://localhost:5006',
  } as unknown as HttpClient
}

describe('AuthEndpoints', () => {
  let http: HttpClient
  let auth: AuthEndpoints
  const TOKEN = 'test-token-abc'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('returns token on success', async () => {
      http = makeMockHttp(undefined, { status: 'ok', data: { token: 'new-token' } })
      auth = new AuthEndpoints(http, () => null)

      const token = await auth.login('password123')

      expect(token).toBe('new-token')
      expect(http.post).toHaveBeenCalledWith('/account/login', { password: 'password123' })
    })

    it('propagates ApiError on failure', async () => {
      http = {
        post: vi.fn().mockRejectedValue(new ApiError(400, 'invalid-password')),
        get: vi.fn(),
        postBinary: vi.fn(),
        baseUrl: 'http://localhost:5006',
      } as unknown as HttpClient
      auth = new AuthEndpoints(http, () => null)

      await expect(auth.login('wrong')).rejects.toThrow(ApiError)
    })
  })

  describe('validate', () => {
    it('returns user info with auth header', async () => {
      const userInfo = {
        validated: true,
        userName: 'admin',
        permission: 'owner',
        userId: 'u-1',
        displayName: 'Admin',
        loginMethod: 'password',
      }
      http = makeMockHttp({ status: 'ok', data: userInfo })
      auth = new AuthEndpoints(http, () => TOKEN)

      const result = await auth.validate()

      expect(result.validated).toBe(true)
      expect(result.userName).toBe('admin')
      expect(http.get).toHaveBeenCalledWith('/account/validate', {
        headers: { 'x-actual-token': TOKEN },
      })
    })

    it('throws when no token is set', async () => {
      http = makeMockHttp({})
      auth = new AuthEndpoints(http, () => null)

      await expect(auth.validate()).rejects.toThrow('No auth token set')
    })
  })

  describe('needsBootstrap', () => {
    it('returns bootstrap info', async () => {
      const info = {
        bootstrapped: true,
        loginMethod: 'password',
        availableLoginMethods: [],
        multiuser: false,
      }
      http = makeMockHttp({ status: 'ok', data: info })
      auth = new AuthEndpoints(http, () => null)

      const result = await auth.needsBootstrap()

      expect(result.bootstrapped).toBe(true)
      expect(http.get).toHaveBeenCalledWith('/account/needs-bootstrap')
    })
  })

  describe('changePassword', () => {
    it('sends new password with auth header', async () => {
      http = makeMockHttp(undefined, { status: 'ok' })
      auth = new AuthEndpoints(http, () => TOKEN)

      await auth.changePassword('newpass')

      expect(http.post).toHaveBeenCalledWith(
        '/account/change-password',
        { password: 'newpass' },
        { headers: { 'x-actual-token': TOKEN } }
      )
    })

    it('throws when no token is set', async () => {
      http = makeMockHttp(undefined, {})
      auth = new AuthEndpoints(http, () => null)

      await expect(auth.changePassword('newpass')).rejects.toThrow('No auth token set')
    })
  })
})
