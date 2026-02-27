export interface EncryptedData {
  iv: string      // Base64
  authTag: string // Base64
  data: Uint8Array
}

export interface EncryptionMeta {
  keyId: string
  algorithm: 'aes-256-gcm'
  iv: string      // Base64
  authTag: string // Base64
}

export interface EncryptionService {
  encrypt(data: Uint8Array, key: CryptoKey): Promise<EncryptedData>
  decrypt(encrypted: EncryptedData, key: CryptoKey): Promise<Uint8Array>
}

export class AESEncryptionService implements EncryptionService {
  async encrypt(data: Uint8Array, key: CryptoKey): Promise<EncryptedData> {
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      data
    )

    // AES-GCM appends 16-byte auth tag at the end
    const encryptedArray = new Uint8Array(encrypted)
    const ciphertext = encryptedArray.slice(0, -16)
    const authTag = encryptedArray.slice(-16)

    return {
      iv: Buffer.from(iv).toString('base64'),
      authTag: Buffer.from(authTag).toString('base64'),
      data: ciphertext,
    }
  }

  async decrypt(encrypted: EncryptedData, key: CryptoKey): Promise<Uint8Array> {
    const iv = Buffer.from(encrypted.iv, 'base64')
    const authTag = Buffer.from(encrypted.authTag, 'base64')

    // Combine ciphertext + authTag for AES-GCM
    const combined = new Uint8Array(encrypted.data.length + authTag.length)
    combined.set(encrypted.data)
    combined.set(authTag, encrypted.data.length)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      combined
    )

    return new Uint8Array(decrypted)
  }
}
