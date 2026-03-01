import React, { useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/use-theme'
import { TransactionItem } from '@/presentation/components/transactions/TransactionItem'
import { TransactionForm } from '@/presentation/components/transactions/TransactionForm'
import { SwipeableRow, showConfirmDialog } from '@/presentation/components/common'
import { useAccountsStore, useTransactionsStore } from '@/presentation/stores'
import type { TransactionDTO } from '@application/dtos'

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const colors = useTheme()

  const { accounts, updateAccount, closeAccount } = useAccountsStore()
  const {
    transactions,
    isLoading,
    fetchTransactions,
    deleteTransaction,
    setFilters,
    createTransaction,
  } = useTransactionsStore()

  const account = accounts.find(a => a.id === id)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(account?.name ?? '')

  useEffect(() => {
    if (id) {
      setFilters({ accountId: id })
      fetchTransactions()
    }
    return () => {
      // Reset filters when leaving account detail
      setFilters({})
    }
  }, [id])

  const accountTransactions = transactions.filter(t => t.accountId === id)

  function handleSaveName() {
    if (!nameInput.trim() || !id) return
    updateAccount(id, nameInput.trim())
    setEditingName(false)
  }

  function handleToggleClose() {
    if (!account || !id) return
    const msg = account.closed
      ? 'Reopen this account?'
      : 'Close this account? It will be hidden from the main accounts list.'
    showConfirmDialog({
      title: account.closed ? 'Reopen Account' : 'Close Account',
      message: msg,
      confirmLabel: account.closed ? 'Reopen' : 'Close',
      destructive: !account.closed,
      onConfirm: () => closeAccount(id, account.closed),
    })
  }

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
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBackground }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator, backgroundColor: colors.cardBackground }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>

        {editingName ? (
          <TextInput
            style={[styles.nameInput, { color: colors.textPrimary, borderColor: colors.separator }]}
            value={nameInput}
            onChangeText={setNameInput}
            onBlur={handleSaveName}
            onSubmitEditing={handleSaveName}
            autoFocus
          />
        ) : (
          <Pressable onPress={() => { setNameInput(account?.name ?? ''); setEditingName(true) }} style={styles.nameRow}>
            <Text style={[styles.accountName, { color: colors.textPrimary }]} numberOfLines={1}>
              {account?.name ?? 'Account'}
            </Text>
            <Ionicons name="pencil" size={14} color={colors.textSubdued} />
          </Pressable>
        )}

        <Pressable onPress={handleToggleClose} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: account?.closed ? colors.primary : colors.numberNegative }]}>
            {account?.closed ? 'Reopen' : 'Close'}
          </Text>
        </Pressable>
      </View>

      {/* Transaction list */}
      <FlatList
        data={accountTransactions}
        keyExtractor={item => item.id}
        refreshing={isLoading}
        onRefresh={fetchTransactions}
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSubdued }]}>
              No transactions yet
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
        onPress={() => setShowAddForm(true)}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* Add Transaction Modal */}
      <TransactionForm
        visible={showAddForm}
        initialAccountId={id}
        onClose={() => setShowAddForm(false)}
        onSubmit={(data) => createTransaction(data)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  backBtn: { padding: 8 },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  accountName: { fontSize: 17, fontWeight: '600', flex: 1 },
  nameInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 4,
  },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 14, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16 },
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
