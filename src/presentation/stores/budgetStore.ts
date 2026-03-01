import { create } from 'zustand'
import type { MonthBudgetSummaryDTO } from '@application/dtos/BudgetDTO'
import type { GetCategories } from '@application/use-cases/categories/GetCategories'
import type { CreateCategory } from '@application/use-cases/categories/CreateCategory'
import type { CreateCategoryGroup } from '@application/use-cases/categories/CreateCategoryGroup'
import type { GetBudgetSummary } from '@application/use-cases/budget/GetBudgetSummary'
import type { SetBudgetAmount } from '@application/use-cases/budget/SetBudgetAmount'
import { BudgetMonth } from '@domain/value-objects'
import { useSyncStore } from './syncStore'

interface BudgetState {
  summary: MonthBudgetSummaryDTO | null
  month: string  // YYYY-MM
  isLoading: boolean
  error: string | null
}

interface BudgetActions {
  fetchSummary: (month?: string) => Promise<void>
  setBudgetAmount: (categoryId: string, amountCents: number) => Promise<void>
  goToPrevMonth: () => Promise<void>
  goToNextMonth: () => Promise<void>
  createCategory: (name: string, groupId: string) => Promise<void>
  createCategoryGroup: (name: string, isIncome?: boolean) => Promise<void>
}

interface BudgetStoreInternal extends BudgetState, BudgetActions {
  _getCategories: GetCategories | null
  _createCategory: CreateCategory | null
  _createCategoryGroup: CreateCategoryGroup | null
  _getBudgetSummary: GetBudgetSummary | null
  _setBudgetAmount: SetBudgetAmount | null
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const useBudgetStore = create<BudgetStoreInternal>((set, get) => ({
  summary: null,
  month: currentMonth(),
  isLoading: false,
  error: null,
  _getCategories: null,
  _createCategory: null,
  _createCategoryGroup: null,
  _getBudgetSummary: null,
  _setBudgetAmount: null,

  fetchSummary: async (month?: string) => {
    const { _getBudgetSummary } = get()
    if (!_getBudgetSummary) return
    const targetMonth = month ?? get().month
    set({ isLoading: true, error: null, month: targetMonth })
    try {
      const { summary } = await _getBudgetSummary.execute({ month: targetMonth })
      set({ summary, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load budget',
        isLoading: false,
      })
    }
  },

  setBudgetAmount: async (categoryId: string, amountCents: number) => {
    const { _setBudgetAmount, fetchSummary, month } = get()
    if (!_setBudgetAmount) return
    try {
      await _setBudgetAmount.execute({ month, categoryId, amount: amountCents })
      await fetchSummary(month)
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to set budget' })
    }
  },

  goToPrevMonth: async () => {
    const { month, fetchSummary } = get()
    const prev = BudgetMonth.fromString(month).previous().toString()
    await fetchSummary(prev)
  },

  goToNextMonth: async () => {
    const { month, fetchSummary } = get()
    const next = BudgetMonth.fromString(month).next().toString()
    await fetchSummary(next)
  },

  createCategory: async (name: string, groupId: string) => {
    const { _createCategory, fetchSummary, month } = get()
    if (!_createCategory) return
    try {
      await _createCategory.execute({ name, groupId })
      await fetchSummary(month)
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create category' })
      throw err
    }
  },

  createCategoryGroup: async (name: string, isIncome = false) => {
    const { _createCategoryGroup, fetchSummary, month } = get()
    if (!_createCategoryGroup) return
    try {
      await _createCategoryGroup.execute({ name, isIncome })
      await fetchSummary(month)
      void useSyncStore.getState().triggerSync()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create category group' })
      throw err
    }
  },
}))

export function initializeBudgetStore(
  getCategories: GetCategories,
  createCategory: CreateCategory,
  createCategoryGroup: CreateCategoryGroup,
  getBudgetSummary: GetBudgetSummary,
  setBudgetAmount: SetBudgetAmount
): void {
  useBudgetStore.setState({
    _getCategories: getCategories,
    _createCategory: createCategory,
    _createCategoryGroup: createCategoryGroup,
    _getBudgetSummary: getBudgetSummary,
    _setBudgetAmount: setBudgetAmount,
  })
}
