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

interface CategoryGroupModalProps {
  visible: boolean
  groups: Array<{ id: string; name: string; isIncome: boolean }>
  onCreateGroup: (name: string, isIncome: boolean) => Promise<void>
  onCreateCategory: (name: string, groupId: string) => Promise<void>
  onClose: () => void
}

type Mode = 'choose' | 'group' | 'category'

export function CategoryGroupModal({
  visible,
  groups,
  onCreateGroup,
  onCreateCategory,
  onClose,
}: CategoryGroupModalProps) {
  const colors = useTheme()
  const [mode, setMode] = useState<Mode>('choose')
  const [name, setName] = useState('')
  const [isIncome, setIsIncome] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setMode('choose')
    setName('')
    setIsIncome(false)
    setSelectedGroupId('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (mode === 'category' && !selectedGroupId) {
      setError('Select a group')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (mode === 'group') {
        await onCreateGroup(name.trim(), isIncome)
      } else {
        await onCreateCategory(name.trim(), selectedGroupId)
      }
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setLoading(false)
    }
  }

  const expenseGroups = groups.filter(g => !g.isIncome)

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
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {mode === 'choose' ? 'Add' : mode === 'group' ? 'New Group' : 'New Category'}
          </Text>
          <View style={{ width: 56 }} />
        </View>

        {mode === 'choose' ? (
          <View style={styles.chooseContainer}>
            <Pressable
              style={[styles.choiceButton, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
              onPress={() => setMode('group')}
            >
              <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>Category Group</Text>
              <Text style={[styles.choiceSub, { color: colors.textSubdued }]}>
                Top-level container (e.g. Groceries, Transportation)
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.choiceButton,
                { backgroundColor: colors.cardBackground, borderColor: colors.separator },
                expenseGroups.length === 0 && { opacity: 0.4 },
              ]}
              onPress={() => expenseGroups.length > 0 && setMode('category')}
            >
              <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>Category</Text>
              <Text style={[styles.choiceSub, { color: colors.textSubdued }]}>
                {expenseGroups.length === 0
                  ? 'Create a group first'
                  : 'Individual budget category inside a group'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.textSubdued }]}>
              {mode === 'group' ? 'Group Name' : 'Category Name'}
            </Text>
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
              placeholder={mode === 'group' ? 'e.g. Groceries' : 'e.g. Food'}
              placeholderTextColor={colors.textSubdued}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            {error && <Text style={[styles.error, { color: colors.numberNegative }]}>{error}</Text>}

            {mode === 'group' && (
              <View style={[styles.row, { borderTopColor: colors.separator, borderBottomColor: colors.separator }]}>
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Income Group</Text>
                <Switch
                  value={isIncome}
                  onValueChange={setIsIncome}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            )}

            {mode === 'category' && (
              <>
                <Text style={[styles.label, { color: colors.textSubdued, marginTop: 16 }]}>Group</Text>
                {expenseGroups.map(group => (
                  <Pressable
                    key={group.id}
                    style={[
                      styles.groupOption,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: selectedGroupId === group.id ? colors.primary : colors.separator,
                      },
                    ]}
                    onPress={() => setSelectedGroupId(group.id)}
                  >
                    <Text style={[styles.groupOptionText, { color: colors.textPrimary }]}>{group.name}</Text>
                  </Pressable>
                ))}
              </>
            )}

            <Button onPress={handleSubmit} loading={loading} size="lg" style={{ marginTop: 24 }}>
              Create
            </Button>
          </View>
        )}
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
  chooseContainer: { padding: 24, gap: 12 },
  choiceButton: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  choiceTitle: { fontSize: 16, fontWeight: '600' },
  choiceSub: { fontSize: 13 },
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
  groupOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  groupOptionText: { fontSize: 15 },
})
