/**
 * In-memory implementation of the token storage contract.
 * Use in tests and scripts where expo-secure-store is not available.
 */
export class InMemoryTokenStorage {
  private store = new Map<string, string>()

  async saveToken(token: string): Promise<void> {
    this.store.set('token', token)
  }

  async getToken(): Promise<string | null> {
    return this.store.get('token') ?? null
  }

  async clearToken(): Promise<void> {
    this.store.delete('token')
  }

  async saveServerUrl(url: string): Promise<void> {
    this.store.set('serverUrl', url)
  }

  async getServerUrl(): Promise<string | null> {
    return this.store.get('serverUrl') ?? null
  }

  async saveActiveFileId(fileId: string): Promise<void> {
    this.store.set('fileId', fileId)
  }

  async getActiveFileId(): Promise<string | null> {
    return this.store.get('fileId') ?? null
  }

  async saveActiveGroupId(groupId: string): Promise<void> {
    this.store.set('groupId', groupId)
  }

  async getActiveGroupId(): Promise<string | null> {
    return this.store.get('groupId') ?? null
  }

  async clearActiveFile(): Promise<void> {
    this.store.delete('fileId')
    this.store.delete('groupId')
  }
}
