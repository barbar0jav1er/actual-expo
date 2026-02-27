import { EntityId, Money, BudgetMonth } from '../value-objects'

export interface BudgetProps {
  id: EntityId
  month: BudgetMonth
  categoryId: EntityId
  budgeted: Money
  carryover: Money
  goal?: Money
}

export class Budget {
  private constructor(private props: BudgetProps) {}

  static create(props: {
    month: BudgetMonth
    categoryId: EntityId
    budgeted?: Money
  }): Budget {
    return new Budget({
      id: EntityId.create(),
      month: props.month,
      categoryId: props.categoryId,
      budgeted: props.budgeted ?? Money.zero(),
      carryover: Money.zero(),
      goal: undefined,
    })
  }

  static reconstitute(props: BudgetProps): Budget {
    return new Budget(props)
  }

  get id(): EntityId { return this.props.id }
  get month(): BudgetMonth { return this.props.month }
  get categoryId(): EntityId { return this.props.categoryId }
  get budgeted(): Money { return this.props.budgeted }
  get carryover(): Money { return this.props.carryover }
  get goal(): Money | undefined { return this.props.goal }

  getAvailable(spent: Money): Money {
    return this.props.budgeted
      .add(this.props.carryover)
      .subtract(spent.abs())
  }

  getOverspent(spent: Money): Money {
    const available = this.getAvailable(spent)
    return available.isNegative() ? available.abs() : Money.zero()
  }

  isOverBudget(spent: Money): boolean {
    return this.getAvailable(spent).isNegative()
  }

  hasGoal(): boolean {
    return this.props.goal !== undefined && !this.props.goal.isZero()
  }

  getGoalProgress(spent: Money): number {
    if (!this.props.goal || this.props.goal.isZero()) return 0
    const available = this.getAvailable(spent)
    return Math.min(1, available.toCents() / this.props.goal.toCents())
  }

  setBudgeted(amount: Money): void {
    this.props.budgeted = amount
  }

  setCarryover(amount: Money): void {
    this.props.carryover = amount
  }

  setGoal(amount: Money | undefined): void {
    this.props.goal = amount
  }

  toObject(): BudgetProps {
    return { ...this.props }
  }
}
