import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Switch,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Button } from '../common/Button'
import { useTheme } from '@/hooks/use-theme'

interface AccountFormProps {
  visible: boolean
  onClose: () => void
  onSubmit: (data: { name: string; offbudget: boolean }) => Promise<void>
}

export function AccountForm({ visible, onClose, onSubmit }: AccountFormProps) {
  const colors = useTheme()
  const [name, setName] = useState('')
  const [offbudget, setOffbudget] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setOffbudget(false)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Account name is required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), offbudget })
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
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
          <Text style={[styles.title, { color: colors.textPrimary }]}>New Account</Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textSubdued }]}>Account Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.cardBackground,
                color: colors.textPrimary,
                borderColor: error ? colors.numberNegative : colors.separator,
              },
            ]}
            value={name}
            onChangeText={(t) => { setName(t); setError(null) }}
            placeholder="e.g. Checking Account"
            placeholderTextColor={colors.textSubdued}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {error && <Text style={[styles.error, { color: colors.numberNegative }]}>{error}</Text>}

          <View style={[styles.row, { borderTopColor: colors.separator, borderBottomColor: colors.separator }]}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Off Budget</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSubdued }]}>
                Exclude from budget totals
              </Text>
            </View>
            <Switch
              value={offbudget}
              onValueChange={setOffbudget}
              trackColor={{ true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <Button onPress={handleSubmit} loading={loading} size="lg" style={{ marginTop: 24 }}>
            Create Account
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
  title: { fontSize: 16, fontWeight: '600' },
  cancel: { fontSize: 16, width: 56 },
  form: { padding: 24, gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 4,
  },
  error: { fontSize: 13, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
})
