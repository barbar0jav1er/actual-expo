import { create } from 'zustand'
import { SecureTokenStorage } from '@infrastructure/storage'
import { ActualServerClient } from '@infrastructure/api'
import type { FileInfo } from '@infrastructure/api/types/ApiResponses'

interface FileState {
  files: FileInfo[]
  activeFileId: string | null
  activeGroupId: string | null
  isLoading: boolean
  error: string | null
}

interface FileActions {
  fetchFiles: () => Promise<void>
  selectFile: (fileId: string, groupId: string | null) => Promise<void>
  checkActiveFile: () => Promise<void>
  clearActiveFile: () => Promise<void>
}

const storage = new SecureTokenStorage()

export const useFileStore = create<FileState & FileActions>((set, get) => ({
  files: [],
  activeFileId: null,
  activeGroupId: null,
  isLoading: true,
  error: null,

  fetchFiles: async () => {
    set({ isLoading: true, error: null })
    try {
      const serverUrl = await storage.getServerUrl()
      const token = await storage.getToken()

      if (!serverUrl || !token) {
        set({ files: [], isLoading: false })
        return
      }

      const client = new ActualServerClient(serverUrl)
      client.setToken(token)

      const files = await client.files.listFiles()
      set({ files, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch files',
      })
    }
  },

  selectFile: async (fileId: string, groupId: string | null) => {
    try {
      await storage.saveActiveFileId(fileId)
      if (groupId) {
        await storage.saveActiveGroupId(groupId)
      }
      set({ activeFileId: fileId, activeGroupId: groupId })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to select file',
      })
      throw err
    }
  },

  checkActiveFile: async () => {
    set({ isLoading: true })
    try {
      const [activeFileId, activeGroupId] = await Promise.all([
        storage.getActiveFileId(),
        storage.getActiveGroupId(),
      ])
      set({ activeFileId, activeGroupId, isLoading: false })
    } catch {
      set({ activeFileId: null, activeGroupId: null, isLoading: false })
    }
  },

  clearActiveFile: async () => {
    await storage.clearActiveFile()
    set({ activeFileId: null, activeGroupId: null })
  },
}))
