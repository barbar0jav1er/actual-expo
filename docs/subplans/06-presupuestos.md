# Subplan 6: Presupuestos (Domain + Application)

## Objetivo

Implementar el sistema de envelope budgeting de Actual Budget.

## Dependencias

- **Subplan 1:** Entidades y Value Objects
- **Subplan 2:** Repositorios SQLite
- **Subplan 5:** Use Cases base

## Archivos a Crear

```
src/
├── domain/
│   ├── entities/
│   │   ├── Budget.ts
│   │   └── Budget.test.ts
│   └── ports/
│       └── repositories/
│           └── IBudgetRepository.ts
├── infrastructure/
│   └── persistence/
│       └── sqlite/
│           ├── repositories/
│           │   ├── SQLiteBudgetRepository.ts
│           │   └── SQLiteBudgetRepository.test.ts
│           └── migrations/
│               └── 003_budget_tables.ts
└── application/
    ├── use-cases/
    │   └── budget/
    │       ├── SetBudgetAmount.ts
    │       ├── SetBudgetAmount.test.ts
    │       ├── GetBudgetSummary.ts
    │       ├── GetBudgetSummary.test.ts
    │       ├── CopyBudgetMonth.ts
    │       ├── RolloverMonth.ts
    │       └── index.ts
    ├── services/
    │   ├── BudgetCalculationService.ts
    │   └── BudgetCalculationService.test.ts
    └── dtos/
        └── BudgetDTO.ts
```

---

## Migration: Budget Tables

```sql
-- 003_budget_tables.ts

-- Presupuestos por categoria/mes (Zero-Based)
CREATE TABLE zero_budgets (
  id TEXT PRIMARY KEY,
  month INTEGER NOT NULL,           -- YYYYMM
  category TEXT NOT NULL,           -- FK categories
  amount INTEGER DEFAULT 0,         -- Presupuestado (centavos)
  carryover INTEGER DEFAULT 0,      -- Sobrante del mes anterior
  goal INTEGER,                     -- Objetivo
  long_goal INTEGER,                -- Objetivo a largo plazo
  UNIQUE(month, category)
);

CREATE INDEX idx_zero_budgets_month ON zero_budgets(month);
CREATE INDEX idx_zero_budgets_category ON zero_budgets(category);

-- Registro de meses creados
CREATE TABLE created_budgets (
  month INTEGER PRIMARY KEY         -- YYYYMM
);
```

---

## Domain: Budget Entity

```typescript
interface BudgetProps {
  id: EntityId
  month: BudgetMonth
  categoryId: EntityId
  budgeted: Money
  carryover: Money
  goal?: Money
}

class Budget {
  private constructor(private props: BudgetProps) {}

  // Factory
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
      goal: undefined
    })
  }

  static reconstitute(props: BudgetProps): Budget {
    return new Budget(props)
  }

  // Getters
  get id(): EntityId { return this.props.id }
  get month(): BudgetMonth { return this.props.month }
  get categoryId(): EntityId { return this.props.categoryId }
  get budgeted(): Money { return this.props.budgeted }
  get carryover(): Money { return this.props.carryover }
  get goal(): Money | undefined { return this.props.goal }

  // Calculations
  getAvailable(spent: Money): Money {
    // available = budgeted + carryover - |spent|
    return this.budgeted
      .add(this.carryover)
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
    return this.goal !== undefined && !this.goal.isZero()
  }

  getGoalProgress(spent: Money): number {
    if (!this.goal || this.goal.isZero()) return 0
    const available = this.getAvailable(spent)
    return Math.min(1, available.toCents() / this.goal.toCents())
  }

  // Mutations
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
```

---

## Domain: IBudgetRepository

```typescript
interface IBudgetRepository {
  findById(id: EntityId): Promise<Budget | null>
  findByMonthAndCategory(
    month: BudgetMonth,
    categoryId: EntityId
  ): Promise<Budget | null>
  findByMonth(month: BudgetMonth): Promise<Budget[]>
  save(budget: Budget): Promise<void>
  saveMany(budgets: Budget[]): Promise<void>
  delete(id: EntityId): Promise<void>

  // Helpers
  isMonthCreated(month: BudgetMonth): Promise<boolean>
  markMonthCreated(month: BudgetMonth): Promise<void>
}
```

---

## SQLite Budget Repository

```typescript
interface BudgetRow {
  id: string
  month: number
  category: string
  amount: number
  carryover: number
  goal: number | null
  long_goal: number | null
}

class SQLiteBudgetRepository implements IBudgetRepository {
  constructor(private db: SQLiteDatabase) {}

  async findByMonthAndCategory(
    month: BudgetMonth,
    categoryId: EntityId
  ): Promise<Budget | null> {
    const row = await this.db.get<BudgetRow>(
      'SELECT * FROM zero_budgets WHERE month = ? AND category = ?',
      [month.toNumber(), categoryId.toString()]
    )
    return row ? this.toDomain(row) : null
  }

  async findByMonth(month: BudgetMonth): Promise<Budget[]> {
    const rows = await this.db.all<BudgetRow>(
      'SELECT * FROM zero_budgets WHERE month = ?',
      [month.toNumber()]
    )
    return rows.map(row => this.toDomain(row))
  }

  async save(budget: Budget): Promise<void> {
    const props = budget.toObject()
    await this.db.run(
      `INSERT INTO zero_budgets (id, month, category, amount, carryover, goal)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(month, category) DO UPDATE SET
         amount = excluded.amount,
         carryover = excluded.carryover,
         goal = excluded.goal`,
      [
        props.id.toString(),
        props.month.toNumber(),
        props.categoryId.toString(),
        props.budgeted.toCents(),
        props.carryover.toCents(),
        props.goal?.toCents() ?? null
      ]
    )
  }

  async isMonthCreated(month: BudgetMonth): Promise<boolean> {
    const row = await this.db.get<{ month: number }>(
      'SELECT month FROM created_budgets WHERE month = ?',
      [month.toNumber()]
    )
    return row !== null
  }

  async markMonthCreated(month: BudgetMonth): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO created_budgets (month) VALUES (?)',
      [month.toNumber()]
    )
  }

  private toDomain(row: BudgetRow): Budget {
    return Budget.reconstitute({
      id: EntityId.fromString(row.id),
      month: BudgetMonth.fromNumber(row.month),
      categoryId: EntityId.fromString(row.category),
      budgeted: Money.fromCents(row.amount),
      carryover: Money.fromCents(row.carryover),
      goal: row.goal !== null ? Money.fromCents(row.goal) : undefined
    })
  }
}
```

---

## DTOs

```typescript
interface CategoryBudgetDTO {
  categoryId: string
  categoryName: string
  groupId: string
  groupName: string
  budgeted: number
  spent: number
  available: number
  carryover: number
  goal?: number
  goalProgress?: number
  isOverBudget: boolean
}

interface GroupBudgetDTO {
  groupId: string
  groupName: string
  budgeted: number
  spent: number
  available: number
  categories: CategoryBudgetDTO[]
}

interface MonthBudgetSummaryDTO {
  month: string  // YYYY-MM
  income: number
  toBeBudgeted: number
  totalBudgeted: number
  totalSpent: number
  totalAvailable: number
  overspent: number
  groups: GroupBudgetDTO[]
}
```

---

## Budget Calculation Service

```typescript
class BudgetCalculationService {
  calculateMonthSummary(
    month: BudgetMonth,
    budgets: Budget[],
    categories: Category[],
    groups: CategoryGroup[],
    transactions: Transaction[],
    previousCarryover: Money = Money.zero()
  ): MonthBudgetSummaryDTO {
    // 1. Calcular gastos por categoria
    const spentByCategory = this.calculateSpentByCategory(transactions)

    // 2. Calcular ingresos del mes
    const income = this.calculateIncome(transactions, categories)

    // 3. Crear mapa de categorias y grupos
    const categoryMap = new Map(categories.map(c => [c.id.toString(), c]))
    const groupMap = new Map(groups.map(g => [g.id.toString(), g]))

    // 4. Calcular presupuesto por categoria
    const categoryBudgets: CategoryBudgetDTO[] = []
    let totalBudgeted = Money.zero()
    let totalSpent = Money.zero()
    let totalAvailable = Money.zero()
    let totalOverspent = Money.zero()

    for (const category of categories) {
      if (category.isIncome) continue  // Saltar categorias de ingreso

      const budget = budgets.find(
        b => b.categoryId.equals(category.id)
      )
      const spent = spentByCategory.get(category.id.toString()) ?? Money.zero()
      const budgeted = budget?.budgeted ?? Money.zero()
      const carryover = budget?.carryover ?? Money.zero()
      const available = budgeted.add(carryover).subtract(spent.abs())

      const group = groupMap.get(category.group.toString())

      categoryBudgets.push({
        categoryId: category.id.toString(),
        categoryName: category.name,
        groupId: category.group.toString(),
        groupName: group?.name ?? 'Unknown',
        budgeted: budgeted.toCents(),
        spent: spent.toCents(),
        available: available.toCents(),
        carryover: carryover.toCents(),
        goal: budget?.goal?.toCents(),
        goalProgress: budget?.hasGoal()
          ? budget.getGoalProgress(spent)
          : undefined,
        isOverBudget: available.isNegative()
      })

      totalBudgeted = totalBudgeted.add(budgeted)
      totalSpent = totalSpent.add(spent.abs())
      totalAvailable = totalAvailable.add(
        available.isNegative() ? Money.zero() : available
      )
      if (available.isNegative()) {
        totalOverspent = totalOverspent.add(available.abs())
      }
    }

    // 5. Agrupar por grupo
    const groupBudgets = this.groupByCategory(
      categoryBudgets,
      groups
    )

    // 6. Calcular "To Be Budgeted"
    const toBeBudgeted = income
      .add(previousCarryover)
      .subtract(totalBudgeted)

    return {
      month: month.toString(),
      income: income.toCents(),
      toBeBudgeted: toBeBudgeted.toCents(),
      totalBudgeted: totalBudgeted.toCents(),
      totalSpent: totalSpent.toCents(),
      totalAvailable: totalAvailable.toCents(),
      overspent: totalOverspent.toCents(),
      groups: groupBudgets
    }
  }

  private calculateSpentByCategory(
    transactions: Transaction[]
  ): Map<string, Money> {
    const result = new Map<string, Money>()

    for (const tx of transactions) {
      if (tx.tombstone || !tx.categoryId) continue
      if (tx.isParent) continue  // Solo contar children o transacciones simples

      const categoryId = tx.categoryId.toString()
      const current = result.get(categoryId) ?? Money.zero()
      result.set(categoryId, current.add(tx.amount))
    }

    return result
  }

  private calculateIncome(
    transactions: Transaction[],
    categories: Category[]
  ): Money {
    const incomeCategories = new Set(
      categories
        .filter(c => c.isIncome)
        .map(c => c.id.toString())
    )

    return transactions
      .filter(tx =>
        !tx.tombstone &&
        tx.categoryId &&
        incomeCategories.has(tx.categoryId.toString())
      )
      .reduce((sum, tx) => sum.add(tx.amount), Money.zero())
  }

  private groupByCategory(
    categoryBudgets: CategoryBudgetDTO[],
    groups: CategoryGroup[]
  ): GroupBudgetDTO[] {
    const groupMap = new Map<string, CategoryBudgetDTO[]>()

    for (const cat of categoryBudgets) {
      if (!groupMap.has(cat.groupId)) {
        groupMap.set(cat.groupId, [])
      }
      groupMap.get(cat.groupId)!.push(cat)
    }

    return groups
      .filter(g => !g.isIncome && !g.tombstone)
      .map(group => {
        const cats = groupMap.get(group.id.toString()) ?? []
        return {
          groupId: group.id.toString(),
          groupName: group.name,
          budgeted: cats.reduce((s, c) => s + c.budgeted, 0),
          spent: cats.reduce((s, c) => s + c.spent, 0),
          available: cats.reduce((s, c) => s + c.available, 0),
          categories: cats
        }
      })
  }
}
```

---

## Use Cases

### SetBudgetAmount

```typescript
interface SetBudgetAmountInput {
  month: string     // YYYY-MM
  categoryId: string
  amount: number    // Centavos
}

class SetBudgetAmount implements UseCase<SetBudgetAmountInput, void> {
  constructor(
    private budgetRepo: IBudgetRepository,
    private syncService: SyncService
  ) {}

  async execute(input: SetBudgetAmountInput): Promise<void> {
    const month = BudgetMonth.fromString(input.month)
    const categoryId = EntityId.fromString(input.categoryId)
    const amount = Money.fromCents(input.amount)

    // Buscar presupuesto existente o crear nuevo
    let budget = await this.budgetRepo.findByMonthAndCategory(
      month,
      categoryId
    )

    if (budget) {
      budget.setBudgeted(amount)
    } else {
      budget = Budget.create({
        month,
        categoryId,
        budgeted: amount
      })
    }

    await this.budgetRepo.save(budget)

    // Track para sync
    await this.syncService.trackChanges([{
      table: 'zero_budgets',
      row: budget.id.toString(),
      data: budget.toObject()
    }])
  }
}
```

### GetBudgetSummary

```typescript
interface GetBudgetSummaryInput {
  month: string  // YYYY-MM
}

interface GetBudgetSummaryOutput {
  summary: MonthBudgetSummaryDTO
}

class GetBudgetSummary implements UseCase<GetBudgetSummaryInput, GetBudgetSummaryOutput> {
  constructor(
    private budgetRepo: IBudgetRepository,
    private categoryRepo: CategoryRepository,
    private categoryGroupRepo: CategoryGroupRepository,
    private transactionRepo: TransactionRepository,
    private calculationService: BudgetCalculationService
  ) {}

  async execute(input: GetBudgetSummaryInput): Promise<GetBudgetSummaryOutput> {
    const month = BudgetMonth.fromString(input.month)

    // Cargar datos
    const [budgets, categories, groups, transactions] = await Promise.all([
      this.budgetRepo.findByMonth(month),
      this.categoryRepo.findAll(),
      this.categoryGroupRepo.findAll(),
      this.transactionRepo.findByMonth(month)
    ])

    // Calcular carryover del mes anterior
    const prevMonth = month.previous()
    const prevCarryover = await this.calculatePreviousCarryover(prevMonth)

    // Calcular summary
    const summary = this.calculationService.calculateMonthSummary(
      month,
      budgets,
      categories.filter(c => !c.tombstone),
      groups.filter(g => !g.tombstone),
      transactions.filter(t => !t.tombstone),
      prevCarryover
    )

    return { summary }
  }

  private async calculatePreviousCarryover(month: BudgetMonth): Promise<Money> {
    // Simplificado: en una implementacion real, calcularias el
    // "To Be Budgeted" del mes anterior
    return Money.zero()
  }
}
```

### CopyBudgetMonth

```typescript
interface CopyBudgetMonthInput {
  fromMonth: string  // YYYY-MM
  toMonth: string    // YYYY-MM
}

class CopyBudgetMonth implements UseCase<CopyBudgetMonthInput, void> {
  constructor(
    private budgetRepo: IBudgetRepository,
    private syncService: SyncService
  ) {}

  async execute(input: CopyBudgetMonthInput): Promise<void> {
    const fromMonth = BudgetMonth.fromString(input.fromMonth)
    const toMonth = BudgetMonth.fromString(input.toMonth)

    // Obtener presupuestos del mes origen
    const sourceBudgets = await this.budgetRepo.findByMonth(fromMonth)

    // Crear copias para el mes destino
    const newBudgets = sourceBudgets.map(source => {
      return Budget.create({
        month: toMonth,
        categoryId: source.categoryId,
        budgeted: source.budgeted
      })
    })

    // Guardar
    await this.budgetRepo.saveMany(newBudgets)

    // Marcar mes como creado
    await this.budgetRepo.markMonthCreated(toMonth)

    // Track para sync
    await this.syncService.trackChanges(
      newBudgets.map(b => ({
        table: 'zero_budgets',
        row: b.id.toString(),
        data: b.toObject()
      }))
    )
  }
}
```

---

## Tests

```typescript
describe('BudgetCalculationService', () => {
  let service: BudgetCalculationService

  beforeEach(() => {
    service = new BudgetCalculationService()
  })

  it('should calculate available correctly', () => {
    const month = BudgetMonth.fromString('2024-02')
    const category = Category.create({
      name: 'Groceries',
      groupId: EntityId.create()
    })
    const budget = Budget.create({
      month,
      categoryId: category.id,
      budgeted: Money.fromCents(50000)  // $500
    })

    const transactions = [
      Transaction.create({
        accountId: EntityId.create(),
        amount: Money.fromCents(-30000),  // -$300
        date: TransactionDate.fromString('2024-02-15'),
        categoryId: category.id
      })
    ]

    const summary = service.calculateMonthSummary(
      month,
      [budget],
      [category],
      [],
      transactions
    )

    const categoryBudget = summary.groups[0]?.categories[0]
    expect(categoryBudget?.available).toBe(20000)  // $200
  })

  it('should detect overspending', () => {
    // ... similar test con gasto mayor que presupuesto
  })
})
```

---

## Verificacion

### Criterios de Exito

- [ ] Budget entity calcula available correctamente
- [ ] SetBudgetAmount crea/actualiza presupuestos
- [ ] GetBudgetSummary retorna datos completos
- [ ] CopyBudgetMonth copia correctamente
- [ ] Carryover se calcula correctamente
- [ ] Income se calcula solo de categorias de ingreso

---

## Tiempo Estimado

- Budget Entity: 2-3 horas
- IBudgetRepository + SQLite: 2-3 horas
- BudgetCalculationService: 4-5 horas
- Use Cases: 3-4 horas
- Tests: 3-4 horas

**Total: 14-19 horas**
