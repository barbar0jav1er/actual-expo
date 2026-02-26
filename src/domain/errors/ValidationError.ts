import { DomainError } from './DomainError'

export class ValidationError extends DomainError {
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(`Validation failed for ${field}: ${reason}`)
  }
}

export class InvalidEntityIdError extends ValidationError {
  constructor(value: string) {
    super('id', `Invalid UUID format: ${value}`)
  }
}

export class InvalidMoneyError extends ValidationError {
  constructor(reason: string) {
    super('money', reason)
  }
}

export class InvalidDateError extends ValidationError {
  constructor(value: string) {
    super('date', `Invalid date: ${value}`)
  }
}

export class InvalidTimestampError extends ValidationError {
  constructor(value: string) {
    super('timestamp', `Invalid HULC timestamp: ${value}`)
  }
}
