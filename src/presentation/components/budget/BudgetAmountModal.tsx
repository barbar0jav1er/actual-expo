import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Button } from '../common/Button'
import { useTheme } from '@/hooks/use-theme'

interface BudgetAmountModalProps {
  visible: boolean
  categoryName: string
  currentAmount: number  // cents
  onConfirm: (amountCents: number) => Promise<void>
  onClose: () => void
}

export function BudgetAmountModal({
  visible,
  categoryName,
  currentAmount,
  onConfirm,
  onClose,
}: BudgetAmountModalProps) {
  const colors = useTheme()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setValue(currentAmount !== 0 ? (currentAmount / 100).toFixed(2) : '')
      setError(null)
    }
  }, [visible, currentAmount])

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleConfirm() {
    const parsed = parseFloat(value || '0')
    if (isNaN(parsed)) {
      setError('Enter a valid amount')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const cents = Math.round(parsed * 100)
      await onConfirm(cents)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.pageBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <Pressable onPress={handleClose}>
            <Text style={[styles.cancel, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {categoryName}
          </Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textSubdued }]}>Budget Amount</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.cardBackground,
                color: colors.textPrimary,
                borderColor: error ? colors.numberNegative : colors.separator,
              },
            ]}
            value={value}
            onChangeText={(t) => { setValue(t); setError(null) }}
            placeholder="0.00"
            placeholderTextColor={colors.textSubdued}
            keyboardType="decimal-pad"
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={handleConfirm}
          />
          {error && <Text style={[styles.error, { color: colors.numberNegative }]}>{error}</Text>}

          <Button onPress={handleConfirm} loading={loading} size="lg" style={{ marginTop: 24 }}>
            Save
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  cancel: { fontSize: 16, width: 56 },
  form: { padding: 24, gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 22,
    marginTop: 4,
    textAlign: 'center',
  },
  error: { fontSize: 13, marginTop: 4 },
})
