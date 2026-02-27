import React, { useEffect } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '@/hooks/use-theme'
import { useFileStore, useAuthStore } from '@/presentation/stores'
import { Button, LoadingScreen } from '@/presentation/components/common'

export default function SelectFileScreen() {
  const colors = useTheme()
  const router = useRouter()
  const { files, fetchFiles, isLoading, error, selectFile } = useFileStore()
  const { logout } = useAuthStore()

  useEffect(() => {
    fetchFiles()
  }, [])

  async function handleSelect(fileId: string, groupId: string | null) {
    try {
      await selectFile(fileId, groupId)
      // Navigation is handled by the root layout / auth provider
    } catch (err) {
      console.error('Failed to select file', err)
    }
  }

  async function handleLogout() {
    await logout()
    // Auth provider will redirect to login
  }

  if (isLoading && files.length === 0) {
    return <LoadingScreen message="Loading files..." />
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Select Budget</Text>
          <Text style={[styles.subtitle, { color: colors.textSubdued }]}>
            Choose a budget file to open
          </Text>
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.numberNegative + '10' }]}>
            <Text style={[styles.errorText, { color: colors.numberNegative }]}>{error}</Text>
            <Button onPress={fetchFiles} size="sm" style={{ marginTop: 8 }}>
              Try Again
            </Button>
          </View>
        )}

        <FlatList
          data={files}
          keyExtractor={(item) => item.fileId}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item.fileId, item.groupId)}
              style={({ pressed }) => [
                styles.fileItem,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.separator,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={styles.fileIcon}>
                <Text style={styles.fileIconText}>B</Text>
              </View>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.fileId, { color: colors.textSubdued }]}>ID: {item.fileId}</Text>
              </View>
            </Pressable>
          )}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchFiles} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSubdued }]}>
                  No budget files found on this server.
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSubdued }]}>
                  You might need to create one on the desktop client first.
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.list}
        />

        <View style={styles.footer}>
          <Button variant="ghost" onPress={handleLogout}>
            Switch Server / Logout
          </Button>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fileIconText: { color: 'white', fontSize: 24, fontWeight: '700' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 16, fontWeight: '600' },
  fileId: { fontSize: 12, marginTop: 2 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  errorBox: { margin: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  errorText: { fontSize: 14, textAlign: 'center' },
  footer: { padding: 16, alignItems: 'center' },
})
