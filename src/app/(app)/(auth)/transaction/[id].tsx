import React, { useEffect, useState } from 'react'
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/use-theme'
import { showConfirmDialog } from '@/presentation/components/common'
import {
  useTransactionsStore,
  useAccountsStore,
  useBudgetStore,
  usePayeesStore,
} from '@/presentation/stores'

export default function TransactionEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const colors = useTheme()

  const { transactions, updateTransaction, deleteTransaction } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { summary } = useBudgetStore()
  const { payees, fetchPayees } = usePayeesStore()

  const tx = transactions.find(t => t.id === id)

  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [accountId, setAccountId] = useState('')
  const [payeeId, setPayeeId] = useState<string | undefined>(undefined)
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [cleared, setCleared] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Flatten categories from budget summary
  const categories = summary?.groups.flatMap(g => g.categories) ?? []

  useEffect(() => {
    fetchPayees()
  }, [])

  useEffect(() => {
    if (tx) {
      setAmountText((Math.abs(tx.amount) / 100).toFixed(2))
      setDate(tx.date)
      setNotes(tx.notes ?? '')
      setAccountId(tx.accountId)
      setPayeeId(tx.payeeId)
      setCategoryId(tx.categoryId)
      setCleared(tx.cleared)
    }
  }, [tx?.id])

  async function handleSave() {
    if (!id) return
    const parsed = parseFloat(amountText.replace(',', '.'))
    if (isNaN(parsed)) {
      setError('Enter a valid amount')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await updateTransaction({
        id,
        amount: Math.round(parsed * 100) * (tx && tx.amount < 0 ? -1 : 1),
        date,
        notes: notes.trim() || null,
        payeeId: payeeId ?? null,
        categoryId: categoryId ?? null,
        cleared,
      })
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
    } finally {
      setLoading(false)
    }
  }

  function handleDelete() {
    if (!id) return
    showConfirmDialog({
      title: 'Delete Transaction',
      message: 'This transaction will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await deleteTransaction(id)
        router.back()
      },
    })
  }

  if (!tx) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
        <Text style={{ color: colors.textSubdued, padding: 24 }}>Transaction not found</Text>
      </SafeAreaView>
    )
  }

  const inputStyle = [styles.input, { backgroundColor: colors.cardBackground, color: colors.textPrimary, borderColor: colors.separator }]
  const labelStyle = [styles.label, { color: colors.textSubdued }]

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator, backgroundColor: colors.cardBackground }]}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.headerAction, { color: colors.textSubdued }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Transaction</Text>
          <Pressable onPress={handleSave} disabled={loading}>
            <Text style={[styles.headerAction, { color: colors.primary, fontWeight: '700' }]}>
              {loading ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={labelStyle}>Amount</Text>
          <TextInput
            style={inputStyle}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textSubdued}
          />

          <Text style={[labelStyle, { marginTop: 16 }]}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={inputStyle}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSubdued}
          />

          <Text style={[labelStyle, { marginTop: 16 }]}>Notes</Text>
          <TextInput
            style={inputStyle}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            placeholderTextColor={colors.textSubdued}
          />

          {/* Cleared toggle */}
          <Pressable
            style={[styles.toggleRow, { borderColor: colors.separator }]}
            onPress={() => setCleared(c => !c)}
          >
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Cleared</Text>
            <Ionicons
              name={cleared ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={cleared ? colors.primary : colors.textSubdued}
            />
          </Pressable>

          {/* Account picker */}
          <Text style={[labelStyle, { marginTop: 16 }]}>Account</Text>
          <View style={[styles.picker, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
            {accounts.map(a => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [
                  styles.pickerItem,
                  { borderBottomColor: colors.separator },
                  accountId === a.id && { backgroundColor: colors.primaryLight },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setAccountId(a.id)}
              >
                <Text style={[styles.pickerText, { color: colors.textPrimary }]}>{a.name}</Text>
                {accountId === a.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>

          {/* Payee picker */}
          <Text style={[labelStyle, { marginTop: 16 }]}>Payee</Text>
          <View style={[styles.picker, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
            <Pressable
              style={({ pressed }) => [
                styles.pickerItem,
                { borderBottomColor: colors.separator },
                !payeeId && { backgroundColor: colors.primaryLight },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setPayeeId(undefined)}
            >
              <Text style={[styles.pickerText, { color: colors.textSubdued }]}>No payee</Text>
              {!payeeId && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
            {payees.map(p => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.pickerItem,
                  { borderBottomColor: colors.separator },
                  payeeId === p.id && { backgroundColor: colors.primaryLight },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setPayeeId(p.id)}
              >
                <Text style={[styles.pickerText, { color: colors.textPrimary }]}>{p.name}</Text>
                {payeeId === p.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>

          {/* Category picker */}
          <Text style={[labelStyle, { marginTop: 16 }]}>Category</Text>
          <View style={[styles.picker, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}>
            <Pressable
              style={({ pressed }) => [
                styles.pickerItem,
                { borderBottomColor: colors.separator },
                !categoryId && { backgroundColor: colors.primaryLight },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setCategoryId(undefined)}
            >
              <Text style={[styles.pickerText, { color: colors.textSubdued }]}>No category</Text>
              {!categoryId && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
            {categories.map(c => (
              <Pressable
                key={c.categoryId}
                style={({ pressed }) => [
                  styles.pickerItem,
                  { borderBottomColor: colors.separator },
                  categoryId === c.categoryId && { backgroundColor: colors.primaryLight },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setCategoryId(c.categoryId)}
              >
                <Text style={[styles.pickerText, { color: colors.textPrimary }]}>{c.categoryName}</Text>
                {categoryId === c.categoryId && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>

          {error && <Text style={[styles.error, { color: colors.numberNegative }]}>{error}</Text>}

          {/* Delete */}
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, { borderColor: colors.numberNegative, opacity: pressed ? 0.7 : 1 }]}
            onPress={handleDelete}
          >
            <Text style={[styles.deleteBtnText, { color: colors.numberNegative }]}>Delete Transaction</Text>
          </Pressable>
        </ScrollView>
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
  form: { padding: 20, gap: 4, paddingBottom: 60 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  toggleLabel: { fontSize: 16 },
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
  error: { fontSize: 13, marginTop: 12 },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  deleteBtnText: { fontSize: 16, fontWeight: '600' },
})
