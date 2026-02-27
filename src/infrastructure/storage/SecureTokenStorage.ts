import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'actual_auth_token'
const SERVER_URL_KEY = 'actual_server_url'
const ACTIVE_FILE_ID_KEY = 'actual_active_file_id'
const ACTIVE_GROUP_ID_KEY = 'actual_active_group_id'

export class SecureTokenStorage {
  async saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  }

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY)
  }

  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  }

  async saveServerUrl(url: string): Promise<void> {
    await SecureStore.setItemAsync(SERVER_URL_KEY, url)
  }

  async getServerUrl(): Promise<string | null> {
    return SecureStore.getItemAsync(SERVER_URL_KEY)
  }

  async saveActiveFileId(fileId: string): Promise<void> {
    await SecureStore.setItemAsync(ACTIVE_FILE_ID_KEY, fileId)
  }

  async getActiveFileId(): Promise<string | null> {
    return SecureStore.getItemAsync(ACTIVE_FILE_ID_KEY)
  }

  async saveActiveGroupId(groupId: string): Promise<void> {
    await SecureStore.setItemAsync(ACTIVE_GROUP_ID_KEY, groupId)
  }

  async getActiveGroupId(): Promise<string | null> {
    return SecureStore.getItemAsync(ACTIVE_GROUP_ID_KEY)
  }

  async clearActiveFile(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACTIVE_FILE_ID_KEY),
      SecureStore.deleteItemAsync(ACTIVE_GROUP_ID_KEY),
    ])
  }
}
