import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/presentation/components/common'
import { useAuthStore } from '@/presentation/stores'

export default function LoginScreen() {
  const colors = useTheme()
  const { login, isLoading, error } = useAuthStore()

  const [serverUrl, setServerUrl] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleLogin() {
    setLocalError(null)
    if (!serverUrl.trim()) {
      setLocalError('Server URL is required')
      return
    }
    if (!password) {
      setLocalError('Password is required')
      return
    }
    try {
      await login(serverUrl.trim(), password)
    } catch {
      // error is set in the store
    }
  }

  const displayError = localError ?? error

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>Actual Budget</Text>
            <Text style={[styles.subtitle, { color: colors.textSubdued }]}>
              Connect to your self-hosted server
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
            <Text style={[styles.label, { color: colors.textSubdued }]}>Server URL</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.separator, backgroundColor: colors.pageBackground }]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://your-server.com"
              placeholderTextColor={colors.textSubdued}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />

            <Text style={[styles.label, { color: colors.textSubdued, marginTop: 16 }]}>Password</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.separator, backgroundColor: colors.pageBackground }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={colors.textSubdued}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {displayError && (
              <Text style={[styles.error, { color: colors.numberNegative }]}>{displayError}</Text>
            )}

            <Button
              onPress={handleLogin}
              loading={isLoading}
              size="lg"
              style={{ marginTop: 24 }}
            >
              Connect
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 24,
  },
  header: { alignItems: 'center', gap: 8 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#ffffff', fontSize: 32, fontWeight: '700' },
  appName: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  subtitle: { fontSize: 14 },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 6,
  },
  error: { fontSize: 13, marginTop: 12 },
})
