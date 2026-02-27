import { HttpClient } from './HttpClient'
import { AuthEndpoints } from './endpoints/AuthEndpoints'
import { SyncEndpoints } from './endpoints/SyncEndpoints'
import { FileEndpoints } from './endpoints/FileEndpoints'

export class ActualServerClient {
  private httpClient: HttpClient
  private token: string | null = null

  constructor(serverUrl: string) {
    this.httpClient = new HttpClient({ baseUrl: serverUrl })
  }

  setToken(token: string): void {
    this.token = token
  }

  clearToken(): void {
    this.token = null
  }

  get isAuthenticated(): boolean {
    return this.token !== null
  }

  get auth(): AuthEndpoints {
    return new AuthEndpoints(this.httpClient, () => this.token)
  }

  get sync(): SyncEndpoints {
    return new SyncEndpoints(this.httpClient, () => this.token)
  }

  get files(): FileEndpoints {
    return new FileEndpoints(this.httpClient, () => this.token)
  }
}
