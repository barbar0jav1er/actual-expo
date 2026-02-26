# Subplan 9: Reglas y Schedules (Domain + Application)

## Objetivo

Implementar el sistema de automatizacion con reglas y transacciones programadas.

## Dependencias

- **Subplan 1:** Entidades base
- **Subplan 5:** Use Cases Core

## Archivos a Crear

```
src/
├── domain/
│   ├── entities/
│   │   ├── Rule.ts
│   │   ├── Rule.test.ts
│   │   ├── Schedule.ts
│   │   ├── Schedule.test.ts
│   │   └── index.ts (update)
│   ├── value-objects/
│   │   ├── RuleCondition.ts
│   │   ├── RuleAction.ts
│   │   └── RecurrencePattern.ts
│   └── ports/
│       └── repositories/
│           ├── IRuleRepository.ts
│           └── IScheduleRepository.ts
├── infrastructure/
│   └── persistence/
│       └── sqlite/
│           ├── repositories/
│           │   ├── SQLiteRuleRepository.ts
│           │   └── SQLiteScheduleRepository.ts
│           └── migrations/
│               └── 004_rules_schedules.ts
└── application/
    ├── use-cases/
    │   ├── rules/
    │   │   ├── CreateRule.ts
    │   │   ├── ApplyRules.ts
    │   │   ├── GetRules.ts
    │   │   └── index.ts
    │   └── schedules/
    │       ├── CreateSchedule.ts
    │       ├── GetUpcomingSchedules.ts
    │       ├── PostScheduledTransaction.ts
    │       └── index.ts
    └── services/
        ├── RuleEngineService.ts
        └── RuleEngineService.test.ts
```

---

## Migration

```sql
-- 004_rules_schedules.ts

-- Rules
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  stage TEXT,                    -- 'pre' | 'post' | null
  conditions TEXT NOT NULL,      -- JSON array
  actions TEXT NOT NULL,         -- JSON array
  conditions_op TEXT DEFAULT 'and',  -- 'and' | 'or'
  tombstone INTEGER DEFAULT 0
);

-- Schedules
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  name TEXT,
  rule TEXT NOT NULL,            -- FK rules
  active INTEGER DEFAULT 1,
  completed INTEGER DEFAULT 0,
  posts_transaction INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0,
  FOREIGN KEY (rule) REFERENCES rules(id)
);

-- Schedule next date cache
CREATE TABLE schedules_next_date (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  local_next_date INTEGER,       -- YYYYMMDD
  base_next_date INTEGER,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE INDEX idx_schedules_active ON schedules(active) WHERE tombstone = 0;
```

---

## Value Objects

### RuleCondition

```typescript
type ConditionField =
  | 'account'
  | 'payee'
  | 'category'
  | 'amount'
  | 'date'
  | 'notes'

type ConditionOperator =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'doesNotContain'
  | 'oneOf'
  | 'notOneOf'
  | 'isApprox'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isBetween'

interface RuleConditionProps {
  field: ConditionField
  op: ConditionOperator
  value: unknown
  options?: {
    inflow?: boolean
    outflow?: boolean
  }
}

class RuleCondition {
  private constructor(private props: RuleConditionProps) {}

  static create(props: RuleConditionProps): RuleCondition {
    return new RuleCondition(props)
  }

  get field(): ConditionField { return this.props.field }
  get op(): ConditionOperator { return this.props.op }
  get value(): unknown { return this.props.value }

  matches(transaction: Transaction, context: MatchContext): boolean {
    const txValue = this.getFieldValue(transaction, context)
    return this.evaluate(txValue)
  }

  private getFieldValue(tx: Transaction, ctx: MatchContext): unknown {
    switch (this.field) {
      case 'account':
        return tx.accountId.toString()
      case 'payee':
        return tx.payeeId?.toString()
      case 'category':
        return tx.categoryId?.toString()
      case 'amount':
        return tx.amount.toCents()
      case 'date':
        return tx.date.toNumber()
      case 'notes':
        return tx.notes
      default:
        return undefined
    }
  }

  private evaluate(actual: unknown): boolean {
    switch (this.op) {
      case 'is':
        return actual === this.value
      case 'isNot':
        return actual !== this.value
      case 'contains':
        return String(actual).toLowerCase().includes(
          String(this.value).toLowerCase()
        )
      case 'gt':
        return Number(actual) > Number(this.value)
      case 'gte':
        return Number(actual) >= Number(this.value)
      case 'lt':
        return Number(actual) < Number(this.value)
      case 'lte':
        return Number(actual) <= Number(this.value)
      case 'oneOf':
        return Array.isArray(this.value) && this.value.includes(actual)
      case 'isBetween':
        const [min, max] = this.value as [number, number]
        const num = Number(actual)
        return num >= min && num <= max
      default:
        return false
    }
  }

  toObject(): RuleConditionProps {
    return { ...this.props }
  }
}
```

### RuleAction

```typescript
type ActionType =
  | 'set'
  | 'link-schedule'
  | 'prepend-notes'
  | 'append-notes'

interface RuleActionProps {
  type: ActionType
  field?: string
  value?: unknown
}

class RuleAction {
  private constructor(private props: RuleActionProps) {}

  static create(props: RuleActionProps): RuleAction {
    return new RuleAction(props)
  }

  get type(): ActionType { return this.props.type }
  get field(): string | undefined { return this.props.field }
  get value(): unknown { return this.props.value }

  apply(transaction: Transaction): void {
    switch (this.type) {
      case 'set':
        this.applySet(transaction)
        break
      case 'prepend-notes':
        const currentNotes = transaction.notes ?? ''
        transaction.setNotes(`${this.value} ${currentNotes}`.trim())
        break
      case 'append-notes':
        const notes = transaction.notes ?? ''
        transaction.setNotes(`${notes} ${this.value}`.trim())
        break
    }
  }

  private applySet(tx: Transaction): void {
    switch (this.field) {
      case 'category':
        tx.setCategory(
          this.value ? EntityId.fromString(String(this.value)) : undefined
        )
        break
      case 'payee':
        tx.setPayee(
          this.value ? EntityId.fromString(String(this.value)) : undefined
        )
        break
      case 'notes':
        tx.setNotes(this.value ? String(this.value) : undefined)
        break
    }
  }

  toObject(): RuleActionProps {
    return { ...this.props }
  }
}
```

### RecurrencePattern

```typescript
type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface RecurrencePatternProps {
  frequency: Frequency
  interval: number
  start: TransactionDate
  endDate?: TransactionDate
  endOccurrences?: number
  patterns?: Array<{
    type: 'day' | 'dayOfWeek'
    value: number
  }>
  skipWeekend?: boolean
  weekendSolve?: 'before' | 'after'
}

class RecurrencePattern {
  private constructor(private props: RecurrencePatternProps) {}

  static create(props: RecurrencePatternProps): RecurrencePattern {
    return new RecurrencePattern(props)
  }

  getNextOccurrence(after: TransactionDate): TransactionDate | null {
    // Calcular siguiente fecha basado en patron
    let candidate = this.props.start

    while (candidate.compareTo(after) <= 0) {
      candidate = this.advance(candidate)
      if (this.isEnded(candidate)) {
        return null
      }
    }

    return this.adjustForWeekend(candidate)
  }

  private advance(date: TransactionDate): TransactionDate {
    const d = date.toDate()

    switch (this.props.frequency) {
      case 'daily':
        d.setDate(d.getDate() + this.props.interval)
        break
      case 'weekly':
        d.setDate(d.getDate() + (7 * this.props.interval))
        break
      case 'monthly':
        d.setMonth(d.getMonth() + this.props.interval)
        break
      case 'yearly':
        d.setFullYear(d.getFullYear() + this.props.interval)
        break
    }

    return TransactionDate.fromDate(d)
  }

  private isEnded(date: TransactionDate): boolean {
    if (this.props.endDate) {
      return date.compareTo(this.props.endDate) > 0
    }
    return false
  }

  private adjustForWeekend(date: TransactionDate): TransactionDate {
    if (!this.props.skipWeekend) return date

    const d = date.toDate()
    const day = d.getDay()

    if (day === 0) {  // Sunday
      d.setDate(d.getDate() + (this.props.weekendSolve === 'after' ? 1 : -2))
    } else if (day === 6) {  // Saturday
      d.setDate(d.getDate() + (this.props.weekendSolve === 'after' ? 2 : -1))
    }

    return TransactionDate.fromDate(d)
  }

  toObject(): RecurrencePatternProps {
    return { ...this.props }
  }
}
```

---

## Entities

### Rule

```typescript
interface RuleProps {
  id: EntityId
  stage: 'pre' | 'post' | null
  conditions: RuleCondition[]
  conditionsOp: 'and' | 'or'
  actions: RuleAction[]
  tombstone: boolean
}

class Rule {
  private constructor(private props: RuleProps) {}

  static create(props: {
    conditions: RuleCondition[]
    actions: RuleAction[]
    stage?: 'pre' | 'post'
    conditionsOp?: 'and' | 'or'
  }): Rule {
    return new Rule({
      id: EntityId.create(),
      stage: props.stage ?? null,
      conditions: props.conditions,
      conditionsOp: props.conditionsOp ?? 'and',
      actions: props.actions,
      tombstone: false
    })
  }

  static reconstitute(props: RuleProps): Rule {
    return new Rule(props)
  }

  get id(): EntityId { return this.props.id }
  get stage(): 'pre' | 'post' | null { return this.props.stage }
  get conditions(): RuleCondition[] { return this.props.conditions }
  get conditionsOp(): 'and' | 'or' { return this.props.conditionsOp }
  get actions(): RuleAction[] { return this.props.actions }

  matches(transaction: Transaction, context: MatchContext): boolean {
    if (this.conditionsOp === 'and') {
      return this.conditions.every(c => c.matches(transaction, context))
    } else {
      return this.conditions.some(c => c.matches(transaction, context))
    }
  }

  apply(transaction: Transaction): void {
    for (const action of this.actions) {
      action.apply(transaction)
    }
  }

  toObject(): RuleProps {
    return {
      ...this.props,
      conditions: this.conditions.map(c => c.toObject()),
      actions: this.actions.map(a => a.toObject())
    }
  }
}
```

### Schedule

```typescript
interface ScheduleProps {
  id: EntityId
  name?: string
  rule: Rule
  active: boolean
  completed: boolean
  postsTransaction: boolean
  nextDate?: TransactionDate
  tombstone: boolean
}

class Schedule {
  private constructor(private props: ScheduleProps) {}

  static create(props: {
    name?: string
    rule: Rule
    postsTransaction?: boolean
  }): Schedule {
    return new Schedule({
      id: EntityId.create(),
      name: props.name,
      rule: props.rule,
      active: true,
      completed: false,
      postsTransaction: props.postsTransaction ?? false,
      nextDate: undefined,
      tombstone: false
    })
  }

  static reconstitute(props: ScheduleProps): Schedule {
    return new Schedule(props)
  }

  get id(): EntityId { return this.props.id }
  get name(): string | undefined { return this.props.name }
  get rule(): Rule { return this.props.rule }
  get active(): boolean { return this.props.active }
  get completed(): boolean { return this.props.completed }
  get postsTransaction(): boolean { return this.props.postsTransaction }
  get nextDate(): TransactionDate | undefined { return this.props.nextDate }

  activate(): void { this.props.active = true }
  deactivate(): void { this.props.active = false }
  complete(): void { this.props.completed = true }

  setNextDate(date: TransactionDate): void {
    this.props.nextDate = date
  }

  toObject(): ScheduleProps {
    return { ...this.props }
  }
}
```

---

## RuleEngineService

```typescript
interface MatchContext {
  accounts: Map<string, Account>
  payees: Map<string, Payee>
  categories: Map<string, Category>
}

class RuleEngineService {
  constructor(private ruleRepo: IRuleRepository) {}

  async applyRules(
    transactions: Transaction[],
    stage: 'pre' | 'post',
    context: MatchContext
  ): Promise<void> {
    const rules = await this.ruleRepo.findByStage(stage)

    for (const transaction of transactions) {
      for (const rule of rules) {
        if (rule.matches(transaction, context)) {
          rule.apply(transaction)
        }
      }
    }
  }

  async findMatchingRule(
    transaction: Transaction,
    context: MatchContext
  ): Promise<Rule | null> {
    const rules = await this.ruleRepo.findAll()

    for (const rule of rules) {
      if (rule.matches(transaction, context)) {
        return rule
      }
    }

    return null
  }
}
```

---

## Use Cases

### CreateRule

```typescript
interface CreateRuleInput {
  conditions: Array<{
    field: string
    op: string
    value: unknown
  }>
  actions: Array<{
    type: string
    field?: string
    value?: unknown
  }>
  conditionsOp?: 'and' | 'or'
  stage?: 'pre' | 'post'
}

class CreateRule implements UseCase<CreateRuleInput, { ruleId: string }> {
  constructor(
    private ruleRepo: IRuleRepository,
    private syncService: ISyncService
  ) {}

  async execute(input: CreateRuleInput): Promise<{ ruleId: string }> {
    const conditions = input.conditions.map(c =>
      RuleCondition.create({
        field: c.field as ConditionField,
        op: c.op as ConditionOperator,
        value: c.value
      })
    )

    const actions = input.actions.map(a =>
      RuleAction.create({
        type: a.type as ActionType,
        field: a.field,
        value: a.value
      })
    )

    const rule = Rule.create({
      conditions,
      actions,
      conditionsOp: input.conditionsOp,
      stage: input.stage
    })

    await this.ruleRepo.save(rule)

    await this.syncService.trackChanges([{
      table: 'rules',
      row: rule.id.toString(),
      data: rule.toObject()
    }])

    return { ruleId: rule.id.toString() }
  }
}
```

### GetUpcomingSchedules

```typescript
interface GetUpcomingSchedulesOutput {
  schedules: Array<{
    id: string
    name: string
    nextDate: string
    amount: number
    payeeName?: string
    accountName?: string
  }>
}

class GetUpcomingSchedules implements UseCase<void, GetUpcomingSchedulesOutput> {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private accountRepo: IAccountRepository,
    private payeeRepo: IPayeeRepository
  ) {}

  async execute(): Promise<GetUpcomingSchedulesOutput> {
    const today = TransactionDate.today()
    const endDate = today.addDays(30)  // Proximos 30 dias

    const schedules = await this.scheduleRepo.findUpcoming(today, endDate)

    // Cargar datos relacionados
    const [accounts, payees] = await Promise.all([
      this.accountRepo.findAll(),
      this.payeeRepo.findAll()
    ])

    const accountMap = new Map(accounts.map(a => [a.id.toString(), a]))
    const payeeMap = new Map(payees.map(p => [p.id.toString(), p]))

    return {
      schedules: schedules.map(s => {
        // Extraer datos del rule
        const amountCondition = s.rule.conditions.find(
          c => c.field === 'amount'
        )
        const payeeAction = s.rule.actions.find(
          a => a.field === 'payee'
        )
        const accountAction = s.rule.actions.find(
          a => a.field === 'account'
        )

        return {
          id: s.id.toString(),
          name: s.name ?? 'Unnamed Schedule',
          nextDate: s.nextDate?.toString() ?? '',
          amount: Number(amountCondition?.value ?? 0),
          payeeName: payeeAction?.value
            ? payeeMap.get(String(payeeAction.value))?.name
            : undefined,
          accountName: accountAction?.value
            ? accountMap.get(String(accountAction.value))?.name
            : undefined
        }
      })
    }
  }
}
```

---

## Tests

```typescript
describe('RuleEngineService', () => {
  let service: RuleEngineService
  let mockRuleRepo: MockRuleRepository

  beforeEach(() => {
    mockRuleRepo = new MockRuleRepository()
    service = new RuleEngineService(mockRuleRepo)
  })

  it('should apply matching rule to transaction', async () => {
    // Crear regla: si payee contiene "Netflix" -> categoria = "Entertainment"
    const rule = Rule.create({
      conditions: [
        RuleCondition.create({
          field: 'notes',
          op: 'contains',
          value: 'Netflix'
        })
      ],
      actions: [
        RuleAction.create({
          type: 'set',
          field: 'category',
          value: 'entertainment-id'
        })
      ]
    })
    mockRuleRepo.save(rule)

    const transaction = Transaction.create({
      accountId: EntityId.create(),
      amount: Money.fromCents(-1500),
      date: TransactionDate.today(),
      notes: 'Netflix subscription'
    })

    await service.applyRules([transaction], 'post', {
      accounts: new Map(),
      payees: new Map(),
      categories: new Map()
    })

    expect(transaction.categoryId?.toString()).toBe('entertainment-id')
  })

  it('should not apply non-matching rules', async () => {
    const rule = Rule.create({
      conditions: [
        RuleCondition.create({
          field: 'amount',
          op: 'gt',
          value: 10000
        })
      ],
      actions: [
        RuleAction.create({
          type: 'set',
          field: 'category',
          value: 'large-expense-id'
        })
      ]
    })
    mockRuleRepo.save(rule)

    const transaction = Transaction.create({
      accountId: EntityId.create(),
      amount: Money.fromCents(-5000),  // Menor que 10000
      date: TransactionDate.today()
    })

    await service.applyRules([transaction], 'post', {
      accounts: new Map(),
      payees: new Map(),
      categories: new Map()
    })

    expect(transaction.categoryId).toBeUndefined()
  })
})
```

---

## Verificacion

### Criterios de Exito

- [ ] Rules se crean y persisten correctamente
- [ ] RuleCondition evalua todos los operadores
- [ ] RuleAction aplica cambios correctamente
- [ ] RuleEngineService aplica reglas matching
- [ ] Schedules calculan nextDate correctamente
- [ ] RecurrencePattern maneja todos los patrones

---

## Tiempo Estimado

- Value Objects (Condition, Action, Recurrence): 4-5 horas
- Rule Entity: 2-3 horas
- Schedule Entity: 2-3 horas
- RuleEngineService: 3-4 horas
- Use Cases: 3-4 horas
- SQLite Repositories: 2-3 horas
- Tests: 3-4 horas

**Total: 19-26 horas**
