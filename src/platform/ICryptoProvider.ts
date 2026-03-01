/**
 * Platform-agnostic crypto interface.
 * Works in Expo/Hermes (RN 0.71+), Bun, and Node 16+ via the global `crypto` Web API.
 */
export interface ICryptoProvider {
  randomUUID(): string
  getRandomValues(array: Uint8Array): Uint8Array
}
