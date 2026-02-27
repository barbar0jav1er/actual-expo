import { describe, it, expect, beforeAll } from 'vitest'
import { AESEncryptionService } from './AESEncryptionService'
import { KeyDerivation } from './KeyDerivation'

describe('AESEncryptionService', () => {
  let service: AESEncryptionService
  let key: CryptoKey

  beforeAll(async () => {
    service = new AESEncryptionService()
    const derived = await KeyDerivation.deriveKey('test-password', KeyDerivation.generateSalt())
    key = derived.raw
  })

  it('encrypts and decrypts data correctly', async () => {
    const original = new TextEncoder().encode('Hello, World!')

    const encrypted = await service.encrypt(original, key)
    const decrypted = await service.decrypt(encrypted, key)

    expect(new TextDecoder().decode(decrypted)).toBe('Hello, World!')
  })

  it('produces different IV for each encryption', async () => {
    const data = new TextEncoder().encode('test')
    const enc1 = await service.encrypt(data, key)
    const enc2 = await service.encrypt(data, key)
    expect(enc1.iv).not.toBe(enc2.iv)
  })

  it('encrypted result has iv, authTag, and data fields in base64/Uint8Array', async () => {
    const encrypted = await service.encrypt(new TextEncoder().encode('test'), key)
    expect(typeof encrypted.iv).toBe('string')
    expect(typeof encrypted.authTag).toBe('string')
    expect(encrypted.data).toBeInstanceOf(Uint8Array)
    // IV is 12 bytes → base64 should be 16 chars
    expect(Buffer.from(encrypted.iv, 'base64').length).toBe(12)
    // authTag is 16 bytes
    expect(Buffer.from(encrypted.authTag, 'base64').length).toBe(16)
  })

  it('decryption fails with wrong key', async () => {
    const data = new TextEncoder().encode('secret')
    const encrypted = await service.encrypt(data, key)

    const wrongDerived = await KeyDerivation.deriveKey('wrong', KeyDerivation.generateSalt())
    await expect(service.decrypt(encrypted, wrongDerived.raw)).rejects.toThrow()
  })

  it('encrypts empty data', async () => {
    const encrypted = await service.encrypt(new Uint8Array(0), key)
    const decrypted = await service.decrypt(encrypted, key)
    expect(decrypted).toHaveLength(0)
  })

  it('encrypts large binary data', async () => {
    const data = crypto.getRandomValues(new Uint8Array(1024 * 64))
    const encrypted = await service.encrypt(data, key)
    const decrypted = await service.decrypt(encrypted, key)
    expect(decrypted).toEqual(data)
  })
})
