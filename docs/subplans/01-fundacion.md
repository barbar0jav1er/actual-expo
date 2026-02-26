# Subplan 1: Fundacion (Domain Layer Core)

## Objetivo

Establecer la base del dominio con Value Objects y Entidades puras, sin dependencias externas. Esta capa sera 100% testeable con unit tests.

## Dependencias

- Ninguna (es el primer subplan)

## Archivos a Crear

```
actual-expo/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    └── domain/
        ├── value-objects/
        │   ├── Money.ts
        │   ├── Money.test.ts
        │   ├── EntityId.ts
        │   ├── EntityId.test.ts
        │   ├── Timestamp.ts
        │   ├── Timestamp.test.ts
        │   ├── BudgetMonth.ts
        │   ├── BudgetMonth.test.ts
        │   ├── TransactionDate.ts
        │   ├── TransactionDate.test.ts
        │   └── index.ts
        ├── entities/
        │   ├── Account.ts
        │   ├── Account.test.ts
        │   ├── Transaction.ts
        │   ├── Transaction.test.ts
        │   ├── Category.ts
        │   ├── Category.test.ts
        │   ├── CategoryGroup.ts
        │   ├── CategoryGroup.test.ts
        │   ├── Payee.ts
        │   ├── Payee.test.ts
        │   └── index.ts
        ├── ports/
        │   └── repositories/
        │       ├── AccountRepository.ts
        │       ├── TransactionRepository.ts
        │       ├── CategoryRepository.ts
        │       ├── PayeeRepository.ts
        │       └── index.ts
        ├── errors/
        │   ├── DomainError.ts
        │   ├── ValidationError.ts
        │   └── index.ts
        └── index.ts
```

---

## Value Objects

### Money

Representa montos monetarios en centavos (integer).

```typescript
class Money {
  private constructor(private readonly cents: number) {}

  // Factory methods
  static fromCents(cents: number): Money
  static fromDollars(dollars: number): Money
  static zero(): Money

  // Operaciones aritmeticas (inmutables)
  add(other: Money): Money
  subtract(other: Money): Money
  multiply(factor: number): Money
  divide(divisor: number): Money
  abs(): Money
  negate(): Money

  // Predicados
  isPositive(): boolean
  isNegative(): boolean
  isZero(): boolean
  isGreaterThan(other: Money): boolean
  isLessThan(other: Money): boolean

  // Conversiones
  toCents(): number
  toDollars(): number
  format(locale?: string, currency?: string): string

  // Comparacion
  equals(other: Money): boolean
  compareTo(other: Money): number
}
```

**Tests requeridos:**
- Creacion desde centavos y dolares
- Operaciones aritmeticas basicas
- Manejo de numeros negativos
- Formateo con diferentes locales
- Comparaciones

---

### EntityId

Wrapper para UUIDs con validacion.

```typescript
class EntityId {
  private constructor(private readonly value: string) {}

  // Factory methods
  static create(): EntityId              // Genera nuevo UUID v4
  static fromString(id: string): EntityId // Valida y parsea

  // Metodos
  toString(): string
  equals(other: EntityId): boolean
}
```

**Tests requeridos:**
- Generacion de UUIDs unicos
- Validacion de formato UUID
- Rechazo de strings invalidos
- Comparacion de igualdad

---

### Timestamp (HULC)

Hybrid Unique Logical Clock para sincronizacion CRDT.

```typescript
class Timestamp {
  private constructor(
    private readonly millis: number,
    private readonly counter: number,
    private readonly node: string
  ) {}

  static MAX_DRIFT = 5 * 60 * 1000  // 5 minutos

  // Factory methods
  static now(node: string): Timestamp
  static parse(str: string): Timestamp | null

  // Getters
  getMillis(): number
  getCounter(): number
  getNode(): string

  // Serialization
  toString(): string
  // Formato: "2024-02-26T12:00:00.000Z-0000-abc123def4567890"

  // Comparacion
  compareTo(other: Timestamp): number
  equals(other: Timestamp): boolean
}
```

**Formato del string:**
```
2024-02-26T12:00:00.000Z-0000-abc123def4567890
└────────ISO 8601───────┘ └ctr┘ └────node id────┘
```

**Tests requeridos:**
- Parsing de strings validos
- Rechazo de strings invalidos
- Comparacion correcta
- Serializacion round-trip

---

### BudgetMonth

Representa un mes de presupuesto (YYYYMM).

```typescript
class BudgetMonth {
  private constructor(
    private readonly year: number,
    private readonly month: number  // 1-12
  ) {}

  // Factory methods
  static fromDate(date: Date): BudgetMonth
  static fromString(str: string): BudgetMonth  // "2024-02" o "202402"
  static fromNumber(n: number): BudgetMonth    // 202402
  static current(): BudgetMonth

  // Getters
  getYear(): number
  getMonth(): number

  // Navegacion
  next(): BudgetMonth
  previous(): BudgetMonth
  addMonths(n: number): BudgetMonth

  // Conversiones
  toNumber(): number      // 202402
  toString(): string      // "2024-02"
  toDate(): Date          // Primer dia del mes

  // Comparacion
  equals(other: BudgetMonth): boolean
  compareTo(other: BudgetMonth): number
}
```

**Tests requeridos:**
- Creacion desde diferentes formatos
- Navegacion entre meses
- Cruce de ano (diciembre -> enero)
- Comparaciones

---

### TransactionDate

Fecha de transaccion como integer YYYYMMDD.

```typescript
class TransactionDate {
  private constructor(private readonly value: number) {}

  // Factory methods
  static fromDate(date: Date): TransactionDate
  static fromString(str: string): TransactionDate  // "2024-02-26"
  static fromNumber(n: number): TransactionDate    // 20240226
  static today(): TransactionDate

  // Getters
  getYear(): number
  getMonth(): number
  getDay(): number

  // Conversiones
  toNumber(): number      // 20240226
  toString(): string      // "2024-02-26"
  toDate(): Date
  getBudgetMonth(): BudgetMonth

  // Comparacion
  equals(other: TransactionDate): boolean
  compareTo(other: TransactionDate): number
  isBefore(other: TransactionDate): boolean
  isAfter(other: TransactionDate): boolean
}
```

**Tests requeridos:**
- Creacion desde diferentes formatos
- Validacion de fechas invalidas (30 de febrero, etc.)
- Conversiones
- Comparaciones

---

## Entidades

### Account

```typescript
interface AccountProps {
  id: EntityId
  name: string
  offbudget: boolean
  closed: boolean
  sortOrder: number
  tombstone: boolean
}

class Account {
  private constructor(private props: AccountProps) {}

  // Factory methods
  static create(props: { name: string; offbudget?: boolean }): Account
  static reconstitute(props: AccountProps): Account

  // Getters
  get id(): EntityId
  get name(): string
  get offbudget(): boolean
  get closed(): boolean
  get sortOrder(): number
  get tombstone(): boolean
  get isActive(): boolean  // !closed && !tombstone

  // Mutaciones
  rename(name: string): void
  close(): void
  reopen(): void
  setOffbudget(value: boolean): void
  setSortOrder(order: number): void
  delete(): void  // Sets tombstone = true

  // Serialization
  toObject(): AccountProps
}
```

**Invariantes:**
- `name` no puede estar vacio
- `sortOrder` debe ser >= 0

---

### Transaction

```typescript
interface TransactionProps {
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

class Transaction {
  private constructor(private props: TransactionProps) {}

  // Factory methods
  static create(props: {
    accountId: EntityId
    amount: Money
    date: TransactionDate
    categoryId?: EntityId
    payeeId?: EntityId
    notes?: string
  }): Transaction

  static reconstitute(props: TransactionProps): Transaction

  // Getters
  get id(): EntityId
  get accountId(): EntityId
  get categoryId(): EntityId | undefined
  get payeeId(): EntityId | undefined
  get amount(): Money
  get date(): TransactionDate
  get notes(): string | undefined
  get cleared(): boolean
  get reconciled(): boolean
  get tombstone(): boolean
  get isParent(): boolean
  get isChild(): boolean
  get parentId(): EntityId | undefined
  get isSplit(): boolean  // isParent || isChild

  // Mutaciones
  setCategory(categoryId: EntityId | undefined): void
  setPayee(payeeId: EntityId | undefined): void
  setAmount(amount: Money): void
  setDate(date: TransactionDate): void
  setNotes(notes: string | undefined): void
  clear(): void
  unclear(): void
  reconcile(): void
  unreconcile(): void
  delete(): void

  // Serialization
  toObject(): TransactionProps
}
```

**Invariantes:**
- `accountId` es requerido
- `date` es requerido
- Si `isChild`, debe tener `parentId`
- Si `reconciled`, debe estar `cleared`

---

### Category

```typescript
interface CategoryProps {
  id: EntityId
  name: string
  groupId: EntityId
  isIncome: boolean
  hidden: boolean
  sortOrder: number
  tombstone: boolean
}

class Category {
  private constructor(private props: CategoryProps) {}

  static create(props: {
    name: string
    groupId: EntityId
    isIncome?: boolean
  }): Category

  static reconstitute(props: CategoryProps): Category

  // Getters y mutaciones similares a Account

  toObject(): CategoryProps
}
```

---

### CategoryGroup

```typescript
interface CategoryGroupProps {
  id: EntityId
  name: string
  isIncome: boolean
  hidden: boolean
  sortOrder: number
  tombstone: boolean
}

class CategoryGroup {
  private constructor(private props: CategoryGroupProps) {}

  static create(props: { name: string; isIncome?: boolean }): CategoryGroup
  static reconstitute(props: CategoryGroupProps): CategoryGroup

  // Getters y mutaciones

  toObject(): CategoryGroupProps
}
```

---

### Payee

```typescript
interface PayeeProps {
  id: EntityId
  name: string
  transferAccountId?: EntityId
  tombstone: boolean
}

class Payee {
  private constructor(private props: PayeeProps) {}

  static create(props: { name: string }): Payee
  static createTransferPayee(props: {
    name: string
    accountId: EntityId
  }): Payee
  static reconstitute(props: PayeeProps): Payee

  // Getters
  get isTransferPayee(): boolean

  // Mutaciones

  toObject(): PayeeProps
}
```

---

## Ports (Repository Interfaces)

### AccountRepository

```typescript
interface AccountRepository {
  findById(id: EntityId): Promise<Account | null>
  findAll(): Promise<Account[]>
  findActive(): Promise<Account[]>
  save(account: Account): Promise<void>
  delete(id: EntityId): Promise<void>
}
```

### TransactionRepository

```typescript
interface TransactionRepository {
  findById(id: EntityId): Promise<Transaction | null>
  findByAccount(accountId: EntityId): Promise<Transaction[]>
  findByDateRange(
    start: TransactionDate,
    end: TransactionDate
  ): Promise<Transaction[]>
  findByMonth(month: BudgetMonth): Promise<Transaction[]>
  findChildren(parentId: EntityId): Promise<Transaction[]>
  save(transaction: Transaction): Promise<void>
  saveMany(transactions: Transaction[]): Promise<void>
  delete(id: EntityId): Promise<void>
}
```

### CategoryRepository

```typescript
interface CategoryRepository {
  findById(id: EntityId): Promise<Category | null>
  findAll(): Promise<Category[]>
  findByGroup(groupId: EntityId): Promise<Category[]>
  save(category: Category): Promise<void>
  delete(id: EntityId): Promise<void>
}

interface CategoryGroupRepository {
  findById(id: EntityId): Promise<CategoryGroup | null>
  findAll(): Promise<CategoryGroup[]>
  save(group: CategoryGroup): Promise<void>
  delete(id: EntityId): Promise<void>
}
```

### PayeeRepository

```typescript
interface PayeeRepository {
  findById(id: EntityId): Promise<Payee | null>
  findAll(): Promise<Payee[]>
  findByName(name: string): Promise<Payee | null>
  findTransferPayee(accountId: EntityId): Promise<Payee | null>
  save(payee: Payee): Promise<void>
  delete(id: EntityId): Promise<void>
}
```

---

## Errores de Dominio

```typescript
// DomainError.ts
abstract class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

// ValidationError.ts
class ValidationError extends DomainError {
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(`Validation failed for ${field}: ${reason}`)
  }
}

class InvalidEntityIdError extends ValidationError {
  constructor(value: string) {
    super('id', `Invalid UUID format: ${value}`)
  }
}

class InvalidMoneyError extends ValidationError {
  constructor(reason: string) {
    super('money', reason)
  }
}

class InvalidDateError extends ValidationError {
  constructor(value: string) {
    super('date', `Invalid date: ${value}`)
  }
}
```

---

## Verificacion

### Comandos

```bash
# Ejecutar tests
npm run test

# Ejecutar tests con coverage
npm run test:coverage

# Type check
npm run typecheck
```

### Criterios de Exito

- [ ] Todos los Value Objects tienen tests unitarios
- [ ] Todas las Entidades tienen tests unitarios
- [ ] Cobertura de codigo >= 90%
- [ ] Sin errores de TypeScript
- [ ] Todas las validaciones funcionan correctamente

---

## Tiempo Estimado

- Value Objects: 4-6 horas
- Entidades: 4-6 horas
- Ports: 1-2 horas
- Errores: 1 hora
- Tests: Incluido en cada componente

**Total: 10-15 horas**
