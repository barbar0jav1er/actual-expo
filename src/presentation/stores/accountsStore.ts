import { create } from 'zustand'
import type { AccountDTO } from '@application/dtos'
import type { GetAccounts } from '@application/use-cases/accounts'
import type { CreateAccount } from '@application/use-cases/accounts'

interface AccountsState {
  accounts: AccountDTO[]
  isLoading: boolean
  error: string | null
  selectedAccountId: string | null
}

interface AccountsActions {
  fetchAccounts: () => Promise<void>
  createAccount: (name: string, offbudget?: boolean) => Promise<void>
  selectAccount: (id: string | null) => void
  getTotalBalance: () => number
}

interface AccountsStoreInternal extends AccountsState, AccountsActions {
  _getAccounts: GetAccounts | null
  _createAccount: CreateAccount | null
}

export const useAccountsStore = create<AccountsStoreInternal>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,
  selectedAccountId: null,
  _getAccounts: null,
  _createAccount: null,

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

  createAccount: async (name: string, offbudget = false) => {
    const { _createAccount, fetchAccounts } = get()
    if (!_createAccount) return
    set({ isLoading: true, error: null })
    try {
      await _createAccount.execute({ name, offbudget })
      await fetchAccounts()
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to create account',
        isLoading: false,
      })
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
  createAccount: CreateAccount
): void {
  useAccountsStore.setState({
    _getAccounts: getAccounts,
    _createAccount: createAccount,
  })
}
