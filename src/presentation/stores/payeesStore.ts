import { create } from 'zustand'
import type { PayeeDTO } from '@application/dtos'
import type { GetPayees } from '@application/use-cases/payees/GetPayees'
import type { CreatePayee } from '@application/use-cases/payees/CreatePayee'
import type { UpdatePayee } from '@application/use-cases/payees/UpdatePayee'
import type { DeletePayee } from '@application/use-cases/payees/DeletePayee'
import type { MergePayees } from '@application/use-cases/payees/MergePayees'
import { useSyncStore } from './syncStore'

interface PayeesState {
  payees: PayeeDTO[]
  isLoading: boolean
  error: string | null
}

interface PayeesActions {
  fetchPayees: () => Promise<void>
  createPayee: (name: string) => Promise<void>
  updatePayee: (id: string, name: string) => Promise<void>
  deletePayee: (id: string) => Promise<void>
  mergePayees: (sourcePayeeId: string, targetPayeeId: string) => Promise<void>
}

interface PayeesStoreInternal extends PayeesState, PayeesActions {
  _getPayees: GetPayees | null
  _createPayee: CreatePayee | null
  _updatePayee: UpdatePayee | null
  _deletePayee: DeletePayee | null
  _mergePayees: MergePayees | null
}

export const usePayeesStore = create<PayeesStoreInternal>((set, get) => ({
  payees: [],
  isLoading: false,
  error: null,
  _getPayees: null,
  _createPayee: null,
  _updatePayee: null,
  _deletePayee: null,
  _mergePayees: null,

  fetchPayees: async () => {
    const { _getPayees } = get()
    if (!_getPayees) return
    set({ isLoading: true, error: null })
    try {
      const { payees } = await _getPayees.execute()
      set({ payees, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load payees',
        isLoading: false,
      })
    }
  },

  createPayee: async (name: string) => {
    const { _createPayee, fetchPayees } = get()
    if (!_createPayee) return
    try {
      await _createPayee.execute({ name })
      await fetchPayees()
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create payee' })
      throw err
    }
  },

  updatePayee: async (id: string, name: string) => {
    const { _updatePayee, fetchPayees } = get()
    if (!_updatePayee) return
    try {
      await _updatePayee.execute({ id, name })
      await fetchPayees()
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update payee' })
      throw err
    }
  },

  deletePayee: async (id: string) => {
    const { _deletePayee, fetchPayees } = get()
    if (!_deletePayee) return
    try {
      await _deletePayee.execute({ id })
      await fetchPayees()
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete payee' })
      throw err
    }
  },

  mergePayees: async (sourcePayeeId: string, targetPayeeId: string) => {
    const { _mergePayees, fetchPayees } = get()
    if (!_mergePayees) return
    try {
      await _mergePayees.execute({ sourcePayeeId, targetPayeeId })
      await fetchPayees()
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to merge payees' })
      throw err
    }
  },
}))

export function initializePayeesStore(
  getPayees: GetPayees,
  createPayee: CreatePayee,
  updatePayee: UpdatePayee,
  deletePayee: DeletePayee,
  mergePayees: MergePayees
): void {
  usePayeesStore.setState({
    _getPayees: getPayees,
    _createPayee: createPayee,
    _updatePayee: updatePayee,
    _deletePayee: deletePayee,
    _mergePayees: mergePayees,
  })
}
