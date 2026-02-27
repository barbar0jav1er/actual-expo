import { describe, it, expect, vi, afterEach } from 'vitest'
import { ActualServerClient } from './ActualServerClient'
import { AuthEndpoints } from './endpoints/AuthEndpoints'
import { SyncEndpoints } from './endpoints/SyncEndpoints'
import { FileEndpoints } from './endpoints/FileEndpoints'

describe('ActualServerClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts unauthenticated', () => {
    const client = new ActualServerClient('http://localhost:5006')
    expect(client.isAuthenticated).toBe(false)
  })

  it('setToken marks client as authenticated', () => {
    const client = new ActualServerClient('http://localhost:5006')
    client.setToken('abc')
    expect(client.isAuthenticated).toBe(true)
  })

  it('clearToken removes authentication', () => {
    const client = new ActualServerClient('http://localhost:5006')
    client.setToken('abc')
    client.clearToken()
    expect(client.isAuthenticated).toBe(false)
  })

  it('auth returns AuthEndpoints', () => {
    const client = new ActualServerClient('http://localhost:5006')
    expect(client.auth).toBeInstanceOf(AuthEndpoints)
  })

  it('sync returns SyncEndpoints', () => {
    const client = new ActualServerClient('http://localhost:5006')
    expect(client.sync).toBeInstanceOf(SyncEndpoints)
  })

  it('files returns FileEndpoints', () => {
    const client = new ActualServerClient('http://localhost:5006')
    expect(client.files).toBeInstanceOf(FileEndpoints)
  })

  it('endpoints use the token set on the client', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', data: { token: 'server-token' } }),
    }))

    const client = new ActualServerClient('http://localhost:5006')
    const token = await client.auth.login('password')

    client.setToken(token)
    expect(client.isAuthenticated).toBe(true)
  })
})
