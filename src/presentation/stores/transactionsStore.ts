import { create } from 'zustand'
import type { TransactionDTO } from '@application/dtos'
import type { GetTransactions, GetTransactionsInput } from '@application/use-cases/transactions'
import type { CreateTransaction, CreateTransactionInput } from '@application/use-cases/transactions'
import type { UpdateTransaction, UpdateTransactionInput } from '@application/use-cases/transactions'
import type { DeleteTransaction } from '@application/use-cases/transactions'
import { useAccountsStore } from './accountsStore'

interface TransactionsState {
  transactions: TransactionDTO[]
  isLoading: boolean
  error: string | null
  filters: GetTransactionsInput
}

interface TransactionsActions {
  fetchTransactions: () => Promise<void>
  createTransaction: (data: CreateTransactionInput) => Promise<void>
  updateTransaction: (data: UpdateTransactionInput) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  setFilters: (filters: GetTransactionsInput) => void
  clearFilters: () => void
}

interface TransactionsStoreInternal extends TransactionsState, TransactionsActions {
  _getTransactions: GetTransactions | null
  _createTransaction: CreateTransaction | null
  _updateTransaction: UpdateTransaction | null
  _deleteTransaction: DeleteTransaction | null
}

export const useTransactionsStore = create<TransactionsStoreInternal>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  filters: {},
  _getTransactions: null,
  _createTransaction: null,
  _updateTransaction: null,
  _deleteTransaction: null,

  fetchTransactions: async () => {
    const { _getTransactions, filters } = get()
    if (!_getTransactions) return
    set({ isLoading: true, error: null })
    try {
      const { transactions } = await _getTransactions.execute(filters)
      set({ transactions, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load transactions',
        isLoading: false,
      })
    }
  },

  createTransaction: async (data) => {
    const { _createTransaction, fetchTransactions } = get()
    if (!_createTransaction) return
    set({ isLoading: true, error: null })
    try {
      await _createTransaction.execute(data)
      await fetchTransactions()
      await useAccountsStore.getState().fetchAccounts()
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to create transaction',
        isLoading: false,
      })
      throw err
    }
  },

  updateTransaction: async (data) => {
    const { _updateTransaction, fetchTransactions } = get()
    if (!_updateTransaction) return
    try {
      await _updateTransaction.execute(data)
      await fetchTransactions()
      await useAccountsStore.getState().fetchAccounts()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update transaction' })
      throw err
    }
  },

  deleteTransaction: async (id: string) => {
    const { _deleteTransaction, fetchTransactions } = get()
    if (!_deleteTransaction) return
    try {
      await _deleteTransaction.execute({ id })
      await fetchTransactions()
      await useAccountsStore.getState().fetchAccounts()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete transaction' })
      throw err
    }
  },

  setFilters: (filters) => set({ filters }),

  clearFilters: () => set({ filters: {} }),
}))

export function initializeTransactionsStore(
  getTransactions: GetTransactions,
  createTransaction: CreateTransaction,
  updateTransaction: UpdateTransaction,
  deleteTransaction: DeleteTransaction
): void {
  useTransactionsStore.setState({
    _getTransactions: getTransactions,
    _createTransaction: createTransaction,
    _updateTransaction: updateTransaction,
    _deleteTransaction: deleteTransaction,
  })
}
