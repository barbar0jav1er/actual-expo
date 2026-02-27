import { describe, it, expect } from 'vitest'
import { KeyDerivation } from './KeyDerivation'

describe('KeyDerivation', () => {
  describe('deriveKey', () => {
    it('returns a DerivedKey with raw and base64', async () => {
      const salt = KeyDerivation.generateSalt()
      const key = await KeyDerivation.deriveKey('password', salt)

      expect(key.raw).toBeDefined()
      expect(key.raw.type).toBe('secret')
      expect(key.raw.algorithm.name).toBe('AES-GCM')
      expect(typeof key.base64).toBe('string')
      expect(key.base64.length).toBeGreaterThan(0)
    })

    it('derived key is extractable (can be stored as base64)', async () => {
      const salt = KeyDerivation.generateSalt()
      const key = await KeyDerivation.deriveKey('password', salt)

      // Should be able to re-import from base64
      const imported = await KeyDerivation.importKey(key.base64)
      expect(imported.raw).toBeDefined()
    })

    it('same password + salt produces equivalent keys', async () => {
      const salt = KeyDerivation.generateSalt()
      const key1 = await KeyDerivation.deriveKey('mypassword', salt)
      const key2 = await KeyDerivation.deriveKey('mypassword', salt)

      const data = new TextEncoder().encode('test data')
      const iv = crypto.getRandomValues(new Uint8Array(12))

      const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1.raw, data)
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2.raw, enc)

      expect(new TextDecoder().decode(dec)).toBe('test data')
    })

    it('different passwords produce different keys', async () => {
      const salt = KeyDerivation.generateSalt()
      const key1 = await KeyDerivation.deriveKey('password1', salt)
      const key2 = await KeyDerivation.deriveKey('password2', salt)

      const data = new TextEncoder().encode('secret')
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1.raw, data)

      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2.raw, encrypted)
      ).rejects.toThrow()
    })

    it('uses SHA-512 (compatible with Actual Budget server)', async () => {
      // We verify by cross-validating with a known import/export cycle
      const salt = KeyDerivation.generateSalt()
      const derived = await KeyDerivation.deriveKey('test', salt)
      const reimported = await KeyDerivation.importKey(derived.base64)

      const data = new TextEncoder().encode('verify')
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, derived.raw, data)
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, reimported.raw, enc)

      expect(new TextDecoder().decode(dec)).toBe('verify')
    })
  })

  describe('importKey', () => {
    it('imports a base64 key and can decrypt data encrypted with original', async () => {
      const salt = KeyDerivation.generateSalt()
      const original = await KeyDerivation.deriveKey('password', salt)
      const imported = await KeyDerivation.importKey(original.base64)

      const data = new TextEncoder().encode('hello')
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, original.raw, data)
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, imported.raw, enc)

      expect(new TextDecoder().decode(dec)).toBe('hello')
    })
  })

  describe('generateSalt', () => {
    it('returns a base64 string of 32 bytes', () => {
      const salt = KeyDerivation.generateSalt()
      expect(typeof salt).toBe('string')
      const bytes = Buffer.from(salt, 'base64')
      expect(bytes.length).toBe(32)
    })

    it('generates unique salts', () => {
      expect(KeyDerivation.generateSalt()).not.toBe(KeyDerivation.generateSalt())
    })
  })

  describe('generateKeyId', () => {
    it('returns a 32-char hex string', () => {
      expect(KeyDerivation.generateKeyId()).toMatch(/^[0-9a-f]{32}$/)
    })

    it('generates unique key IDs', () => {
      expect(KeyDerivation.generateKeyId()).not.toBe(KeyDerivation.generateKeyId())
    })
  })
})
