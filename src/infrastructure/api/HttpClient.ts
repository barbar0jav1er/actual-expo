import { ApiError, NetworkError } from './types/ApiErrors'

export interface HttpClientConfig {
  baseUrl: string
  timeout?: number
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
}

export class HttpClient {
  readonly baseUrl: string
  private readonly defaultTimeout: number

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.defaultTimeout = config.timeout ?? 30000
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options)
  }

  async post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('POST', path, body, options)
  }

  async postBinary(
    path: string,
    body: Uint8Array,
    options?: RequestOptions
  ): Promise<Uint8Array> {
    const url = `${this.baseUrl}${path}`
    const timeout = options?.timeout ?? this.defaultTimeout

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...options?.headers },
        body,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw await this.parseError(response)
      }

      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof ApiError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout')
      }
      throw new NetworkError(error instanceof Error ? error.message : String(error))
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const timeout = options?.timeout ?? this.defaultTimeout

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw await this.parseError(response)
      }

      return response.json() as Promise<T>
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof ApiError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout')
      }
      throw new NetworkError(error instanceof Error ? error.message : String(error))
    }
  }

  private async parseError(response: Response): Promise<ApiError> {
    try {
      const body = await response.json() as { reason?: string; details?: string }
      return new ApiError(response.status, body.reason ?? 'unknown', body.details)
    } catch {
      return new ApiError(response.status, 'unknown')
    }
  }
}
