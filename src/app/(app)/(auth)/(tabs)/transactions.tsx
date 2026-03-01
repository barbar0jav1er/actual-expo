import React, { useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@/hooks/use-theme'
import { TransactionItem } from '@/presentation/components/transactions/TransactionItem'
import { TransactionForm } from '@/presentation/components/transactions/TransactionForm'
import { SwipeableRow, showConfirmDialog } from '@/presentation/components/common'
import { useTransactionsStore } from '@/presentation/stores'
import type { TransactionDTO } from '@application/dtos'

export default function TransactionsScreen() {
  const colors = useTheme()
  const router = useRouter()
  const { transactions, isLoading, fetchTransactions, createTransaction, deleteTransaction, filters } =
    useTransactionsStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [])

  const monthLabel = filters.month
    ? new Date(`${filters.month}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : 'All Transactions'

  function handleDeleteTransaction(tx: TransactionDTO) {
    showConfirmDialog({
      title: 'Delete Transaction',
      message: 'This transaction will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteTransaction(tx.id),
    })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      {/* Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}>
        <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
      </View>

      {/* Transaction list with swipe-to-delete */}
      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        refreshing={isLoading}
        onRefresh={fetchTransactions}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchTransactions} tintColor={colors.primary} colors={[colors.primary]} />
        }
        renderItem={({ item }) => (
          <SwipeableRow
            onDelete={() => handleDeleteTransaction(item)}
            onEdit={() => router.push(`/transaction/${item.id}`)}
          >
            <TransactionItem
              transaction={item}
              onPress={() => router.push(`/transaction/${item.id}`)}
            />
          </SwipeableRow>
        )}
        contentContainerStyle={[styles.listContent, { backgroundColor: colors.cardBackground }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSubdued }]}>
              Transactions for this period will appear here
            </Text>
          </View>
        }
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
  listContent: { paddingBottom: 100 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
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
