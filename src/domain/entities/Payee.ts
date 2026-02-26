import { EntityId } from '../value-objects'
import { ValidationError } from '../errors'

export interface PayeeProps {
  id: EntityId
  name: string
  transferAccountId?: EntityId
  tombstone: boolean
}

export class Payee {
  private constructor(private props: PayeeProps) {}

  static create(props: { name: string }): Payee {
    if (!props.name || props.name.trim().length === 0) {
      throw new ValidationError('name', 'Payee name cannot be empty')
    }

    return new Payee({
      id: EntityId.create(),
      name: props.name.trim(),
      transferAccountId: undefined,
      tombstone: false,
    })
  }

  static createTransferPayee(props: {
    name: string
    accountId: EntityId
  }): Payee {
    if (!props.name || props.name.trim().length === 0) {
      throw new ValidationError('name', 'Payee name cannot be empty')
    }

    return new Payee({
      id: EntityId.create(),
      name: props.name.trim(),
      transferAccountId: props.accountId,
      tombstone: false,
    })
  }

  static reconstitute(props: PayeeProps): Payee {
    return new Payee(props)
  }

  get id(): EntityId {
    return this.props.id
  }

  get name(): string {
    return this.props.name
  }

  get transferAccountId(): EntityId | undefined {
    return this.props.transferAccountId
  }

  get tombstone(): boolean {
    return this.props.tombstone
  }

  get isTransferPayee(): boolean {
    return this.props.transferAccountId !== undefined
  }

  get isActive(): boolean {
    return !this.props.tombstone
  }

  rename(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('name', 'Payee name cannot be empty')
    }
    this.props.name = name.trim()
  }

  delete(): void {
    this.props.tombstone = true
  }

  restore(): void {
    this.props.tombstone = false
  }

  toObject(): PayeeProps {
    return { ...this.props }
  }
}
