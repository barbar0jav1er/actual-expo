import { InvalidMoneyError } from '../errors'

export class Money {
  private constructor(private readonly cents: number) {}

  // Factory methods
  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyError('Cents must be an integer')
    }
    return new Money(cents)
  }

  static fromDollars(dollars: number): Money {
    const cents = Math.round(dollars * 100)
    return new Money(cents)
  }

  static zero(): Money {
    return new Money(0)
  }

  // Arithmetic operations (immutable)
  add(other: Money): Money {
    return new Money(this.cents + other.cents)
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents)
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor))
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new InvalidMoneyError('Cannot divide by zero')
    }
    return new Money(Math.round(this.cents / divisor))
  }

  abs(): Money {
    return new Money(Math.abs(this.cents))
  }

  negate(): Money {
    return new Money(-this.cents)
  }

  // Predicates
  isPositive(): boolean {
    return this.cents > 0
  }

  isNegative(): boolean {
    return this.cents < 0
  }

  isZero(): boolean {
    return this.cents === 0
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents
  }

  isLessThanOrEqual(other: Money): boolean {
    return this.cents <= other.cents
  }

  // Conversions
  toCents(): number {
    return this.cents
  }

  toDollars(): number {
    return this.cents / 100
  }

  format(locale: string = 'en-US', currency: string = 'USD'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(this.toDollars())
  }

  // Comparison
  equals(other: Money): boolean {
    return this.cents === other.cents
  }

  compareTo(other: Money): number {
    return this.cents - other.cents
  }
}
