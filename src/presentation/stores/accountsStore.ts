import { create } from 'zustand'
import type { AccountDTO } from '@application/dtos'
import type { GetAccounts } from '@application/use-cases/accounts'
import type { CreateAccount } from '@application/use-cases/accounts'
import type { UpdateAccount } from '@application/use-cases/accounts'
import type { CloseAccount } from '@application/use-cases/accounts'
import { useSyncStore } from './syncStore'

interface AccountsState {
  accounts: AccountDTO[]
  isLoading: boolean
  error: string | null
  selectedAccountId: string | null
}

interface AccountsActions {
  fetchAccounts: () => Promise<void>
  createAccount: (name: string, offbudget?: boolean, initialBalance?: number) => Promise<void>
  updateAccount: (id: string, name?: string, offbudget?: boolean) => Promise<void>
  closeAccount: (id: string, reopen?: boolean) => Promise<void>
  selectAccount: (id: string | null) => void
  getTotalBalance: () => number
}

interface AccountsStoreInternal extends AccountsState, AccountsActions {
  _getAccounts: GetAccounts | null
  _createAccount: CreateAccount | null
  _updateAccount: UpdateAccount | null
  _closeAccount: CloseAccount | null
}

export const useAccountsStore = create<AccountsStoreInternal>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,
  selectedAccountId: null,
  _getAccounts: null,
  _createAccount: null,
  _updateAccount: null,
  _closeAccount: null,

  fetchAccounts: async () => {
    const { _getAccounts } = get()
    if (!_getAccounts) return
    set({ isLoading: true, error: null })
    try {
      const { accounts } = await _getAccounts.execute()
      set({ accounts, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load accounts',
        isLoading: false,
      })
    }
  },

  createAccount: async (name: string, offbudget = false, initialBalance = 0) => {
    const { _createAccount, fetchAccounts } = get()
    if (!_createAccount) return
    set({ isLoading: true, error: null })
    try {
      await _createAccount.execute({ name, offbudget, initialBalance })
      await fetchAccounts()
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to create account',
        isLoading: false,
      })
      throw err
    }
  },

  updateAccount: async (id: string, name?: string, offbudget?: boolean) => {
    const { _updateAccount, fetchAccounts } = get()
    if (!_updateAccount) return
    try {
      await _updateAccount.execute({ id, name, offbudget })
      await fetchAccounts()
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update account' })
      throw err
    }
  },

  closeAccount: async (id: string, reopen = false) => {
    const { _closeAccount, fetchAccounts } = get()
    if (!_closeAccount) return
    try {
      await _closeAccount.execute({ id, reopen })
      await fetchAccounts()
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to close account' })
      throw err
    }
  },

  selectAccount: (id) => set({ selectedAccountId: id }),

  getTotalBalance: () => {
    const { accounts } = get()
    return accounts
      .filter((a) => !a.offbudget && !a.closed)
      .reduce((sum, a) => sum + a.balance, 0)
  },
}))

export function initializeAccountsStore(
  getAccounts: GetAccounts,
  createAccount: CreateAccount,
  updateAccount: UpdateAccount,
  closeAccount: CloseAccount
): void {
  useAccountsStore.setState({
    _getAccounts: getAccounts,
    _createAccount: createAccount,
    _updateAccount: updateAccount,
    _closeAccount: closeAccount,
  })
}
