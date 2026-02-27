import React from 'react'
import { SectionList, StyleSheet, Text, View, RefreshControl } from 'react-native'
import type { TransactionDTO } from '@application/dtos'
import { TransactionItem } from './TransactionItem'
import { useTheme } from '@/hooks/use-theme'
import { DateText } from '../common/DateText'

interface TransactionListProps {
  transactions: TransactionDTO[]
  refreshing: boolean
  onRefresh: () => void
  onTransactionPress?: (tx: TransactionDTO) => void
}

interface Section {
  title: string // YYYY-MM-DD
  data: TransactionDTO[]
}

function groupByDate(transactions: TransactionDTO[]): Section[] {
  const map = new Map<string, TransactionDTO[]>()
  for (const tx of transactions) {
    const existing = map.get(tx.date) ?? []
    map.set(tx.date, [...existing, tx])
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ title: date, data }))
}

export function TransactionList({
  transactions,
  refreshing,
  onRefresh,
  onTransactionPress,
}: TransactionListProps) {
  const colors = useTheme()
  const sections = groupByDate(transactions)

  if (transactions.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.pageBackground }]}>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSubdued }]}>
          Transactions for this period will appear here
        </Text>
      </View>
    )
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TransactionItem transaction={item} onPress={() => onTransactionPress?.(item)} />
      )}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: colors.pageBackground, borderBottomColor: colors.separator }]}>
          <DateText date={section.title} format="medium" style={[styles.sectionDate, { color: colors.textSubdued }]} />
        </View>
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      contentContainerStyle={[styles.content, { backgroundColor: colors.cardBackground }]}
      stickySectionHeadersEnabled
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 100 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionDate: { fontSize: 13, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
})
