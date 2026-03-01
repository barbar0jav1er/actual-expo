import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import type { CategoryBudgetDTO } from '@application/dtos/BudgetDTO'
import { MoneyText } from '../common/MoneyText'
import { useTheme } from '@/hooks/use-theme'

interface BudgetCategoryRowProps {
  category: CategoryBudgetDTO
  isIncome: boolean
  onEditBudget?: (categoryId: string, currentBudgeted: number) => void
}

export function BudgetCategoryRow({ category, isIncome, onEditBudget }: BudgetCategoryRowProps) {
  const colors = useTheme()

  const availableColor =
    category.available > 0
      ? colors.numberPositive
      : category.available < 0
      ? colors.numberNegative
      : colors.textSubdued

  return (
    <View style={[styles.container, { borderBottomColor: colors.separator }]}>
      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
        {category.categoryName}
      </Text>

      {isIncome ? (
        <View style={styles.cols}>
          <MoneyText
            cents={-category.spent}
            colorize={false}
            style={[styles.colText, { color: colors.textPrimary }]}
          />
        </View>
      ) : (
        <View style={styles.cols}>
          <Pressable
            onPress={() => onEditBudget?.(category.categoryId, category.budgeted)}
            style={({ pressed }) => [styles.budgetCell, { opacity: pressed ? 0.6 : 1 }]}
          >
            <MoneyText
              cents={category.budgeted}
              colorize={false}
              style={[styles.colText, { color: colors.textPrimary }]}
            />
          </Pressable>
          <MoneyText
            cents={-category.spent}
            colorize={false}
            style={[styles.colText, { color: colors.textPrimary }]}
          />
          <Text style={[styles.colText, { color: availableColor }]}>
            {formatCents(category.available)}
          </Text>
        </View>
      )}
    </View>
  )
}

function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  const dollars = abs / 100
  const formatted = dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return cents < 0 ? `-$${formatted}` : `$${formatted}`
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    flex: 1,
    fontSize: 15,
    paddingLeft: 8,
  },
  cols: {
    flexDirection: 'row',
  },
  colText: {
    fontSize: 14,
    width: 64,
    textAlign: 'right',
  },
  budgetCell: {
    width: 64,
    alignItems: 'flex-end',
  },
})
