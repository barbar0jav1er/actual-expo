import type { ICryptoProvider } from './ICryptoProvider'

/**
 * Default crypto implementation using the Web Crypto API global.
 * Available in:
 *   - Expo SDK 49+ with Hermes (React Native 0.71+)
 *   - Bun (built-in)
 *   - Node 16+ (built-in)
 */
export class WebCryptoProvider implements ICryptoProvider {
  randomUUID(): string {
    return crypto.randomUUID()
  }

  getRandomValues(array: Uint8Array): Uint8Array {
    return crypto.getRandomValues(array)
  }
}
