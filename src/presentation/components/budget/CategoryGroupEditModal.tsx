import React, { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '../common/Button'

interface CategoryGroupEditModalProps {
  visible: boolean
  groupId: string
  groupName: string
  isHidden: boolean
  onSave: (id: string, name: string, hidden: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export function CategoryGroupEditModal({
  visible,
  groupId,
  groupName,
  isHidden,
  onSave,
  onDelete,
  onClose,
}: CategoryGroupEditModalProps) {
  const colors = useTheme()
  const [name, setName] = useState(groupName)
  const [hidden, setHidden] = useState(isHidden)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setName(groupName)
      setHidden(isHidden)
      setError(null)
    }
  }, [visible, groupName, isHidden])

  async function handleSave() {
    if (!name.trim()) {
      setError('Name cannot be empty')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(groupId, name.trim(), hidden)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await onDelete(groupId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.pageBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <Pressable onPress={onClose}>
            <Text style={[styles.cancel, { color: colors.textSubdued }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Edit Group</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={[styles.save, { color: colors.primary }]}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.label, { color: colors.textSubdued }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.textPrimary, borderColor: colors.separator }]}
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={colors.textSubdued}
            autoFocus
          />

          <Pressable
            style={[styles.toggleRow, { borderColor: colors.separator }]}
            onPress={() => setHidden(h => !h)}
          >
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Hidden</Text>
            <Ionicons
              name={hidden ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={hidden ? colors.primary : colors.textSubdued}
            />
          </Pressable>

          {error && <Text style={[styles.error, { color: colors.numberNegative }]}>{error}</Text>}

          <Button variant="danger" size="md" onPress={handleDelete} loading={saving} style={{ marginTop: 32 }}>
            Delete Group
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
  save: { fontSize: 16, fontWeight: '700', width: 56, textAlign: 'right' },
  body: { padding: 24, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  toggleLabel: { fontSize: 16 },
  error: { fontSize: 13, marginTop: 8 },
})
