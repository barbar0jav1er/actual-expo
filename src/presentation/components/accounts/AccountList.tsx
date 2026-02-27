import React from 'react'
import { SectionList, StyleSheet, Text, View, RefreshControl } from 'react-native'
import type { AccountDTO } from '@application/dtos'
import { AccountCard } from './AccountCard'
import { Button } from '../common/Button'
import { useTheme } from '@/hooks/use-theme'

interface AccountListProps {
  accounts: AccountDTO[]
  refreshing: boolean
  onRefresh: () => void
  onAccountPress?: (account: AccountDTO) => void
  onAddAccount?: () => void
}

export function AccountList({
  accounts,
  refreshing,
  onRefresh,
  onAccountPress,
  onAddAccount,
}: AccountListProps) {
  const colors = useTheme()

  const onBudget = accounts.filter((a) => !a.offbudget && !a.closed)
  const offBudget = accounts.filter((a) => a.offbudget && !a.closed)

  const sections = [
    ...(onBudget.length > 0 ? [{ title: 'On Budget', data: onBudget }] : []),
    ...(offBudget.length > 0 ? [{ title: 'Off Budget', data: offBudget }] : []),
  ]

  if (accounts.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.pageBackground }]}>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No accounts yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSubdued }]}>
          Add an account to get started
        </Text>
        {onAddAccount && (
          <Button onPress={onAddAccount} size="md" style={{ marginTop: 16 }}>
            Add Account
          </Button>
        )}
      </View>
    )
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <AccountCard account={item} onPress={() => onAccountPress?.(item)} />
      )}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.sectionHeader, { color: colors.textSubdued, backgroundColor: colors.pageBackground }]}>
          {section.title}
        </Text>
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
    />
  )
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
})
