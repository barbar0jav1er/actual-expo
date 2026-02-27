// Mock de expo-crypto para el entorno de tests (Node/vitest)
// En runtime (Hermes/React Native) se usa el módulo real de expo-crypto
export const randomUUID = () => crypto.randomUUID()
export const getRandomValues = <T extends ArrayBufferView>(array: T): T =>
  crypto.getRandomValues(array)
