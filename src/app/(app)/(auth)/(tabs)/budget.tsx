import { useBudgetStore } from '@/presentation/stores'
import {
  BudgetGroupRow,
  BudgetCategoryRow,
  BudgetAmountModal,
  CategoryGroupModal,
} from '@/presentation/components/budget'
import { MoneyText } from '@/presentation/components/common'
import { useTheme } from '@/hooks/use-theme'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { CategoryBudgetDTO, GroupBudgetDTO } from '@application/dtos/BudgetDTO'

type EditingBudget = { categoryId: string; categoryName: string; current: number } | null

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-')
  const date = new Date(parseInt(year), parseInt(mon) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

type ListItem =
  | { type: 'group'; group: GroupBudgetDTO }
  | { type: 'category'; category: CategoryBudgetDTO }

function buildListItems(summary: ReturnType<typeof useBudgetStore.getState>['summary']): ListItem[] {
  if (!summary) return []
  const items: ListItem[] = []
  for (const group of summary.groups) {
    items.push({ type: 'group', group })
    for (const cat of group.categories) {
      items.push({ type: 'category', category: cat })
    }
  }
  return items
}

export default function BudgetScreen() {
  const colors = useTheme()
  const { summary, month, isLoading, fetchSummary, goToPrevMonth, goToNextMonth, setBudgetAmount, createCategory, createCategoryGroup } =
    useBudgetStore()

  const [editing, setEditing] = useState<EditingBudget>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchSummary()
  }, [])

  const items = buildListItems(summary)

  const allGroups = summary?.groups.map(g => ({ id: g.groupId, name: g.groupName, isIncome: false })) ?? []

  function handleEditBudget(categoryId: string, currentBudgeted: number) {
    const cat = summary?.groups.flatMap(g => g.categories).find(c => c.categoryId === categoryId)
    if (!cat) return
    setEditing({ categoryId, categoryName: cat.categoryName, current: currentBudgeted })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      {/* Month navigation */}
      <View style={[styles.monthBar, { backgroundColor: colors.primary }]}>
        <Pressable onPress={goToPrevMonth} style={styles.navBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
        <Pressable onPress={goToNextMonth} style={styles.navBtn} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </View>

      {/* Summary bar */}
      {summary && (
        <View style={[styles.summaryBar, { backgroundColor: colors.primary, borderTopColor: 'rgba(255,255,255,0.15)' }]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>INCOME</Text>
            <MoneyText cents={summary.income} colorize={false} style={styles.summaryAmount} />
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>TO BUDGET</Text>
            <MoneyText
              cents={summary.toBeBudgeted}
              colorize={false}
              style={[styles.summaryAmount, { color: summary.toBeBudgeted < 0 ? '#ff9b9b' : '#ffffff' }]}
            />
          </View>
        </View>
      )}

      {/* Column headers */}
      <View style={[styles.colHeaders, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}>
        <Text style={[styles.colHeaderName, { color: colors.textSubdued }]}>CATEGORY</Text>
        <View style={styles.colHeaderNums}>
          <Text style={[styles.colHeaderText, { color: colors.textSubdued }]}>BUDGET</Text>
          <Text style={[styles.colHeaderText, { color: colors.textSubdued }]}>SPENT</Text>
          <Text style={[styles.colHeaderText, { color: colors.textSubdued }]}>AVAIL</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(item) => {
          if (item.type === 'group') return `g-${item.group.groupId}`
          return `c-${item.category.categoryId}`
        }}
        renderItem={({ item }) => {
          if (item.type === 'group') {
            return <BudgetGroupRow group={item.group} isIncome={false} />
          }
          // category
          return (
            <BudgetCategoryRow
              category={item.category}
              isIncome={false}
              onEditBudget={handleEditBudget}
            />
          )
        }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchSummary()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.emptyContent,
        ]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No categories yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSubdued }]}>
                Tap + to add your first category group
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* Edit budget modal */}
      <BudgetAmountModal
        visible={editing !== null}
        categoryName={editing?.categoryName ?? ''}
        currentAmount={editing?.current ?? 0}
        onConfirm={async (cents) => {
          if (editing) await setBudgetAmount(editing.categoryId, cents)
        }}
        onClose={() => setEditing(null)}
      />

      {/* Add category / group modal */}
      <CategoryGroupModal
        visible={showAddModal}
        groups={allGroups}
        onCreateGroup={createCategoryGroup}
        onCreateCategory={createCategory}
        onClose={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  navBtn: {
    padding: 8,
  },
  monthLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colHeaderName: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingLeft: 8,
  },
  colHeaderNums: {
    flexDirection: 'row',
  },
  colHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    width: 64,
    textAlign: 'right',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
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
