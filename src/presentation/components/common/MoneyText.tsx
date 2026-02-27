import React from 'react'
import { Text, type TextProps } from 'react-native'
import { Money } from '@domain/value-objects'
import { useTheme } from '@/hooks/use-theme'

interface MoneyTextProps extends TextProps {
  cents: number
  showSign?: boolean
  colorize?: boolean
}

export function MoneyText({ cents, showSign = false, colorize = true, style, ...props }: MoneyTextProps) {
  const colors = useTheme()
  const money = Money.fromCents(cents)
  const formatted = money.format()
  const display = showSign && cents > 0 ? `+${formatted}` : formatted

  const color = colorize
    ? cents >= 0
      ? colors.numberPositive
      : colors.numberNegative
    : colors.textPrimary

  return (
    <Text style={[{ color }, style]} {...props}>
      {display}
    </Text>
  )
}
