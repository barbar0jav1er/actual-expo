import { EntityId } from '../value-objects'
import { ValidationError } from '../errors'

export interface CategoryProps {
  id: EntityId
  name: string
  groupId: EntityId
  isIncome: boolean
  hidden: boolean
  sortOrder: number
  tombstone: boolean
}

export class Category {
  private constructor(private props: CategoryProps) {}

  static create(props: {
    name: string
    groupId: EntityId
    isIncome?: boolean
  }): Category {
    if (!props.name || props.name.trim().length === 0) {
      throw new ValidationError('name', 'Category name cannot be empty')
    }

    return new Category({
      id: EntityId.create(),
      name: props.name.trim(),
      groupId: props.groupId,
      isIncome: props.isIncome ?? false,
      hidden: false,
      sortOrder: 0,
      tombstone: false,
    })
  }

  static reconstitute(props: CategoryProps): Category {
    return new Category(props)
  }

  get id(): EntityId {
    return this.props.id
  }

  get name(): string {
    return this.props.name
  }

  get groupId(): EntityId {
    return this.props.groupId
  }

  get isIncome(): boolean {
    return this.props.isIncome
  }

  get hidden(): boolean {
    return this.props.hidden
  }

  get sortOrder(): number {
    return this.props.sortOrder
  }

  get tombstone(): boolean {
    return this.props.tombstone
  }

  get isActive(): boolean {
    return !this.props.hidden && !this.props.tombstone
  }

  rename(name: string): void {
    const trimmed = (name ?? '').trim()
    if (!trimmed) {
      throw new ValidationError('name', 'Category name cannot be empty')
    }
    this.props.name = trimmed
  }

  moveTo(groupId: EntityId): void {
    this.props.groupId = groupId
  }

  hide(): void {
    this.props.hidden = true
  }

  show(): void {
    this.props.hidden = false
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

  toObject(): CategoryProps {
    return { ...this.props }
  }
}
