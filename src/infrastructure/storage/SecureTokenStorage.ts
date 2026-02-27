import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'actual_auth_token'
const SERVER_URL_KEY = 'actual_server_url'

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
}
