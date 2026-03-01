import React, { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTheme } from '@/hooks/use-theme'
import { showConfirmDialog } from '@/presentation/components/common'
import { usePayeesStore } from '@/presentation/stores'

export default function PayeeEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const colors = useTheme()

  const { payees, updatePayee, deletePayee } = usePayeesStore()
  const payee = payees.find(p => p.id === id)

  const [name, setName] = useState(payee?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (payee) setName(payee.name)
  }, [payee?.id])

  async function handleSave() {
    if (!id || !name.trim()) {
      setError('Name cannot be empty')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updatePayee(id, name.trim())
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payee')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (!id) return
    showConfirmDialog({
      title: 'Delete Payee',
      message: `Delete "${payee?.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await deletePayee(id)
        router.back()
      },
    })
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.cardBackground, color: colors.textPrimary, borderColor: colors.separator },
  ]

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator, backgroundColor: colors.cardBackground }]}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.headerAction, { color: colors.textSubdued }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Payee</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={[styles.headerAction, { color: colors.primary, fontWeight: '700' }]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.label, { color: colors.textSubdued }]}>Name</Text>
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="Payee name"
            placeholderTextColor={colors.textSubdued}
            autoFocus
          />

          {error && <Text style={[styles.error, { color: colors.numberNegative }]}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.deleteBtn, { borderColor: colors.numberNegative, opacity: pressed ? 0.7 : 1 }]}
            onPress={handleDelete}
          >
            <Text style={[styles.deleteBtnText, { color: colors.numberNegative }]}>Delete Payee</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerAction: { fontSize: 16 },
  body: { padding: 24 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { fontSize: 13, marginTop: 8 },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 40,
  },
  deleteBtnText: { fontSize: 16, fontWeight: '600' },
})
