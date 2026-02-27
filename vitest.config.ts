import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/domain/**', 'src/application/**'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@domain': '/src/domain',
      '@application': '/src/application',
      '@infrastructure': '/src/infrastructure',
      // expo-* usan react-native internamente, incompatible con Node/vitest
      'expo-crypto': '/src/test-mocks/expo-crypto.ts',
      'expo-secure-store': '/src/test-mocks/expo-secure-store.ts',
    },
  },
})
