import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { GroupBudgetDTO } from '@application/dtos/BudgetDTO'
import { MoneyText } from '../common/MoneyText'
import { useTheme } from '@/hooks/use-theme'

interface BudgetGroupRowProps {
  group: GroupBudgetDTO
  isIncome: boolean
}

export function BudgetGroupRow({ group, isIncome }: BudgetGroupRowProps) {
  const colors = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundElement, borderBottomColor: colors.separator }]}>
      <Text style={[styles.name, { color: colors.textSubdued }]} numberOfLines={1}>
        {group.groupName.toUpperCase()}
      </Text>
      {isIncome ? (
        <View style={styles.incomeTotal}>
          <MoneyText cents={group.spent} colorize={false} style={[styles.colText, { color: colors.textSubdued }]} />
        </View>
      ) : (
        <View style={styles.cols}>
          <MoneyText cents={group.budgeted} colorize={false} style={[styles.colText, { color: colors.textSubdued }]} />
          <MoneyText cents={-group.spent} colorize={false} style={[styles.colText, { color: colors.textSubdued }]} />
          <MoneyText cents={group.available} colorize={false} style={[styles.colText, { color: colors.textSubdued }]} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cols: {
    flexDirection: 'row',
    gap: 0,
  },
  colText: {
    fontSize: 11,
    fontWeight: '600',
    width: 64,
    textAlign: 'right',
  },
  incomeTotal: {
    flexDirection: 'row',
  },
})
