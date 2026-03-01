import React, { useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { useTheme } from '@/hooks/use-theme'

interface SwipeableRowProps {
  children: React.ReactNode
  onDelete: () => void
  onEdit?: () => void
}

export function SwipeableRow({ children, onDelete, onEdit }: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null)
  const colors = useTheme()

  function close() {
    swipeableRef.current?.close()
  }

  function renderRightActions(_progress: Animated.AnimatedInterpolation<number>) {
    return (
      <View style={styles.actions}>
        {onEdit && (
          <Pressable
            style={[styles.action, { backgroundColor: colors.primary }]}
            onPress={() => {
              close()
              onEdit()
            }}
          >
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.action, { backgroundColor: colors.numberNegative }]}
          onPress={() => {
            close()
            onDelete()
          }}
        >
          <Text style={styles.actionText}>Delete</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={renderRightActions}
    >
      {children}
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
  },
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
})
