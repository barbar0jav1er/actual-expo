import { DomainError } from './DomainError'

export class NotFoundError extends DomainError {
  constructor(
    public readonly entity: string,
    public readonly id?: string
  ) {
    super(id ? `${entity} not found: ${id}` : `${entity} not found`)
  }
}
