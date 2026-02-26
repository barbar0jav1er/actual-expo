# Subplan 10: Integracion Final y Polish

## Objetivo

Completar la aplicacion con funcionalidades finales, manejo de errores global, modo offline y testing E2E.

## Dependencias

- **Todos los subplanes anteriores**

## Archivos a Crear/Modificar

```
src/
├── presentation/
│   ├── providers/
│   │   ├── SyncProvider.tsx (update)
│   │   └── ErrorBoundary.tsx
│   ├── hooks/
│   │   ├── useNetworkStatus.ts
│   │   └── useBackgroundSync.ts
│   └── components/
│       └── common/
│           ├── SyncStatusBar.tsx
│           ├── OfflineBanner.tsx
│           └── Toast.tsx
├── infrastructure/
│   └── sync/
│       ├── BackgroundSyncManager.ts
│       └── OfflineQueue.ts
└── application/
    └── services/
        └── ErrorReportingService.ts

app/
├── (tabs)/
│   └── settings.tsx (complete)
└── +not-found.tsx

__tests__/
├── e2e/
│   ├── login.test.ts
│   ├── accounts.test.ts
│   ├── transactions.test.ts
│   ├── budget.test.ts
│   └── sync.test.ts
└── setup.ts
```

---

## Background Sync

### BackgroundSyncManager

```typescript
// src/infrastructure/sync/BackgroundSyncManager.ts
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'

const BACKGROUND_SYNC_TASK = 'background-sync'

class BackgroundSyncManager {
  private syncCoordinator: SyncCoordinator

  constructor(syncCoordinator: SyncCoordinator) {
    this.syncCoordinator = syncCoordinator
  }

  async register(): Promise<void> {
    // Definir la tarea
    TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
      try {
        await this.syncCoordinator.performSync()
        return BackgroundFetch.BackgroundFetchResult.NewData
      } catch (error) {
        console.error('Background sync failed:', error)
        return BackgroundFetch.BackgroundFetchResult.Failed
      }
    })

    // Registrar para ejecucion periodica
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60,  // 15 minutos
      stopOnTerminate: false,
      startOnBoot: true
    })
  }

  async unregister(): Promise<void> {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK)
  }

  async getStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
    return BackgroundFetch.getStatusAsync()
  }
}
```

### OfflineQueue

```typescript
// src/infrastructure/sync/OfflineQueue.ts
interface QueuedChange {
  id: string
  timestamp: string
  table: string
  row: string
  column: string
  value: string
  retryCount: number
}

class OfflineQueue {
  private queue: QueuedChange[] = []
  private storage: AsyncStorage

  constructor() {
    this.storage = AsyncStorage
  }

  async load(): Promise<void> {
    const stored = await this.storage.getItem('offline_queue')
    this.queue = stored ? JSON.parse(stored) : []
  }

  async save(): Promise<void> {
    await this.storage.setItem('offline_queue', JSON.stringify(this.queue))
  }

  async enqueue(change: Omit<QueuedChange, 'id' | 'retryCount'>): Promise<void> {
    this.queue.push({
      ...change,
      id: EntityId.create().toString(),
      retryCount: 0
    })
    await this.save()
  }

  async dequeue(): Promise<QueuedChange | null> {
    const item = this.queue.shift()
    if (item) {
      await this.save()
    }
    return item ?? null
  }

  async peek(): Promise<QueuedChange | null> {
    return this.queue[0] ?? null
  }

  async markFailed(id: string): Promise<void> {
    const item = this.queue.find(q => q.id === id)
    if (item) {
      item.retryCount++
      if (item.retryCount > 5) {
        // Demasiados reintentos, mover a dead letter
        this.queue = this.queue.filter(q => q.id !== id)
        // TODO: Guardar en dead letter queue
      }
      await this.save()
    }
  }

  get length(): number {
    return this.queue.length
  }

  get isEmpty(): boolean {
    return this.queue.length === 0
  }
}
```

---

## Network Status Hook

```typescript
// src/presentation/hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

interface NetworkStatus {
  isConnected: boolean
  isInternetReachable: boolean
  type: string
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown'
  })

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type
      })
    })

    return () => unsubscribe()
  }, [])

  return status
}
```

---

## Sync Status Components

### SyncStatusBar

```typescript
// src/presentation/components/common/SyncStatusBar.tsx
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'

interface SyncStatusBarProps {
  status: 'idle' | 'syncing' | 'success' | 'error'
  message?: string
  pendingChanges?: number
}

export function SyncStatusBar({
  status,
  message,
  pendingChanges = 0
}: SyncStatusBarProps) {
  const spinAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (status === 'syncing') {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true
        })
      ).start()
    } else {
      spinAnim.setValue(0)
    }
  }, [status])

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  })

  const getStatusColor = () => {
    switch (status) {
      case 'syncing': return '#3b82f6'
      case 'success': return '#22c55e'
      case 'error': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing': return 'sync'
      case 'success': return 'checkmark-circle'
      case 'error': return 'alert-circle'
      default: return 'cloud-outline'
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() }]}>
      <Animated.View style={{ transform: [{ rotate: status === 'syncing' ? spin : '0deg' }] }}>
        <Ionicons name={getStatusIcon()} size={16} color="white" />
      </Animated.View>

      <Text style={styles.text}>
        {message ?? (status === 'syncing' ? 'Syncing...' : 'Synced')}
      </Text>

      {pendingChanges > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingChanges}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500'
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600'
  }
})
```

### OfflineBanner

```typescript
// src/presentation/components/common/OfflineBanner.tsx
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'

interface OfflineBannerProps {
  visible: boolean
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const translateY = useRef(new Animated.Value(-50)).current

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -50,
      duration: 300,
      useNativeDriver: true
    }).start()
  }, [visible])

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
    >
      <Ionicons name="cloud-offline" size={16} color="white" />
      <Text style={styles.text}>
        You're offline. Changes will sync when connected.
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 1000
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500'
  }
})
```

---

## Error Handling

### ErrorBoundary

```typescript
// src/presentation/providers/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <View style={styles.container}>
          <Ionicons name="warning" size={64} color="#ef4444" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
})
```

---

## Settings Screen

```typescript
// app/(tabs)/settings.tsx
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore, useSyncStore } from '@/presentation/stores'
import { useNetworkStatus } from '@/presentation/hooks'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, serverUrl, logout } = useAuthStore()
  const { lastSync, pendingChanges, forceSync } = useSyncStore()
  const network = useNetworkStatus()

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout()
            router.replace('/login')
          }
        }
      ]
    )
  }

  const handleClearLocalData = () => {
    Alert.alert(
      'Clear Local Data',
      'This will delete all local data. You will need to re-sync from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // TODO: Implementar
          }
        }
      ]
    )
  }

  return (
    <ScrollView style={styles.container}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>User</Text>
            <Text style={styles.value}>{user?.displayName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Server</Text>
            <Text style={styles.value} numberOfLines={1}>
              {serverUrl}
            </Text>
          </View>
        </View>
      </View>

      {/* Sync Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              <Ionicons
                name={network.isConnected ? 'cloud-done' : 'cloud-offline'}
                size={16}
                color={network.isConnected ? '#22c55e' : '#f59e0b'}
              />
              <Text style={styles.value}>
                {network.isConnected ? 'Connected' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Last Sync</Text>
            <Text style={styles.value}>
              {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Pending Changes</Text>
            <Text style={styles.value}>{pendingChanges}</Text>
          </View>

          <Pressable
            style={styles.button}
            onPress={forceSync}
            disabled={!network.isConnected}
          >
            <Ionicons name="sync" size={20} color="white" />
            <Text style={styles.buttonText}>Sync Now</Text>
          </Pressable>
        </View>
      </View>

      {/* Data Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>

        <View style={styles.card}>
          <Pressable style={styles.dangerButton} onPress={handleClearLocalData}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.dangerButtonText}>Clear Local Data</Text>
          </Pressable>
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="white" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </View>

      {/* Version */}
      <Text style={styles.version}>
        Actual Budget Mobile v1.0.0
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  label: {
    fontSize: 14,
    color: '#6b7280'
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    maxWidth: '60%'
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    gap: 8
  },
  dangerButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600'
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    gap: 8
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  version: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 32,
    marginBottom: 48
  }
})
```

---

## E2E Tests

### Test Setup

```typescript
// __tests__/setup.ts
import { device, element, by, expect } from 'detox'

beforeAll(async () => {
  await device.launchApp()
})

beforeEach(async () => {
  await device.reloadReactNative()
})

export async function login(serverUrl: string, password: string) {
  await element(by.id('server-url-input')).typeText(serverUrl)
  await element(by.id('password-input')).typeText(password)
  await element(by.id('login-button')).tap()
  await waitFor(element(by.id('accounts-screen')))
    .toBeVisible()
    .withTimeout(10000)
}

export async function logout() {
  await element(by.id('settings-tab')).tap()
  await element(by.id('logout-button')).tap()
  await element(by.text('Logout')).tap()
}
```

### Login E2E Test

```typescript
// __tests__/e2e/login.test.ts
import { device, element, by, expect } from 'detox'
import { login, logout } from '../setup'

describe('Login Flow', () => {
  it('should login successfully with valid credentials', async () => {
    await login('http://localhost:5006', 'test-password')

    await expect(element(by.id('accounts-screen'))).toBeVisible()
  })

  it('should show error with invalid credentials', async () => {
    await element(by.id('server-url-input')).typeText('http://localhost:5006')
    await element(by.id('password-input')).typeText('wrong-password')
    await element(by.id('login-button')).tap()

    await expect(element(by.text('Login Failed'))).toBeVisible()
  })

  it('should logout successfully', async () => {
    await login('http://localhost:5006', 'test-password')
    await logout()

    await expect(element(by.id('login-screen'))).toBeVisible()
  })
})
```

### Sync E2E Test

```typescript
// __tests__/e2e/sync.test.ts
import { device, element, by, expect, waitFor } from 'detox'
import { login } from '../setup'

describe('Sync Flow', () => {
  beforeEach(async () => {
    await login('http://localhost:5006', 'test-password')
  })

  it('should sync data from server', async () => {
    // Esperar que el sync inicial complete
    await waitFor(element(by.id('sync-status-success')))
      .toBeVisible()
      .withTimeout(15000)

    // Verificar que hay datos
    await expect(element(by.id('account-list'))).toBeVisible()
  })

  it('should show offline indicator when disconnected', async () => {
    // Simular offline
    await device.setStatusBar({ networkDisabled: true })

    await expect(element(by.id('offline-banner'))).toBeVisible()

    // Restaurar
    await device.setStatusBar({ networkDisabled: false })
  })

  it('should sync new transaction to server', async () => {
    // Crear transaccion
    await element(by.id('transactions-tab')).tap()
    await element(by.id('add-transaction-button')).tap()

    await element(by.id('amount-input')).typeText('50.00')
    await element(by.id('save-button')).tap()

    // Verificar que se sincronizo
    await waitFor(element(by.id('sync-status-success')))
      .toBeVisible()
      .withTimeout(10000)
  })
})
```

---

## Verificacion Final

### Checklist de Lanzamiento

- [ ] Login/logout funciona correctamente
- [ ] Sync inicial descarga datos del servidor
- [ ] Crear/editar transacciones funciona
- [ ] Editar presupuestos funciona
- [ ] Cambios se sincronizan al servidor
- [ ] Modo offline muestra banner
- [ ] Cambios offline se guardan en cola
- [ ] Sync se reanuda al reconectar
- [ ] Settings muestra estado correcto
- [ ] Error boundary captura errores
- [ ] E2E tests pasan

### Performance Checklist

- [ ] Lista de transacciones carga rapido
- [ ] Scroll es fluido
- [ ] Sync no bloquea UI
- [ ] Memoria se mantiene estable
- [ ] App no crashea

### Compatibilidad

- [ ] Funciona en iOS
- [ ] Funciona en Android
- [ ] Compatible con servidor Actual existente
- [ ] Datos son compatibles con app web/desktop

---

## Tiempo Estimado

- Background Sync: 3-4 horas
- Offline Queue: 2-3 horas
- Network Status: 1-2 horas
- Sync Components: 2-3 horas
- Error Boundary: 1-2 horas
- Settings Screen: 2-3 horas
- E2E Test Setup: 2-3 horas
- E2E Tests: 4-5 horas
- Bug Fixes/Polish: 4-6 horas

**Total: 21-31 horas**

---

## Resumen Total del Proyecto

| Subplan | Horas Estimadas |
|---------|-----------------|
| 1. Fundacion | 10-15 |
| 2. Persistencia | 13-19 |
| 3. CRDT Sync | 17-23 |
| 4. API Client | 16-23 |
| 5. Use Cases | 20-26 |
| 6. Presupuestos | 14-19 |
| 7. UI Base | 20-27 |
| 8. UI Budget | 13-19 |
| 9. Rules/Schedules | 19-26 |
| 10. Integracion | 21-31 |

**Total Proyecto: 163-228 horas**
