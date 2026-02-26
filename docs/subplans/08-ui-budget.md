# Subplan 8: UI Presupuesto (Presentation Layer)

## Objetivo

Implementar las pantallas de presupuesto con vista mensual y edicion de categorias.

## Dependencias

- **Subplan 6:** Presupuestos (Domain + Application)
- **Subplan 7:** UI Base

## Archivos a Crear

```
app/
└── (tabs)/
    └── budget.tsx

src/
└── presentation/
    ├── stores/
    │   └── budgetStore.ts
    ├── hooks/
    │   └── useBudget.ts
    └── components/
        └── budget/
            ├── BudgetHeader.tsx
            ├── BudgetMonthSelector.tsx
            ├── BudgetSummary.tsx
            ├── CategoryGroupSection.tsx
            ├── CategoryBudgetRow.tsx
            ├── BudgetAmountInput.tsx
            └── index.ts
```

---

## Budget Store

```typescript
// src/presentation/stores/budgetStore.ts
import { create } from 'zustand'
import { MonthBudgetSummaryDTO } from '@/application/dtos'
import { BudgetMonth } from '@/domain/value-objects'
import {
  GetBudgetSummary,
  SetBudgetAmount
} from '@/application/use-cases/budget'

interface BudgetState {
  currentMonth: string  // YYYY-MM
  summary: MonthBudgetSummaryDTO | null
  isLoading: boolean
  error: string | null
  editingCategoryId: string | null

  // Actions
  setMonth: (month: string) => void
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  fetchSummary: () => Promise<void>
  setBudgetAmount: (categoryId: string, amount: number) => Promise<void>
  startEditing: (categoryId: string) => void
  stopEditing: () => void
}

let getBudgetSummaryUseCase: GetBudgetSummary
let setBudgetAmountUseCase: SetBudgetAmount

export function initializeBudgetStore(
  getBudgetSummary: GetBudgetSummary,
  setBudgetAmount: SetBudgetAmount
) {
  getBudgetSummaryUseCase = getBudgetSummary
  setBudgetAmountUseCase = setBudgetAmount
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  currentMonth: BudgetMonth.current().toString(),
  summary: null,
  isLoading: false,
  error: null,
  editingCategoryId: null,

  setMonth: (month: string) => {
    set({ currentMonth: month })
    get().fetchSummary()
  },

  goToPreviousMonth: () => {
    const current = BudgetMonth.fromString(get().currentMonth)
    set({ currentMonth: current.previous().toString() })
    get().fetchSummary()
  },

  goToNextMonth: () => {
    const current = BudgetMonth.fromString(get().currentMonth)
    set({ currentMonth: current.next().toString() })
    get().fetchSummary()
  },

  fetchSummary: async () => {
    set({ isLoading: true, error: null })

    try {
      const result = await getBudgetSummaryUseCase.execute({
        month: get().currentMonth
      })
      set({ summary: result.summary, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load budget'
      })
    }
  },

  setBudgetAmount: async (categoryId: string, amount: number) => {
    try {
      await setBudgetAmountUseCase.execute({
        month: get().currentMonth,
        categoryId,
        amount
      })
      // Refresh summary
      await get().fetchSummary()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update budget'
      })
      throw error
    }
  },

  startEditing: (categoryId: string) => {
    set({ editingCategoryId: categoryId })
  },

  stopEditing: () => {
    set({ editingCategoryId: null })
  }
}))
```

---

## Components

### BudgetHeader

```typescript
// src/presentation/components/budget/BudgetHeader.tsx
import { View, Text, StyleSheet } from 'react-native'
import { MoneyText } from '../common'

interface BudgetHeaderProps {
  toBeBudgeted: number
  income: number
  totalBudgeted: number
}

export function BudgetHeader({
  toBeBudgeted,
  income,
  totalBudgeted
}: BudgetHeaderProps) {
  const isOverBudgeted = toBeBudgeted < 0

  return (
    <View style={[
      styles.container,
      isOverBudgeted && styles.overBudgeted
    ]}>
      <Text style={styles.label}>To Be Budgeted</Text>
      <MoneyText
        cents={toBeBudgeted}
        style={styles.amount}
        colorize={false}
      />

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Income</Text>
          <MoneyText cents={income} style={styles.detailValue} colorize={false} />
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Budgeted</Text>
          <MoneyText cents={totalBudgeted} style={styles.detailValue} colorize={false} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#22c55e',
    padding: 24,
    alignItems: 'center'
  },
  overBudgeted: {
    backgroundColor: '#ef4444'
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14
  },
  amount: {
    color: 'white',
    fontSize: 36,
    fontWeight: '700',
    marginTop: 8
  },
  details: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 32
  },
  detailItem: {
    alignItems: 'center'
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12
  },
  detailValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4
  }
})
```

### BudgetMonthSelector

```typescript
// src/presentation/components/budget/BudgetMonthSelector.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { format, parse } from 'date-fns'

interface BudgetMonthSelectorProps {
  month: string  // YYYY-MM
  onPrevious: () => void
  onNext: () => void
}

export function BudgetMonthSelector({
  month,
  onPrevious,
  onNext
}: BudgetMonthSelectorProps) {
  const date = parse(month, 'yyyy-MM', new Date())
  const displayMonth = format(date, 'MMMM yyyy')

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={onPrevious}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={24} color="#3b82f6" />
      </Pressable>

      <Text style={styles.month}>{displayMonth}</Text>

      <Pressable
        style={styles.button}
        onPress={onNext}
        hitSlop={8}
      >
        <Ionicons name="chevron-forward" size={24} color="#3b82f6" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  button: {
    padding: 8
  },
  month: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  }
})
```

### CategoryGroupSection

```typescript
// src/presentation/components/budget/CategoryGroupSection.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { GroupBudgetDTO } from '@/application/dtos'
import { CategoryBudgetRow } from './CategoryBudgetRow'
import { MoneyText } from '../common'

interface CategoryGroupSectionProps {
  group: GroupBudgetDTO
  editingCategoryId: string | null
  onEditCategory: (categoryId: string) => void
  onUpdateBudget: (categoryId: string, amount: number) => void
}

export function CategoryGroupSection({
  group,
  editingCategoryId,
  onEditCategory,
  onUpdateBudget
}: CategoryGroupSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={20}
            color="#6b7280"
          />
          <Text style={styles.groupName}>{group.groupName}</Text>
        </View>

        <View style={styles.headerRight}>
          <MoneyText cents={group.budgeted} style={styles.headerAmount} />
          <MoneyText cents={group.spent} style={styles.headerAmount} />
          <MoneyText cents={group.available} style={styles.headerAmount} />
        </View>
      </Pressable>

      {isExpanded && (
        <View style={styles.categories}>
          {group.categories.map(category => (
            <CategoryBudgetRow
              key={category.categoryId}
              category={category}
              isEditing={editingCategoryId === category.categoryId}
              onEdit={() => onEditCategory(category.categoryId)}
              onUpdate={(amount) => onUpdateBudget(category.categoryId, amount)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16
  },
  headerAmount: {
    fontSize: 14,
    fontWeight: '500',
    width: 70,
    textAlign: 'right'
  },
  categories: {
    backgroundColor: 'white'
  }
})
```

### CategoryBudgetRow

```typescript
// src/presentation/components/budget/CategoryBudgetRow.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CategoryBudgetDTO } from '@/application/dtos'
import { MoneyText } from '../common'
import { BudgetAmountInput } from './BudgetAmountInput'

interface CategoryBudgetRowProps {
  category: CategoryBudgetDTO
  isEditing: boolean
  onEdit: () => void
  onUpdate: (amount: number) => void
}

export function CategoryBudgetRow({
  category,
  isEditing,
  onEdit,
  onUpdate
}: CategoryBudgetRowProps) {
  return (
    <View style={[
      styles.row,
      category.isOverBudget && styles.overBudget
    ]}>
      <Text style={styles.name} numberOfLines={1}>
        {category.categoryName}
      </Text>

      <View style={styles.amounts}>
        {isEditing ? (
          <BudgetAmountInput
            initialValue={category.budgeted}
            onSubmit={onUpdate}
            onCancel={() => {}}
          />
        ) : (
          <Pressable onPress={onEdit}>
            <MoneyText
              cents={category.budgeted}
              style={styles.amount}
              colorize={false}
            />
          </Pressable>
        )}

        <MoneyText
          cents={category.spent}
          style={styles.amount}
        />

        <MoneyText
          cents={category.available}
          style={[styles.amount, styles.available]}
        />
      </View>

      {category.goal && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(category.goalProgress ?? 0) * 100}%` }
            ]}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  overBudget: {
    backgroundColor: '#fef2f2'
  },
  name: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    paddingLeft: 28
  },
  amounts: {
    flexDirection: 'row',
    gap: 16
  },
  amount: {
    fontSize: 14,
    width: 70,
    textAlign: 'right'
  },
  available: {
    fontWeight: '600'
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 28,
    right: 16,
    height: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 1
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 1
  }
})
```

### BudgetAmountInput

```typescript
// src/presentation/components/budget/BudgetAmountInput.tsx
import { useState, useRef, useEffect } from 'react'
import { TextInput, StyleSheet, View } from 'react-native'

interface BudgetAmountInputProps {
  initialValue: number  // centavos
  onSubmit: (amount: number) => void
  onCancel: () => void
}

export function BudgetAmountInput({
  initialValue,
  onSubmit,
  onCancel
}: BudgetAmountInputProps) {
  const [value, setValue] = useState(
    (initialValue / 100).toFixed(2)
  )
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const numValue = parseFloat(value) || 0
    const cents = Math.round(numValue * 100)
    onSubmit(cents)
  }

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        selectTextOnFocus
        onBlur={handleSubmit}
        onSubmitEditing={handleSubmit}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 70
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    textAlign: 'right'
  }
})
```

---

## Budget Screen

```typescript
// app/(tabs)/budget.tsx
import { useEffect } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { useBudgetStore } from '@/presentation/stores'
import {
  BudgetHeader,
  BudgetMonthSelector,
  CategoryGroupSection
} from '@/presentation/components/budget'

export default function BudgetScreen() {
  const {
    currentMonth,
    summary,
    isLoading,
    editingCategoryId,
    goToPreviousMonth,
    goToNextMonth,
    fetchSummary,
    setBudgetAmount,
    startEditing,
    stopEditing
  } = useBudgetStore()

  useEffect(() => {
    fetchSummary()
  }, [])

  const handleUpdateBudget = async (categoryId: string, amount: number) => {
    await setBudgetAmount(categoryId, amount)
    stopEditing()
  }

  if (!summary) {
    return null  // O loading state
  }

  return (
    <View style={styles.container}>
      <BudgetMonthSelector
        month={currentMonth}
        onPrevious={goToPreviousMonth}
        onNext={goToNextMonth}
      />

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchSummary} />
        }
      >
        <BudgetHeader
          toBeBudgeted={summary.toBeBudgeted}
          income={summary.income}
          totalBudgeted={summary.totalBudgeted}
        />

        {/* Column Headers */}
        <View style={styles.columnHeaders}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerColumns}>
            <Text style={styles.columnHeader}>Budgeted</Text>
            <Text style={styles.columnHeader}>Spent</Text>
            <Text style={styles.columnHeader}>Available</Text>
          </View>
        </View>

        {/* Category Groups */}
        {summary.groups.map(group => (
          <CategoryGroupSection
            key={group.groupId}
            group={group}
            editingCategoryId={editingCategoryId}
            onEditCategory={startEditing}
            onUpdateBudget={handleUpdateBudget}
          />
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  scroll: {
    flex: 1
  },
  columnHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  headerSpacer: {
    flex: 1
  },
  headerColumns: {
    flexDirection: 'row',
    gap: 16
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    width: 70,
    textAlign: 'right'
  },
  bottomSpacer: {
    height: 100
  }
})
```

---

## Verificacion

### Criterios de Exito

- [ ] Month selector navega correctamente
- [ ] Budget header muestra "To Be Budgeted" correcto
- [ ] Category groups se expanden/colapsan
- [ ] Editar presupuesto funciona inline
- [ ] Colores indican overspending
- [ ] Progress bars de goals funcionan
- [ ] Refresh actualiza datos

---

## Tiempo Estimado

- Budget Store: 2-3 horas
- BudgetHeader: 1-2 horas
- BudgetMonthSelector: 1 hora
- CategoryGroupSection: 2-3 horas
- CategoryBudgetRow: 2-3 horas
- BudgetAmountInput: 1-2 horas
- Budget Screen: 2-3 horas
- Testing: 2-3 horas

**Total: 13-19 horas**
