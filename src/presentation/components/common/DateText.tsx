import React from 'react'
import { Text, type TextProps } from 'react-native'
import { useTheme } from '@/hooks/use-theme'

interface DateTextProps extends TextProps {
  date: string // YYYY-MM-DD
  format?: 'short' | 'medium' | 'long'
}

function formatDate(dateStr: string, format: 'short' | 'medium' | 'long'): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  const options: Intl.DateTimeFormatOptions =
    format === 'short'
      ? { month: 'short', day: 'numeric' }
      : format === 'medium'
        ? { month: 'short', day: 'numeric', year: 'numeric' }
        : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }

  return new Intl.DateTimeFormat('en-US', options).format(date)
}

export function DateText({ date, format = 'medium', style, ...props }: DateTextProps) {
  const colors = useTheme()
  return (
    <Text style={[{ color: colors.textSubdued }, style]} {...props}>
      {formatDate(date, format)}
    </Text>
  )
}
