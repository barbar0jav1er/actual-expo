# Subplan 7: UI Base (Presentation Layer)

## Objetivo

Implementar las interfaces de usuario fundamentales usando Expo Router y Zustand.

## Dependencias

- **Subplan 5:** Use Cases Core

## Archivos a Crear

```
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── select-file.tsx
└── (tabs)/
    ├── _layout.tsx
    ├── accounts.tsx
    ├── transactions.tsx
    └── settings.tsx

src/
└── presentation/
    ├── providers/
    │   ├── AppProvider.tsx
    │   ├── AuthProvider.tsx
    │   ├── DatabaseProvider.tsx
    │   └── index.ts
    ├── stores/
    │   ├── authStore.ts
    │   ├── accountsStore.ts
    │   ├── transactionsStore.ts
    │   ├── syncStore.ts
    │   └── index.ts
    ├── hooks/
    │   ├── useAccounts.ts
    │   ├── useTransactions.ts
    │   ├── useAuth.ts
    │   ├── useSync.ts
    │   └── index.ts
    └── components/
        ├── common/
        │   ├── MoneyText.tsx
        │   ├── DateText.tsx
        │   ├── LoadingScreen.tsx
        │   ├── ErrorBoundary.tsx
        │   └── index.ts
        ├── accounts/
        │   ├── AccountList.tsx
        │   ├── AccountCard.tsx
        │   ├── AccountForm.tsx
        │   └── index.ts
        └── transactions/
            ├── TransactionList.tsx
            ├── TransactionItem.tsx
            ├── TransactionForm.tsx
            └── index.ts
```

---

## App Layout

### Root Layout

```typescript
// app/_layout.tsx
import { Slot } from 'expo-router'
import { AppProvider } from '@/presentation/providers'

export default function RootLayout() {
  return (
    <AppProvider>
      <Slot />
    </AppProvider>
  )
}
```

### Auth Layout

```typescript
// app/(auth)/_layout.tsx
import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="select-file" />
    </Stack>
  )
}
```

### Tabs Layout

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007AFF' }}>
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          )
        }}
      />
    </Tabs>
  )
}
```

---

## Providers

### AppProvider

```typescript
// src/presentation/providers/AppProvider.tsx
import { PropsWithChildren, useEffect, useState } from 'react'
import { AuthProvider } from './AuthProvider'
import { DatabaseProvider } from './DatabaseProvider'
import { LoadingScreen } from '../components/common'

export function AppProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    async function initialize() {
      // Inicializar base de datos, cargar token, etc.
      setIsReady(true)
    }
    initialize()
  }, [])

  if (!isReady) {
    return <LoadingScreen />
  }

  return (
    <DatabaseProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </DatabaseProvider>
  )
}
```

### AuthProvider

```typescript
// src/presentation/providers/AuthProvider.tsx
import { PropsWithChildren, useEffect } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '../stores'

export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter()
  const segments = useSegments()
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login')
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/accounts')
    }
  }, [isAuthenticated, segments, isLoading])

  return <>{children}</>
}
```

---

## Zustand Stores

### Auth Store

```typescript
// src/presentation/stores/authStore.ts
import { create } from 'zustand'
import { SecureTokenStorage } from '@/infrastructure/storage'
import { ActualServerClient } from '@/infrastructure/api'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: {
    userId: string
    userName: string
    displayName: string
  } | null
  serverUrl: string | null
  error: string | null

  // Actions
  checkAuth: () => Promise<void>
  login: (serverUrl: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setServerUrl: (url: string) => Promise<void>
}

const storage = new SecureTokenStorage()

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  serverUrl: null,
  error: null,

  checkAuth: async () => {
    try {
      const [token, serverUrl] = await Promise.all([
        storage.getToken(),
        storage.getServerUrl()
      ])

      if (!token || !serverUrl) {
        set({ isAuthenticated: false, isLoading: false })
        return
      }

      const client = new ActualServerClient(serverUrl)
      client.setToken(token)

      const userInfo = await client.auth.validate()

      set({
        isAuthenticated: true,
        isLoading: false,
        user: {
          userId: userInfo.userId,
          userName: userInfo.userName,
          displayName: userInfo.displayName
        },
        serverUrl
      })
    } catch (error) {
      await storage.clearToken()
      set({ isAuthenticated: false, isLoading: false, error: 'Session expired' })
    }
  },

  login: async (serverUrl: string, password: string) => {
    set({ isLoading: true, error: null })

    try {
      const client = new ActualServerClient(serverUrl)
      const token = await client.auth.login(password)

      await Promise.all([
        storage.saveToken(token),
        storage.saveServerUrl(serverUrl)
      ])

      client.setToken(token)
      const userInfo = await client.auth.validate()

      set({
        isAuthenticated: true,
        isLoading: false,
        user: {
          userId: userInfo.userId,
          userName: userInfo.userName,
          displayName: userInfo.displayName
        },
        serverUrl
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      })
      throw error
    }
  },

  logout: async () => {
    await storage.clearToken()
    set({
      isAuthenticated: false,
      user: null,
      error: null
    })
  },

  setServerUrl: async (url: string) => {
    await storage.saveServerUrl(url)
    set({ serverUrl: url })
  }
}))
```

### Accounts Store

```typescript
// src/presentation/stores/accountsStore.ts
import { create } from 'zustand'
import { AccountDTO } from '@/application/dtos'
import { GetAccounts, CreateAccount } from '@/application/use-cases/accounts'

interface AccountsState {
  accounts: AccountDTO[]
  isLoading: boolean
  error: string | null
  selectedAccountId: string | null

  // Actions
  fetchAccounts: () => Promise<void>
  createAccount: (name: string, offbudget?: boolean) => Promise<void>
  selectAccount: (id: string | null) => void
  getAccountById: (id: string) => AccountDTO | undefined
  getTotalBalance: () => number
}

// Use cases se inyectan en runtime
let getAccountsUseCase: GetAccounts
let createAccountUseCase: CreateAccount

export function initializeAccountsStore(
  getAccounts: GetAccounts,
  createAccount: CreateAccount
) {
  getAccountsUseCase = getAccounts
  createAccountUseCase = createAccount
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,
  selectedAccountId: null,

  fetchAccounts: async () => {
    set({ isLoading: true, error: null })

    try {
      const result = await getAccountsUseCase.execute()
      set({ accounts: result.accounts, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch accounts'
      })
    }
  },

  createAccount: async (name: string, offbudget = false) => {
    try {
      await createAccountUseCase.execute({ name, offbudget })
      await get().fetchAccounts()  // Refresh list
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create account'
      })
      throw error
    }
  },

  selectAccount: (id: string | null) => {
    set({ selectedAccountId: id })
  },

  getAccountById: (id: string) => {
    return get().accounts.find(a => a.id === id)
  },

  getTotalBalance: () => {
    return get().accounts
      .filter(a => !a.offbudget)
      .reduce((sum, a) => sum + a.balance, 0)
  }
}))
```

### Transactions Store

```typescript
// src/presentation/stores/transactionsStore.ts
import { create } from 'zustand'
import { TransactionDTO } from '@/application/dtos'
import {
  GetTransactions,
  CreateTransaction
} from '@/application/use-cases/transactions'

interface TransactionsState {
  transactions: TransactionDTO[]
  isLoading: boolean
  error: string | null

  // Filters
  filters: {
    accountId?: string
    month?: string
    startDate?: string
    endDate?: string
  }

  // Actions
  fetchTransactions: () => Promise<void>
  createTransaction: (data: CreateTransactionData) => Promise<void>
  setFilters: (filters: Partial<TransactionsState['filters']>) => void
  clearFilters: () => void
}

interface CreateTransactionData {
  accountId: string
  amount: number
  date: string
  categoryId?: string
  payeeId?: string
  notes?: string
}

let getTransactionsUseCase: GetTransactions
let createTransactionUseCase: CreateTransaction

export function initializeTransactionsStore(
  getTransactions: GetTransactions,
  createTransaction: CreateTransaction
) {
  getTransactionsUseCase = getTransactions
  createTransactionUseCase = createTransaction
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  filters: {},

  fetchTransactions: async () => {
    const { filters } = get()
    set({ isLoading: true, error: null })

    try {
      const result = await getTransactionsUseCase.execute(filters)
      set({ transactions: result.transactions, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch'
      })
    }
  },

  createTransaction: async (data: CreateTransactionData) => {
    try {
      await createTransactionUseCase.execute(data)
      await get().fetchTransactions()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create'
      })
      throw error
    }
  },

  setFilters: (newFilters) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }))
  },

  clearFilters: () => {
    set({ filters: {} })
  }
}))
```

---

## Components

### MoneyText

```typescript
// src/presentation/components/common/MoneyText.tsx
import { Text, TextProps, StyleSheet } from 'react-native'
import { Money } from '@/domain/value-objects'

interface MoneyTextProps extends TextProps {
  cents: number
  showSign?: boolean
  colorize?: boolean
}

export function MoneyText({
  cents,
  showSign = false,
  colorize = true,
  style,
  ...props
}: MoneyTextProps) {
  const money = Money.fromCents(cents)
  const formatted = money.format()

  const displayText = showSign && cents > 0 ? `+${formatted}` : formatted

  const textStyle = colorize
    ? cents < 0
      ? styles.negative
      : cents > 0
        ? styles.positive
        : styles.neutral
    : undefined

  return (
    <Text style={[textStyle, style]} {...props}>
      {displayText}
    </Text>
  )
}

const styles = StyleSheet.create({
  positive: { color: '#22c55e' },
  negative: { color: '#ef4444' },
  neutral: { color: '#6b7280' }
})
```

### AccountList

```typescript
// src/presentation/components/accounts/AccountList.tsx
import { FlatList, RefreshControl, StyleSheet, View, Text } from 'react-native'
import { AccountDTO } from '@/application/dtos'
import { AccountCard } from './AccountCard'

interface AccountListProps {
  accounts: AccountDTO[]
  isLoading: boolean
  onRefresh: () => void
  onAccountPress: (account: AccountDTO) => void
}

export function AccountList({
  accounts,
  isLoading,
  onRefresh,
  onAccountPress
}: AccountListProps) {
  if (accounts.length === 0 && !isLoading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No accounts yet</Text>
        <Text style={styles.emptySubtext}>
          Create your first account to get started
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      data={accounts}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <AccountCard
          account={item}
          onPress={() => onAccountPress(item)}
        />
      )}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
      }
      contentContainerStyle={styles.list}
    />
  )
}

const styles = StyleSheet.create({
  list: {
    padding: 16
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8
  }
})
```

### AccountCard

```typescript
// src/presentation/components/accounts/AccountCard.tsx
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { AccountDTO } from '@/application/dtos'
import { MoneyText } from '../common'

interface AccountCardProps {
  account: AccountDTO
  onPress: () => void
}

export function AccountCard({ account, onPress }: AccountCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
      onPress={onPress}
    >
      <View style={styles.info}>
        <Text style={styles.name}>{account.name}</Text>
        {account.offbudget && (
          <Text style={styles.badge}>Off Budget</Text>
        )}
      </View>
      <MoneyText cents={account.balance} style={styles.balance} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  cardPressed: {
    opacity: 0.7
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  badge: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4
  },
  balance: {
    fontSize: 18,
    fontWeight: '700'
  }
})
```

### TransactionItem

```typescript
// src/presentation/components/transactions/TransactionItem.tsx
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { TransactionDTO } from '@/application/dtos'
import { MoneyText, DateText } from '../common'

interface TransactionItemProps {
  transaction: TransactionDTO
  onPress: () => void
}

export function TransactionItem({ transaction, onPress }: TransactionItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        pressed && styles.itemPressed
      ]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <Text style={styles.payee}>
          {transaction.payeeName ?? 'No payee'}
        </Text>
        <Text style={styles.category}>
          {transaction.categoryName ?? 'Uncategorized'}
        </Text>
        {transaction.notes && (
          <Text style={styles.notes} numberOfLines={1}>
            {transaction.notes}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        <MoneyText cents={transaction.amount} style={styles.amount} />
        <Text style={styles.date}>{transaction.date}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  itemPressed: {
    backgroundColor: '#f9fafb'
  },
  left: {
    flex: 1
  },
  right: {
    alignItems: 'flex-end'
  },
  payee: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937'
  },
  category: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2
  },
  notes: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4
  },
  amount: {
    fontSize: 16,
    fontWeight: '600'
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4
  }
})
```

---

## Screens

### Login Screen

```typescript
// app/(auth)/login.tsx
import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert
} from 'react-native'
import { useAuthStore } from '@/presentation/stores'

export default function LoginScreen() {
  const [serverUrl, setServerUrl] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error } = useAuthStore()

  const handleLogin = async () => {
    if (!serverUrl.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    try {
      await login(serverUrl.trim(), password)
    } catch (error) {
      Alert.alert('Login Failed', error.message)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Actual Budget</Text>
      <Text style={styles.subtitle}>Connect to your server</Text>

      <TextInput
        style={styles.input}
        placeholder="Server URL"
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Connecting...' : 'Connect'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f9fafb'
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1f2937'
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  error: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16
  }
})
```

### Accounts Screen

```typescript
// app/(tabs)/accounts.tsx
import { useEffect } from 'react'
import { View, StyleSheet, Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAccountsStore } from '@/presentation/stores'
import { AccountList, MoneyText } from '@/presentation/components'

export default function AccountsScreen() {
  const router = useRouter()
  const {
    accounts,
    isLoading,
    fetchAccounts,
    getTotalBalance
  } = useAccountsStore()

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleAccountPress = (account: AccountDTO) => {
    router.push(`/account/${account.id}`)
  }

  const handleAddAccount = () => {
    // Abrir modal o navegar a form
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.totalLabel}>Total Balance</Text>
        <MoneyText
          cents={getTotalBalance()}
          style={styles.totalAmount}
        />
      </View>

      <AccountList
        accounts={accounts}
        isLoading={isLoading}
        onRefresh={fetchAccounts}
        onAccountPress={handleAccountPress}
      />

      <Pressable style={styles.fab} onPress={handleAddAccount}>
        <Ionicons name="add" size={24} color="white" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 24,
    alignItems: 'center'
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14
  },
  totalAmount: {
    color: 'white',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  }
})
```

---

## Verificacion

### Criterios de Exito

- [ ] Login funciona y guarda token
- [ ] Navigation entre auth y tabs funciona
- [ ] AccountsScreen muestra lista de cuentas
- [ ] TransactionsScreen muestra transacciones
- [ ] Refresh/pull-to-refresh funciona
- [ ] Stores manejan estado correctamente

---

## Tiempo Estimado

- App Layout + Navigation: 2-3 horas
- Providers: 2-3 horas
- Zustand Stores: 4-5 horas
- Common Components: 2-3 horas
- Account Components: 3-4 horas
- Transaction Components: 3-4 horas
- Screens: 4-5 horas

**Total: 20-27 horas**
