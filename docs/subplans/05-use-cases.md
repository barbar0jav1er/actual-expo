# Subplan 5: Use Cases Core (Application Layer)

## Objetivo

Implementar la logica de aplicacion con casos de uso que orquestan las operaciones del dominio.

## Dependencias

- **Subplan 1:** Entidades y Value Objects del dominio
- **Subplan 2:** Repositorios SQLite
- **Subplan 4:** API Client (para sync)

## Archivos a Crear

```
src/
└── application/
    ├── use-cases/
    │   ├── accounts/
    │   │   ├── CreateAccount.ts
    │   │   ├── CreateAccount.test.ts
    │   │   ├── UpdateAccount.ts
    │   │   ├── CloseAccount.ts
    │   │   ├── GetAccounts.ts
    │   │   ├── GetAccountBalance.ts
    │   │   └── index.ts
    │   ├── transactions/
    │   │   ├── CreateTransaction.ts
    │   │   ├── CreateTransaction.test.ts
    │   │   ├── UpdateTransaction.ts
    │   │   ├── DeleteTransaction.ts
    │   │   ├── GetTransactions.ts
    │   │   ├── SplitTransaction.ts
    │   │   └── index.ts
    │   ├── categories/
    │   │   ├── CreateCategory.ts
    │   │   ├── CreateCategoryGroup.ts
    │   │   ├── GetCategories.ts
    │   │   └── index.ts
    │   ├── payees/
    │   │   ├── CreatePayee.ts
    │   │   ├── GetPayees.ts
    │   │   ├── MergePayees.ts
    │   │   └── index.ts
    │   ├── sync/
    │   │   ├── FullSync.ts
    │   │   ├── FullSync.test.ts
    │   │   ├── ApplyRemoteChanges.ts
    │   │   └── index.ts
    │   └── index.ts
    ├── services/
    │   ├── SyncCoordinator.ts
    │   ├── SyncCoordinator.test.ts
    │   └── index.ts
    ├── dtos/
    │   ├── AccountDTO.ts
    │   ├── TransactionDTO.ts
    │   ├── CategoryDTO.ts
    │   ├── PayeeDTO.ts
    │   └── index.ts
    └── index.ts
```

---

## DTOs (Data Transfer Objects)

```typescript
// AccountDTO.ts
interface AccountDTO {
  id: string
  name: string
  offbudget: boolean
  closed: boolean
  balance: number  // En centavos
}

// TransactionDTO.ts
interface TransactionDTO {
  id: string
  accountId: string
  accountName: string
  categoryId?: string
  categoryName?: string
  payeeId?: string
  payeeName?: string
  amount: number
  date: string  // YYYY-MM-DD
  notes?: string
  cleared: boolean
  reconciled: boolean
  isParent: boolean
  isChild: boolean
  parentId?: string
  subtransactions?: TransactionDTO[]
}

// CategoryDTO.ts
interface CategoryDTO {
  id: string
  name: string
  groupId: string
  groupName: string
  isIncome: boolean
  hidden: boolean
}

interface CategoryGroupDTO {
  id: string
  name: string
  isIncome: boolean
  hidden: boolean
  categories: CategoryDTO[]
}

// PayeeDTO.ts
interface PayeeDTO {
  id: string
  name: string
  isTransfer: boolean
  transferAccountId?: string
}
```

---

## Use Case Base Pattern

```typescript
interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>
}

// Result type para manejo de errores
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E }

function success<T>(value: T): Result<T> {
  return { success: true, value }
}

function failure<E>(error: E): Result<never, E> {
  return { success: false, error }
}
```

---

## Account Use Cases

### CreateAccount

```typescript
interface CreateAccountInput {
  name: string
  offbudget?: boolean
}

interface CreateAccountOutput {
  account: AccountDTO
}

class CreateAccount implements UseCase<CreateAccountInput, CreateAccountOutput> {
  constructor(
    private accountRepo: AccountRepository,
    private payeeRepo: PayeeRepository,
    private syncService: SyncService
  ) {}

  async execute(input: CreateAccountInput): Promise<CreateAccountOutput> {
    // 1. Validar input
    if (!input.name.trim()) {
      throw new ValidationError('name', 'Name is required')
    }

    // 2. Crear entidad Account
    const account = Account.create({
      name: input.name.trim(),
      offbudget: input.offbudget ?? false
    })

    // 3. Crear transfer payee para esta cuenta
    const transferPayee = Payee.createTransferPayee({
      name: `Transfer: ${account.name}`,
      accountId: account.id
    })

    // 4. Guardar en repositorios
    await this.accountRepo.save(account)
    await this.payeeRepo.save(transferPayee)

    // 5. Registrar cambios para sync
    await this.syncService.trackChanges([
      { table: 'accounts', row: account.id.toString(), data: account.toObject() },
      { table: 'payees', row: transferPayee.id.toString(), data: transferPayee.toObject() }
    ])

    // 6. Retornar DTO
    return {
      account: this.toDTO(account, Money.zero())
    }
  }

  private toDTO(account: Account, balance: Money): AccountDTO {
    return {
      id: account.id.toString(),
      name: account.name,
      offbudget: account.offbudget,
      closed: account.closed,
      balance: balance.toCents()
    }
  }
}
```

### GetAccounts

```typescript
interface GetAccountsOutput {
  accounts: AccountDTO[]
}

class GetAccounts implements UseCase<void, GetAccountsOutput> {
  constructor(
    private accountRepo: AccountRepository,
    private transactionRepo: TransactionRepository
  ) {}

  async execute(): Promise<GetAccountsOutput> {
    const accounts = await this.accountRepo.findActive()

    const accountsWithBalance = await Promise.all(
      accounts.map(async account => {
        const balance = await this.calculateBalance(account.id)
        return this.toDTO(account, balance)
      })
    )

    return { accounts: accountsWithBalance }
  }

  private async calculateBalance(accountId: EntityId): Promise<Money> {
    const transactions = await this.transactionRepo.findByAccount(accountId)

    return transactions
      .filter(tx => !tx.tombstone)
      .reduce(
        (sum, tx) => sum.add(tx.amount),
        Money.zero()
      )
  }

  private toDTO(account: Account, balance: Money): AccountDTO {
    // ...
  }
}
```

---

## Transaction Use Cases

### CreateTransaction

```typescript
interface CreateTransactionInput {
  accountId: string
  amount: number  // En centavos
  date: string    // YYYY-MM-DD
  categoryId?: string
  payeeId?: string
  notes?: string
}

interface CreateTransactionOutput {
  transaction: TransactionDTO
}

class CreateTransaction implements UseCase<CreateTransactionInput, CreateTransactionOutput> {
  constructor(
    private transactionRepo: TransactionRepository,
    private accountRepo: AccountRepository,
    private categoryRepo: CategoryRepository,
    private payeeRepo: PayeeRepository,
    private syncService: SyncService
  ) {}

  async execute(input: CreateTransactionInput): Promise<CreateTransactionOutput> {
    // 1. Validar que la cuenta existe
    const account = await this.accountRepo.findById(
      EntityId.fromString(input.accountId)
    )
    if (!account) {
      throw new NotFoundError('Account not found')
    }

    // 2. Validar categoria si se proporciona
    let category: Category | null = null
    if (input.categoryId) {
      category = await this.categoryRepo.findById(
        EntityId.fromString(input.categoryId)
      )
      if (!category) {
        throw new NotFoundError('Category not found')
      }
    }

    // 3. Validar payee si se proporciona
    let payee: Payee | null = null
    if (input.payeeId) {
      payee = await this.payeeRepo.findById(
        EntityId.fromString(input.payeeId)
      )
      if (!payee) {
        throw new NotFoundError('Payee not found')
      }
    }

    // 4. Crear transaccion
    const transaction = Transaction.create({
      accountId: account.id,
      amount: Money.fromCents(input.amount),
      date: TransactionDate.fromString(input.date),
      categoryId: category?.id,
      payeeId: payee?.id,
      notes: input.notes
    })

    // 5. Guardar
    await this.transactionRepo.save(transaction)

    // 6. Track para sync
    await this.syncService.trackChanges([
      { table: 'transactions', row: transaction.id.toString(), data: transaction.toObject() }
    ])

    // 7. Retornar DTO
    return {
      transaction: this.toDTO(transaction, account, category, payee)
    }
  }

  private toDTO(
    tx: Transaction,
    account: Account,
    category: Category | null,
    payee: Payee | null
  ): TransactionDTO {
    return {
      id: tx.id.toString(),
      accountId: account.id.toString(),
      accountName: account.name,
      categoryId: category?.id.toString(),
      categoryName: category?.name,
      payeeId: payee?.id.toString(),
      payeeName: payee?.name,
      amount: tx.amount.toCents(),
      date: tx.date.toString(),
      notes: tx.notes,
      cleared: tx.cleared,
      reconciled: tx.reconciled,
      isParent: tx.isParent,
      isChild: tx.isChild,
      parentId: tx.parentId?.toString()
    }
  }
}
```

### GetTransactions

```typescript
interface GetTransactionsInput {
  accountId?: string
  startDate?: string
  endDate?: string
  month?: string  // YYYY-MM
}

interface GetTransactionsOutput {
  transactions: TransactionDTO[]
}

class GetTransactions implements UseCase<GetTransactionsInput, GetTransactionsOutput> {
  constructor(
    private transactionRepo: TransactionRepository,
    private accountRepo: AccountRepository,
    private categoryRepo: CategoryRepository,
    private payeeRepo: PayeeRepository
  ) {}

  async execute(input: GetTransactionsInput): Promise<GetTransactionsOutput> {
    let transactions: Transaction[]

    if (input.accountId) {
      transactions = await this.transactionRepo.findByAccount(
        EntityId.fromString(input.accountId)
      )
    } else if (input.month) {
      transactions = await this.transactionRepo.findByMonth(
        BudgetMonth.fromString(input.month)
      )
    } else if (input.startDate && input.endDate) {
      transactions = await this.transactionRepo.findByDateRange(
        TransactionDate.fromString(input.startDate),
        TransactionDate.fromString(input.endDate)
      )
    } else {
      throw new ValidationError('filter', 'Must specify accountId, month, or date range')
    }

    // Cargar datos relacionados
    const [accounts, categories, payees] = await Promise.all([
      this.accountRepo.findAll(),
      this.categoryRepo.findAll(),
      this.payeeRepo.findAll()
    ])

    const accountMap = new Map(accounts.map(a => [a.id.toString(), a]))
    const categoryMap = new Map(categories.map(c => [c.id.toString(), c]))
    const payeeMap = new Map(payees.map(p => [p.id.toString(), p]))

    const dtos = transactions
      .filter(tx => !tx.isChild)  // Los children van dentro del parent
      .map(tx => this.toDTO(tx, accountMap, categoryMap, payeeMap))

    return { transactions: dtos }
  }

  private toDTO(
    tx: Transaction,
    accounts: Map<string, Account>,
    categories: Map<string, Category>,
    payees: Map<string, Payee>
  ): TransactionDTO {
    const account = accounts.get(tx.accountId.toString())
    const category = tx.categoryId ? categories.get(tx.categoryId.toString()) : null
    const payee = tx.payeeId ? payees.get(tx.payeeId.toString()) : null

    return {
      id: tx.id.toString(),
      accountId: tx.accountId.toString(),
      accountName: account?.name ?? 'Unknown',
      categoryId: category?.id.toString(),
      categoryName: category?.name,
      payeeId: payee?.id.toString(),
      payeeName: payee?.name,
      amount: tx.amount.toCents(),
      date: tx.date.toString(),
      notes: tx.notes,
      cleared: tx.cleared,
      reconciled: tx.reconciled,
      isParent: tx.isParent,
      isChild: tx.isChild,
      parentId: tx.parentId?.toString()
    }
  }
}
```

---

## Sync Use Cases

### FullSync

```typescript
interface FullSyncOutput {
  messagesReceived: number
  messagesSent: number
  success: boolean
}

class FullSync implements UseCase<void, FullSyncOutput> {
  constructor(
    private syncRepo: ISyncRepository,
    private syncEndpoints: SyncEndpoints,
    private syncEncoder: SyncEncoder,
    private syncDecoder: SyncDecoder,
    private applyRemoteChanges: ApplyRemoteChanges,
    private fileId: string,
    private groupId: string
  ) {}

  async execute(): Promise<FullSyncOutput> {
    // 1. Obtener clock local
    let clock = await this.syncRepo.getClock()
    if (!clock) {
      clock = Clock.initialize()
      await this.syncRepo.saveClock(clock.getState())
    }

    // 2. Obtener mensajes locales desde el ultimo sync
    const lastSync = clock.getTimestamp().toString()
    const localMessages = await this.syncRepo.getMessages(lastSync)

    // 3. Encodear request
    const requestBuffer = this.syncEncoder.encode({
      messages: localMessages,
      fileId: this.fileId,
      groupId: this.groupId,
      since: lastSync
    })

    // 4. Enviar al servidor
    const responseBuffer = await this.syncEndpoints.sync(requestBuffer)

    // 5. Decodear response
    const { messages: remoteMessages, merkle: remoteMerkle } =
      this.syncDecoder.decode(responseBuffer)

    // 6. Aplicar cambios remotos
    if (remoteMessages.length > 0) {
      await this.applyRemoteChanges.execute({ messages: remoteMessages })
    }

    // 7. Actualizar merkle local
    const localClock = Clock.fromState(await this.syncRepo.getClock()!)

    for (const msg of remoteMessages) {
      const ts = Timestamp.parse(msg.timestamp)!
      localClock.recv(ts)
      localClock.updateMerkle(ts)
    }

    // 8. Verificar si hay diferencias
    const diff = MerkleTree.diff(localClock.getMerkle(), remoteMerkle)
    if (diff !== null) {
      // Hay divergencia, necesitamos resync
      console.warn('Merkle diff detected at', diff)
    }

    // 9. Guardar estado
    localClock.pruneMerkle()
    await this.syncRepo.saveClock(localClock.getState())

    return {
      messagesReceived: remoteMessages.length,
      messagesSent: localMessages.length,
      success: diff === null
    }
  }
}
```

### ApplyRemoteChanges

```typescript
interface ApplyRemoteChangesInput {
  messages: SyncMessage[]
}

class ApplyRemoteChanges implements UseCase<ApplyRemoteChangesInput, void> {
  constructor(
    private syncRepo: ISyncRepository,
    private accountRepo: AccountRepository,
    private transactionRepo: TransactionRepository,
    private categoryRepo: CategoryRepository,
    private payeeRepo: PayeeRepository
  ) {}

  async execute(input: ApplyRemoteChangesInput): Promise<void> {
    // Agrupar mensajes por entidad
    const byEntity = this.groupByEntity(input.messages)

    // Aplicar en orden
    for (const [table, row, messages] of byEntity) {
      await this.applyToEntity(table, row, messages)
    }
  }

  private groupByEntity(messages: SyncMessage[]): Map<string, Map<string, SyncMessage[]>> {
    const result = new Map<string, Map<string, SyncMessage[]>>()

    for (const msg of messages) {
      if (!result.has(msg.dataset)) {
        result.set(msg.dataset, new Map())
      }
      const tableMap = result.get(msg.dataset)!

      if (!tableMap.has(msg.row)) {
        tableMap.set(msg.row, [])
      }
      tableMap.get(msg.row)!.push(msg)
    }

    return result
  }

  private async applyToEntity(
    table: string,
    rowId: string,
    messages: SyncMessage[]
  ): Promise<void> {
    // Ordenar por timestamp (LWW - Last Write Wins)
    messages.sort((a, b) =>
      Timestamp.parse(a.timestamp)!.compareTo(Timestamp.parse(b.timestamp)!)
    )

    switch (table) {
      case 'accounts':
        await this.applyToAccount(rowId, messages)
        break
      case 'transactions':
        await this.applyToTransaction(rowId, messages)
        break
      case 'categories':
        await this.applyToCategory(rowId, messages)
        break
      case 'payees':
        await this.applyToPayee(rowId, messages)
        break
      // ... otros casos
    }
  }

  private async applyToAccount(rowId: string, messages: SyncMessage[]): Promise<void> {
    const id = EntityId.fromString(rowId)
    let account = await this.accountRepo.findById(id)

    if (!account) {
      // Crear nueva cuenta con valores por defecto
      account = Account.reconstitute({
        id,
        name: '',
        offbudget: false,
        closed: false,
        sortOrder: 0,
        tombstone: false
      })
    }

    // Aplicar cada cambio
    for (const msg of messages) {
      const value = ValueSerializer.deserialize(msg.value)

      switch (msg.column) {
        case 'name':
          if (typeof value === 'string') account.rename(value)
          break
        case 'offbudget':
          account.setOffbudget(value === 1)
          break
        case 'closed':
          if (value === 1) account.close()
          else account.reopen()
          break
        case 'tombstone':
          if (value === 1) account.delete()
          break
      }
    }

    await this.accountRepo.save(account)
  }

  // ... metodos similares para otras entidades
}
```

---

## Sync Coordinator Service

```typescript
class SyncCoordinator {
  private syncTimer: NodeJS.Timeout | null = null
  private isSyncing = false
  private pendingSync = false

  constructor(private fullSync: FullSync) {}

  scheduleSync(delayMs: number = 1000): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
    }

    this.syncTimer = setTimeout(() => {
      this.performSync()
    }, delayMs)
  }

  async performSync(): Promise<void> {
    if (this.isSyncing) {
      this.pendingSync = true
      return
    }

    this.isSyncing = true

    try {
      const result = await this.fullSync.execute()
      console.log('Sync completed:', result)

      if (!result.success) {
        // Reintentar si hubo divergencia
        this.scheduleSync(5000)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      // Reintentar despues de un tiempo
      this.scheduleSync(30000)
    } finally {
      this.isSyncing = false

      if (this.pendingSync) {
        this.pendingSync = false
        this.scheduleSync(1000)
      }
    }
  }

  stopSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
      this.syncTimer = null
    }
  }
}
```

---

## Tests

```typescript
describe('CreateTransaction', () => {
  let useCase: CreateTransaction
  let mockTransactionRepo: MockTransactionRepository
  let mockAccountRepo: MockAccountRepository
  let mockSyncService: MockSyncService

  beforeEach(() => {
    mockTransactionRepo = new MockTransactionRepository()
    mockAccountRepo = new MockAccountRepository()
    mockSyncService = new MockSyncService()

    // Setup: crear cuenta de prueba
    const account = Account.create({ name: 'Checking' })
    mockAccountRepo.save(account)

    useCase = new CreateTransaction(
      mockTransactionRepo,
      mockAccountRepo,
      new MockCategoryRepository(),
      new MockPayeeRepository(),
      mockSyncService
    )
  })

  it('should create a transaction', async () => {
    const result = await useCase.execute({
      accountId: mockAccountRepo.accounts[0].id.toString(),
      amount: -5000,
      date: '2024-02-26'
    })

    expect(result.transaction).toBeDefined()
    expect(result.transaction.amount).toBe(-5000)
    expect(mockTransactionRepo.transactions).toHaveLength(1)
    expect(mockSyncService.trackedChanges).toHaveLength(1)
  })

  it('should throw if account not found', async () => {
    await expect(useCase.execute({
      accountId: 'non-existent',
      amount: -5000,
      date: '2024-02-26'
    })).rejects.toThrow(NotFoundError)
  })
})
```

---

## Verificacion

### Criterios de Exito

- [ ] CreateAccount crea cuenta y transfer payee
- [ ] CreateTransaction valida relaciones
- [ ] GetTransactions filtra correctamente
- [ ] FullSync envia y recibe mensajes
- [ ] ApplyRemoteChanges aplica LWW correctamente
- [ ] SyncCoordinator programa syncs correctamente

---

## Tiempo Estimado

- Account Use Cases: 3-4 horas
- Transaction Use Cases: 4-5 horas
- Category/Payee Use Cases: 2-3 horas
- Sync Use Cases: 5-6 horas
- SyncCoordinator: 2-3 horas
- Tests: 4-5 horas

**Total: 20-26 horas**
