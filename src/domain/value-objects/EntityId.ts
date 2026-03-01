import { InvalidEntityIdError } from '../errors'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class EntityId {
  private constructor(private readonly value: string) {}

  static create(): EntityId {
    // crypto.randomUUID() is a Web API available in Expo/Hermes (RN 0.71+), Bun, and Node 16+
    return new EntityId(crypto.randomUUID())
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
