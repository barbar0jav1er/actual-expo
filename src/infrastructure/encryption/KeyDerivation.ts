export interface DerivedKey {
  raw: CryptoKey    // Para usar en encrypt/decrypt
  base64: string    // Para persistir/transmitir
}

export class KeyDerivation {
  /**
   * Deriva una clave AES-256 desde un password usando PBKDF2-SHA512.
   * Parámetros idénticos al servidor Actual Budget para compatibilidad.
   */
  static async deriveKey(
    password: string,
    salt: string,
    iterations = 10000
  ): Promise<DerivedKey> {
    const encoder = new TextEncoder()
    const saltBytes = Buffer.from(salt, 'base64')

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    const raw = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-512',    // SHA-512 como el servidor original
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,                  // extractable: true para poder exportar a base64
      ['encrypt', 'decrypt']
    )

    const exported = await crypto.subtle.exportKey('raw', raw)
    const base64 = Buffer.from(exported).toString('base64')

    return { raw, base64 }
  }

  /**
   * Importa una clave desde su representación base64 (almacenada previamente).
   */
  static async importKey(base64: string): Promise<DerivedKey> {
    const raw = await crypto.subtle.importKey(
      'raw',
      Buffer.from(base64, 'base64'),
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    return { raw, base64 }
  }

  static generateSalt(): string {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    return Buffer.from(salt).toString('base64')
  }

  static generateKeyId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}
