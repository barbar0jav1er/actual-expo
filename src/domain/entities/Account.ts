import { EntityId } from '../value-objects'
import { ValidationError } from '../errors'

export interface AccountProps {
  id: EntityId
  name: string
  offbudget: boolean
  closed: boolean
  sortOrder: number
  tombstone: boolean
}

export class Account {
  private constructor(private props: AccountProps) {}

  static create(props: { name: string; offbudget?: boolean }): Account {
    if (!props.name || props.name.trim().length === 0) {
      throw new ValidationError('name', 'Account name cannot be empty')
    }

    return new Account({
      id: EntityId.create(),
      name: props.name.trim(),
      offbudget: props.offbudget ?? false,
      closed: false,
      sortOrder: 0,
      tombstone: false,
    })
  }

  static reconstitute(props: AccountProps): Account {
    return new Account(props)
  }

  get id(): EntityId {
    return this.props.id
  }

  get name(): string {
    return this.props.name
  }

  get offbudget(): boolean {
    return this.props.offbudget
  }

  get closed(): boolean {
    return this.props.closed
  }

  get sortOrder(): number {
    return this.props.sortOrder
  }

  get tombstone(): boolean {
    return this.props.tombstone
  }

  get isActive(): boolean {
    return !this.props.closed && !this.props.tombstone
  }

  rename(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('name', 'Account name cannot be empty')
    }
    this.props.name = name.trim()
  }

  close(): void {
    this.props.closed = true
  }

  reopen(): void {
    this.props.closed = false
  }

  setOffbudget(value: boolean): void {
    this.props.offbudget = value
  }

  setSortOrder(order: number): void {
    if (order < 0) {
      throw new ValidationError('sortOrder', 'Sort order must be >= 0')
    }
    this.props.sortOrder = order
  }

  delete(): void {
    this.props.tombstone = true
  }

  restore(): void {
    this.props.tombstone = false
  }

  toObject(): AccountProps {
    return { ...this.props }
  }
}
