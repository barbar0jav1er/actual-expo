import { create } from 'zustand'
import type { TransactionDTO } from '@application/dtos'
import type { GetTransactions, GetTransactionsInput } from '@application/use-cases/transactions'
import type { CreateTransaction, CreateTransactionInput } from '@application/use-cases/transactions'
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
  setFilters: (filters: GetTransactionsInput) => void
  clearFilters: () => void
}

interface TransactionsStoreInternal extends TransactionsState, TransactionsActions {
  _getTransactions: GetTransactions | null
  _createTransaction: CreateTransaction | null
}

export const useTransactionsStore = create<TransactionsStoreInternal>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  filters: {},
  _getTransactions: null,
  _createTransaction: null,

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

  setFilters: (filters) => set({ filters }),

  clearFilters: () => set({ filters: {} }),
}))

export function initializeTransactionsStore(
  getTransactions: GetTransactions,
  createTransaction: CreateTransaction
): void {
  useTransactionsStore.setState({
    _getTransactions: getTransactions,
    _createTransaction: createTransaction,
  })
}
