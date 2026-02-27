import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { TransactionDTO } from '@application/dtos'
import { MoneyText } from '../common/MoneyText'
import { DateText } from '../common/DateText'
import { useTheme } from '@/hooks/use-theme'

interface TransactionItemProps {
  transaction: TransactionDTO
  onPress?: () => void
}

export function TransactionItem({ transaction, onPress }: TransactionItemProps) {
  const colors = useTheme()

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <Text style={[styles.payee, { color: colors.textPrimary }]} numberOfLines={1}>
          {transaction.payeeName ?? transaction.accountName}
        </Text>
        {transaction.categoryName && (
          <Text style={[styles.category, { color: colors.textSubdued }]} numberOfLines={1}>
            {transaction.categoryName}
          </Text>
        )}
        {transaction.notes && (
          <Text style={[styles.notes, { color: colors.textSubdued }]} numberOfLines={1}>
            {transaction.notes}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        <MoneyText cents={transaction.amount} style={styles.amount} showSign />
        <DateText date={transaction.date} format="short" style={styles.date} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flex: 1, gap: 2, marginRight: 12 },
  right: { alignItems: 'flex-end', gap: 3 },
  payee: { fontSize: 15, fontWeight: '500' },
  category: { fontSize: 13 },
  notes: { fontSize: 12, fontStyle: 'italic' },
  amount: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 12 },
})
