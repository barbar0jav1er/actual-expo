import React, { useEffect, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/use-theme'
import { SwipeableRow, showConfirmDialog, Button } from '@/presentation/components/common'
import { usePayeesStore } from '@/presentation/stores'

export default function PayeesScreen() {
  const router = useRouter()
  const colors = useTheme()
  const { payees, isLoading, fetchPayees, createPayee, deletePayee } = usePayeesStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchPayees()
  }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createPayee(newName.trim())
      setNewName('')
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  function handleDelete(id: string, name: string) {
    showConfirmDialog({
      title: 'Delete Payee',
      message: `Delete "${name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deletePayee(id),
    })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator, backgroundColor: colors.cardBackground }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Payees</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Payee list */}
      <FlatList
        data={payees}
        keyExtractor={item => item.id}
        refreshing={isLoading}
        onRefresh={fetchPayees}
        renderItem={({ item }) => (
          <SwipeableRow
            onDelete={() => handleDelete(item.id, item.name)}
            onEdit={() => router.push(`/payee/${item.id}`)}
          >
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.separator, backgroundColor: colors.cardBackground, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => router.push(`/payee/${item.id}`)}
            >
              <Text style={[styles.payeeName, { color: colors.textPrimary }]}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSubdued} />
            </Pressable>
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSubdued }]}>No payees yet</Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => setShowCreate(true)}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* Create payee modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView
          style={[styles.modal, { backgroundColor: colors.pageBackground }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.separator }]}>
            <Pressable onPress={() => { setNewName(''); setShowCreate(false) }}>
              <Text style={[styles.modalCancel, { color: colors.textSubdued }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Payee</Text>
            <View style={{ width: 56 }} />
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.textPrimary, borderColor: colors.separator }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Payee name"
              placeholderTextColor={colors.textSubdued}
              autoFocus
            />
            <Button onPress={handleCreate} loading={creating} size="lg" style={{ marginTop: 20 }}>
              Add Payee
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  payeeName: { flex: 1, fontSize: 16 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  modalCancel: { fontSize: 16, width: 56 },
  modalBody: { padding: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
})
