import React from 'react'
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native'
import type { AccountDTO } from '@application/dtos'
import { MoneyText } from '../common/MoneyText'
import { useTheme } from '@/hooks/use-theme'

interface AccountCardProps {
  account: AccountDTO
  onPress?: () => void
}

export function AccountCard({ account, onPress }: AccountCardProps) {
  const colors = useTheme()

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          borderLeftColor: account.offbudget ? colors.separator : colors.primary,
          opacity: pressed ? 0.85 : 1,
        },
        Platform.OS === 'ios' && styles.shadow,
      ]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{account.name}</Text>
        {account.offbudget && (
          <View style={[styles.badge, { backgroundColor: colors.separator }]}>
            <Text style={[styles.badgeText, { color: colors.textSubdued }]}>Off Budget</Text>
          </View>
        )}
      </View>
      <MoneyText
        cents={account.balance}
        style={styles.balance}
        colorize={!account.offbudget}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  left: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  balance: {
    fontSize: 15,
    fontWeight: '600',
  },
})
