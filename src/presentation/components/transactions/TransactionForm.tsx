import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { Button } from '../common/Button'
import { useTheme } from '@/hooks/use-theme'
import { useAccountsStore } from '../../stores'

interface TransactionFormProps {
  visible: boolean
  onClose: () => void
  onSubmit: (data: {
    accountId: string
    amount: number
    date: string
    notes?: string
  }) => Promise<void>
}

function todayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TransactionForm({ visible, onClose, onSubmit }: TransactionFormProps) {
  const colors = useTheme()
  const accounts = useAccountsStore((s) => s.accounts)

  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState(todayString)
  const [accountId, setAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setAmountText('')
    setDate(todayString())
    setAccountId('')
    setNotes('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    const parsed = parseFloat(amountText.replace(',', '.'))
    if (isNaN(parsed)) {
      setError('Enter a valid amount')
      return
    }
    if (!accountId) {
      setError('Select an account')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        accountId,
        amount: Math.round(parsed * 100),
        date,
        notes: notes.trim() || undefined,
      })
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.pageBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <Pressable onPress={handleClose}>
            <Text style={[styles.cancel, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.textPrimary }]}>New Transaction</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.textSubdued }]}>Amount</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.textPrimary, borderColor: colors.separator }]}
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            placeholderTextColor={colors.textSubdued}
            keyboardType="decimal-pad"
            autoFocus
          />

          <Text style={[styles.label, { color: colors.textSubdued, marginTop: 12 }]}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.textPrimary, borderColor: colors.separator }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSubdued}
          />

          <Text style={[styles.label, { color: colors.textSubdued, marginTop: 12 }]}>Account</Text>
          <View style={[styles.picker, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
            {accounts.length === 0 ? (
              <Text style={{ color: colors.textSubdued, padding: 10 }}>No accounts available</Text>
            ) : (
              accounts.map((account) => (
                <Pressable
                  key={account.id}
                  style={({ pressed }) => [
                    styles.pickerItem,
                    { borderBottomColor: colors.separator },
                    accountId === account.id && { backgroundColor: colors.primaryLight },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setAccountId(account.id)}
                >
                  <Text style={[styles.pickerText, { color: colors.textPrimary }]}>{account.name}</Text>
                  {accountId === account.id && (
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>✓</Text>
                  )}
                </Pressable>
              ))
            )}
          </View>

          <Text style={[styles.label, { color: colors.textSubdued, marginTop: 12 }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.textPrimary, borderColor: colors.separator }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note..."
            placeholderTextColor={colors.textSubdued}
          />

          {error && <Text style={[styles.error, { color: colors.numberNegative }]}>{error}</Text>}

          <Button onPress={handleSubmit} loading={loading} size="lg" style={{ marginTop: 24 }}>
            Add Transaction
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '600' },
  cancel: { fontSize: 16, width: 56 },
  form: { padding: 24, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 4,
  },
  picker: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerText: { fontSize: 15 },
  error: { fontSize: 13, marginTop: 8 },
})
