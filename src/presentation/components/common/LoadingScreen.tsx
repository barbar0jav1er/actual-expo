import React from 'react'
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native'
import { useTheme } from '@/hooks/use-theme'

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const colors = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <Text style={[styles.message, { color: colors.textSubdued }]}>{message}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  message: {
    fontSize: 14,
    marginTop: 8,
  },
})
