import { EntityId, Money, TransactionDate } from '../value-objects'
import { ValidationError } from '../errors'

export interface TransactionProps {
  id: EntityId
  accountId: EntityId
  categoryId?: EntityId
  payeeId?: EntityId
  amount: Money
  date: TransactionDate
  notes?: string
  cleared: boolean
  reconciled: boolean
  tombstone: boolean
  isParent: boolean
  isChild: boolean
  parentId?: EntityId
  sortOrder: number
}

export class Transaction {
  private constructor(private props: TransactionProps) {}

  static create(props: {
    accountId: EntityId
    amount: Money
    date: TransactionDate
    categoryId?: EntityId
    payeeId?: EntityId
    notes?: string
  }): Transaction {
    return new Transaction({
      id: EntityId.create(),
      accountId: props.accountId,
      categoryId: props.categoryId,
      payeeId: props.payeeId,
      amount: props.amount,
      date: props.date,
      notes: props.notes,
      cleared: false,
      reconciled: false,
      tombstone: false,
      isParent: false,
      isChild: false,
      parentId: undefined,
      sortOrder: 0,
    })
  }

  static createChild(props: {
    parentId: EntityId
    accountId: EntityId
    amount: Money
    date: TransactionDate
    categoryId?: EntityId
    payeeId?: EntityId
    notes?: string
  }): Transaction {
    return new Transaction({
      id: EntityId.create(),
      accountId: props.accountId,
      categoryId: props.categoryId,
      payeeId: props.payeeId,
      amount: props.amount,
      date: props.date,
      notes: props.notes,
      cleared: false,
      reconciled: false,
      tombstone: false,
      isParent: false,
      isChild: true,
      parentId: props.parentId,
      sortOrder: 0,
    })
  }

  static reconstitute(props: TransactionProps): Transaction {
    return new Transaction(props)
  }

  get id(): EntityId {
    return this.props.id
  }

  get accountId(): EntityId {
    return this.props.accountId
  }

  get categoryId(): EntityId | undefined {
    return this.props.categoryId
  }

  get payeeId(): EntityId | undefined {
    return this.props.payeeId
  }

  get amount(): Money {
    return this.props.amount
  }

  get date(): TransactionDate {
    return this.props.date
  }

  get notes(): string | undefined {
    return this.props.notes
  }

  get cleared(): boolean {
    return this.props.cleared
  }

  get reconciled(): boolean {
    return this.props.reconciled
  }

  get tombstone(): boolean {
    return this.props.tombstone
  }

  get isParent(): boolean {
    return this.props.isParent
  }

  get isChild(): boolean {
    return this.props.isChild
  }

  get parentId(): EntityId | undefined {
    return this.props.parentId
  }

  get sortOrder(): number {
    return this.props.sortOrder
  }

  get isSplit(): boolean {
    return this.props.isParent || this.props.isChild
  }

  setCategory(categoryId: EntityId | undefined): void {
    this.props.categoryId = categoryId
  }

  setPayee(payeeId: EntityId | undefined): void {
    this.props.payeeId = payeeId
  }

  setAmount(amount: Money): void {
    this.props.amount = amount
  }

  setDate(date: TransactionDate): void {
    this.props.date = date
  }

  setNotes(notes: string | undefined): void {
    this.props.notes = notes
  }

  setSortOrder(order: number): void {
    if (order < 0) {
      throw new ValidationError('sortOrder', 'Sort order must be >= 0')
    }
    this.props.sortOrder = order
  }

  clear(): void {
    this.props.cleared = true
  }

  unclear(): void {
    if (this.props.reconciled) {
      throw new ValidationError(
        'cleared',
        'Cannot unclear a reconciled transaction'
      )
    }
    this.props.cleared = false
  }

  reconcile(): void {
    if (!this.props.cleared) {
      throw new ValidationError(
        'reconciled',
        'Cannot reconcile an uncleared transaction'
      )
    }
    this.props.reconciled = true
  }

  unreconcile(): void {
    this.props.reconciled = false
  }

  delete(): void {
    this.props.tombstone = true
  }

  restore(): void {
    this.props.tombstone = false
  }

  markAsParent(): void {
    this.props.isParent = true
  }

  toObject(): TransactionProps {
    return { ...this.props }
  }
}
