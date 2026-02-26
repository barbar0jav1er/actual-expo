import { InvalidDateError } from '../errors'

export class BudgetMonth {
  private constructor(
    private readonly year: number,
    private readonly month: number // 1-12
  ) {}

  static fromDate(date: Date): BudgetMonth {
    return new BudgetMonth(date.getFullYear(), date.getMonth() + 1)
  }

  static fromString(str: string): BudgetMonth {
    // Accept "2024-02" or "202402"
    let year: number
    let month: number

    if (str.includes('-')) {
      const parts = str.split('-')
      // Must be exactly YYYY-MM format
      if (parts.length !== 2 || parts[0].length !== 4 || parts[1].length !== 2) {
        throw new InvalidDateError(str)
      }
      year = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10)
    } else if (str.length === 6) {
      year = parseInt(str.substring(0, 4), 10)
      month = parseInt(str.substring(4, 6), 10)
    } else {
      throw new InvalidDateError(str)
    }

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 1) {
      throw new InvalidDateError(str)
    }

    return new BudgetMonth(year, month)
  }

  static fromNumber(n: number): BudgetMonth {
    const year = Math.floor(n / 100)
    const month = n % 100

    if (month < 1 || month > 12) {
      throw new InvalidDateError(n.toString())
    }

    return new BudgetMonth(year, month)
  }

  static current(): BudgetMonth {
    return BudgetMonth.fromDate(new Date())
  }

  getYear(): number {
    return this.year
  }

  getMonth(): number {
    return this.month
  }

  next(): BudgetMonth {
    return this.addMonths(1)
  }

  previous(): BudgetMonth {
    return this.addMonths(-1)
  }

  addMonths(n: number): BudgetMonth {
    const totalMonths = this.year * 12 + (this.month - 1) + n
    const newYear = Math.floor(totalMonths / 12)
    const newMonth = (totalMonths % 12) + 1
    return new BudgetMonth(newYear, newMonth)
  }

  toNumber(): number {
    return this.year * 100 + this.month
  }

  toString(): string {
    return `${this.year}-${this.month.toString().padStart(2, '0')}`
  }

  toDate(): Date {
    return new Date(this.year, this.month - 1, 1)
  }

  equals(other: BudgetMonth): boolean {
    return this.year === other.year && this.month === other.month
  }

  compareTo(other: BudgetMonth): number {
    const thisValue = this.year * 12 + this.month
    const otherValue = other.year * 12 + other.month
    return thisValue - otherValue
  }

  isAfter(other: BudgetMonth): boolean {
    return this.compareTo(other) > 0
  }

  isBefore(other: BudgetMonth): boolean {
    return this.compareTo(other) < 0
  }
}
