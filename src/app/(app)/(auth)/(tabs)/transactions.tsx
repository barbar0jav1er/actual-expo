import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/use-theme'
import { TransactionList, TransactionForm } from '@/presentation/components/transactions'
import { useTransactionsStore } from '@/presentation/stores'

export default function TransactionsScreen() {
  const colors = useTheme()
  const { transactions, isLoading, fetchTransactions, createTransaction, filters } =
    useTransactionsStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [])

  const monthLabel = filters.month
    ? new Date(`${filters.month}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : 'All Transactions'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      {/* Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}>
        <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
      </View>

      {/* Transaction list */}
      <TransactionList
        transactions={transactions}
        refreshing={isLoading}
        onRefresh={fetchTransactions}
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => setShowForm(true)}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* Add Transaction Modal */}
      <TransactionForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={(data) => createTransaction(data)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthLabel: { fontSize: 17, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
})
