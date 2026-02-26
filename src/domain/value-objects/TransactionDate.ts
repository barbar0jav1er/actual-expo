import { InvalidDateError } from '../errors'
import { BudgetMonth } from './BudgetMonth'

export class TransactionDate {
  private constructor(private readonly value: number) {}

  static fromDate(date: Date): TransactionDate {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const value = year * 10000 + month * 100 + day
    return new TransactionDate(value)
  }

  static fromString(str: string): TransactionDate {
    // Accept "YYYY-MM-DD" format
    const parts = str.split('-')
    if (parts.length !== 3) {
      throw new InvalidDateError(str)
    }

    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new InvalidDateError(str)
    }

    if (!TransactionDate.isValidDate(year, month, day)) {
      throw new InvalidDateError(str)
    }

    const value = year * 10000 + month * 100 + day
    return new TransactionDate(value)
  }

  static fromNumber(n: number): TransactionDate {
    const year = Math.floor(n / 10000)
    const month = Math.floor((n % 10000) / 100)
    const day = n % 100

    if (!TransactionDate.isValidDate(year, month, day)) {
      throw new InvalidDateError(n.toString())
    }

    return new TransactionDate(n)
  }

  static today(): TransactionDate {
    return TransactionDate.fromDate(new Date())
  }

  private static isValidDate(year: number, month: number, day: number): boolean {
    if (month < 1 || month > 12) return false
    if (day < 1 || day > 31) return false

    // Check days in month
    const daysInMonth = new Date(year, month, 0).getDate()
    if (day > daysInMonth) return false

    return true
  }

  getYear(): number {
    return Math.floor(this.value / 10000)
  }

  getMonth(): number {
    return Math.floor((this.value % 10000) / 100)
  }

  getDay(): number {
    return this.value % 100
  }

  toNumber(): number {
    return this.value
  }

  toString(): string {
    const year = this.getYear()
    const month = this.getMonth().toString().padStart(2, '0')
    const day = this.getDay().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  toDate(): Date {
    return new Date(this.getYear(), this.getMonth() - 1, this.getDay())
  }

  getBudgetMonth(): BudgetMonth {
    return BudgetMonth.fromNumber(this.getYear() * 100 + this.getMonth())
  }

  equals(other: TransactionDate): boolean {
    return this.value === other.value
  }

  compareTo(other: TransactionDate): number {
    return this.value - other.value
  }

  isBefore(other: TransactionDate): boolean {
    return this.value < other.value
  }

  isAfter(other: TransactionDate): boolean {
    return this.value > other.value
  }

  addDays(days: number): TransactionDate {
    const date = this.toDate()
    date.setDate(date.getDate() + days)
    return TransactionDate.fromDate(date)
  }
}
