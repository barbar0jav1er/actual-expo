import type { HttpClient } from '../HttpClient'
import { ApiError } from '../types/ApiErrors'
import type { ApiResponse, FileInfo, FileMetadata } from '../types/ApiResponses'

export class FileEndpoints {
  constructor(
    private http: HttpClient,
    private getToken: () => string | null
  ) {}

  async listFiles(): Promise<FileInfo[]> {
    const token = this.requireToken()
    const response = await this.http.get<ApiResponse<FileInfo[]>>(
      '/sync/list-user-files',
      { headers: { 'x-actual-token': token } }
    )
    return response.data
  }

  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    const token = this.requireToken()
    try {
      const response = await this.http.get<ApiResponse<FileInfo>>(
        '/sync/get-user-file-info',
        {
          headers: {
            'x-actual-token': token,
            'x-actual-file-id': fileId,
          },
        }
      )
      return response.data
    } catch (error) {
      if (error instanceof ApiError && error.reason === 'file-not-found') {
        return null
      }
      throw error
    }
  }

  async downloadFile(fileId: string): Promise<Uint8Array> {
    const token = this.requireToken()
    const response = await fetch(
      `${this.http.baseUrl}/sync/download-user-file`,
      {
        headers: {
          'x-actual-token': token,
          'x-actual-file-id': fileId,
        },
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { reason?: string }
      throw new ApiError(response.status, body.reason ?? 'download-failed')
    }

    return new Uint8Array(await response.arrayBuffer())
  }

  async uploadFile(
    fileId: string,
    data: Uint8Array,
    metadata: FileMetadata
  ): Promise<{ groupId: string }> {
    const token = this.requireToken()
    const response = await fetch(
      `${this.http.baseUrl}/sync/upload-user-file`,
      {
        method: 'POST',
        headers: {
          'x-actual-token': token,
          'x-actual-file-id': fileId,
          'x-actual-name': encodeURIComponent(metadata.name),
          ...(metadata.groupId && { 'x-actual-group-id': metadata.groupId }),
          ...(metadata.encryptMeta && {
            'x-actual-encrypt-meta': JSON.stringify(metadata.encryptMeta),
          }),
          ...(metadata.format !== undefined && {
            'x-actual-format': String(metadata.format),
          }),
          'Content-Type': 'application/encrypted-file',
        },
        body: data,
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { reason?: string }
      throw new ApiError(response.status, body.reason ?? 'upload-failed')
    }

    const result = await response.json() as { groupId: string }
    return { groupId: result.groupId }
  }

  async deleteFile(fileId: string): Promise<void> {
    const token = this.requireToken()
    await this.http.post(
      '/sync/delete-user-file',
      { fileId },
      { headers: { 'x-actual-token': token } }
    )
  }

  async resetFile(fileId: string): Promise<void> {
    const token = this.requireToken()
    await this.http.post(
      '/sync/reset-user-file',
      { fileId },
      { headers: { 'x-actual-token': token } }
    )
  }

  private requireToken(): string {
    const token = this.getToken()
    if (!token) throw new Error('No auth token set')
    return token
  }
}
