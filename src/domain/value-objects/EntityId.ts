import { InvalidEntityIdError } from '../errors'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Pure-JS UUID v4 generator — no platform dependencies.
 * Uses Math.random() which is universally available (React Native, Bun, Node, browser).
 * For budget-app IDs the collision probability (122 random bits) is negligible.
 */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export class EntityId {
  private constructor(private readonly value: string) {}

  static create(): EntityId {
    return new EntityId(uuidv4())
  }

  static fromString(id: string): EntityId {
    if (!EntityId.isValid(id)) {
      throw new InvalidEntityIdError(id)
    }
    return new EntityId(id.toLowerCase())
  }

  static isValid(id: string): boolean {
    return UUID_REGEX.test(id)
  }

  toString(): string {
    return this.value
  }

  equals(other: EntityId): boolean {
    return this.value === other.value
  }
}
