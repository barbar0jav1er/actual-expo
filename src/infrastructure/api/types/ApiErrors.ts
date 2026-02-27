export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    public readonly details?: string
  ) {
    super(`API Error ${status}: ${reason}`)
    this.name = 'ApiError'
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}
