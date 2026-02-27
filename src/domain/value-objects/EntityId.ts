import * as ExpoCrypto from 'expo-crypto'
import { InvalidEntityIdError } from '../errors'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class EntityId {
  private constructor(private readonly value: string) {}

  static create(): EntityId {
    const uuid = ExpoCrypto.randomUUID()
    return new EntityId(uuid)
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
