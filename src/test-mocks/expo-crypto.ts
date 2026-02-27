// Mock de expo-crypto para el entorno de tests (Node/vitest)
// En runtime (Hermes/React Native) se usa el módulo real de expo-crypto
export const randomUUID = () => crypto.randomUUID()
