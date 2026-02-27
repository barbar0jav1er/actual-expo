import type { HttpClient } from '../HttpClient'
import type { ApiResponse, BootstrapInfo, UserInfo } from '../types/ApiResponses'

export class AuthEndpoints {
  constructor(
    private http: HttpClient,
    private getToken: () => string | null
  ) {}

  async needsBootstrap(): Promise<BootstrapInfo> {
    const response = await this.http.get<ApiResponse<BootstrapInfo>>(
      '/account/needs-bootstrap'
    )
    return response.data
  }

  async login(password: string): Promise<string> {
    const response = await this.http.post<ApiResponse<{ token: string }>>(
      '/account/login',
      { password }
    )
    return response.data.token
  }

  async validate(): Promise<UserInfo> {
    const token = this.requireToken()
    const response = await this.http.get<ApiResponse<UserInfo>>(
      '/account/validate',
      { headers: { 'x-actual-token': token } }
    )
    return response.data
  }

  async changePassword(newPassword: string): Promise<void> {
    const token = this.requireToken()
    await this.http.post(
      '/account/change-password',
      { password: newPassword },
      { headers: { 'x-actual-token': token } }
    )
  }

  private requireToken(): string {
    const token = this.getToken()
    if (!token) throw new Error('No auth token set')
    return token
  }
}
