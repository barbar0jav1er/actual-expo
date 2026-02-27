import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
  type PressableProps,
} from 'react-native'
import { useTheme } from '@/hooks/use-theme'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  onPress: () => void
  children: React.ReactNode
  style?: ViewStyle
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  children,
  style,
  ...props
}: ButtonProps) {
  const colors = useTheme()
  const isDisabled = disabled || loading

  const bgColor =
    variant === 'primary' ? colors.primary :
    variant === 'danger'  ? colors.numberNegative :
    variant === 'secondary' ? colors.cardBackground :
    'transparent'

  const textColor =
    variant === 'primary' || variant === 'danger' ? '#ffffff' : colors.primary

  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15
  const paddingH = size === 'sm' ? 12 : size === 'lg' ? 24 : 16
  const paddingV = size === 'sm' ? 6  : size === 'lg' ? 14 : 10

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          opacity: isDisabled ? 0.5 : pressed ? 0.75 : 1,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: variant === 'secondary' ? colors.primary : undefined,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize }]}>
          {children}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: { fontWeight: '600' },
})
