import type { HttpClient } from '../HttpClient'
import { ApiError } from '../types/ApiErrors'
import type { ApiResponse, EncryptionKey } from '../types/ApiResponses'

export class SyncEndpoints {
  constructor(
    private http: HttpClient,
    private getToken: () => string | null
  ) {}

  async sync(request: Uint8Array): Promise<Uint8Array> {
    const token = this.requireToken()
    return this.http.postBinary('/sync/sync', request, {
      headers: {
        'x-actual-token': token,
        'Content-Type': 'application/actual-sync',
      },
    })
  }

  async getUserKey(fileId: string): Promise<EncryptionKey | null> {
    const token = this.requireToken()
    try {
      const response = await this.http.post<ApiResponse<EncryptionKey>>(
        '/sync/user-get-key',
        { fileId },
        { headers: { 'x-actual-token': token } }
      )
      return response.data
    } catch (error) {
      if (error instanceof ApiError && error.reason === 'file-not-found') {
        return null
      }
      throw error
    }
  }

  async createUserKey(
    fileId: string,
    keyId: string,
    keySalt: string,
    testContent: string
  ): Promise<void> {
    const token = this.requireToken()
    await this.http.post(
      '/sync/user-create-key',
      { fileId, keyId, keySalt, testContent },
      { headers: { 'x-actual-token': token } }
    )
  }

  private requireToken(): string {
    const token = this.getToken()
    if (!token) throw new Error('No auth token set')
    return token
  }
}
