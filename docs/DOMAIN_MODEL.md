# Modelo de Dominio - Actual Expo

Este documento explica el razonamiento detras de cada Value Object y Entidad del dominio, por que existen y que problema resuelven.

---

## Value Objects

Los Value Objects son objetos inmutables que no tienen identidad propia. Dos Value Objects son iguales si sus valores son iguales. Son perfectos para representar conceptos que se definen por sus atributos, no por quienes son.

### Money

**Problema que resuelve:**
Los numeros de punto flotante (`float`, `double`) no pueden representar dinero con precision. Por ejemplo, `0.1 + 0.2 = 0.30000000000000004` en JavaScript. Esto causa errores de centavos que se acumulan en aplicaciones financieras.

**Solucion:**
`Money` almacena todos los montos como **enteros en centavos**. $10.50 se guarda como `1050`. Las operaciones aritmeticas siempre producen resultados exactos.

```typescript
// MAL - Usar numeros directamente
const total = 10.50 + 20.30; // 30.799999999999997

// BIEN - Usar Money
const total = Money.fromDollars(10.50).add(Money.fromDollars(20.30));
// Internamente: 1050 + 2030 = 3080 centavos = $30.80 exacto
```

**Por que es inmutable:**
Evita bugs donde modificas accidentalmente un monto compartido. Si tienes `saldoInicial` y calculas `saldoFinal = saldoInicial.subtract(gasto)`, el `saldoInicial` nunca cambia.

**Metodos importantes:**
- `fromCents()` / `fromDollars()` - Creacion controlada
- `add()`, `subtract()`, `multiply()`, `divide()` - Operaciones que retornan nuevo Money
- `format()` - Formateo para UI respetando locale
- `isPositive()`, `isNegative()`, `isZero()` - Predicados para logica de negocio

---

### EntityId

**Problema que resuelve:**
Las entidades necesitan identificadores unicos que funcionen offline y en multiples dispositivos sin colisiones. Los IDs auto-incrementales de base de datos no funcionan en sistemas distribuidos.

**Solucion:**
`EntityId` envuelve UUIDs v4 (128 bits aleatorios). La probabilidad de colision es astronomicamente baja (~1 en 2^122).

```typescript
// Cada dispositivo puede crear IDs sin coordinacion
const cuenta1 = Account.create({ name: "Checking" }); // ID: 550e8400-e29b-...
const cuenta2 = Account.create({ name: "Savings" });  // ID: 6ba7b810-9dad-...
```

**Por que es un Value Object y no un string:**
- **Validacion centralizada**: Solo se crean IDs validos
- **Type safety**: No puedes pasar un string cualquiera donde se espera un EntityId
- **Comparacion segura**: `id1.equals(id2)` en vez de `id1 === id2` (que falla con objetos)

**Metodos importantes:**
- `create()` - Genera nuevo UUID
- `fromString()` - Parsea y valida UUID existente
- `equals()` - Comparacion segura entre IDs

---

### Timestamp (HULC - Hybrid Unique Logical Clock)

**Problema que resuelve:**
En sistemas CRDT (Conflict-free Replicated Data Types), necesitamos ordenar cambios de multiples dispositivos. El reloj fisico no basta porque:
1. Los relojes de diferentes dispositivos no estan sincronizados
2. Multiples cambios pueden ocurrir en el mismo milisegundo

**Solucion:**
HULC combina tres componentes:

```
2024-02-26T12:00:00.000Z-0042-abc123def4567890
└────────────────────────┘ └──┘ └──────────────┘
     Tiempo fisico (ms)   Counter    Node ID
```

1. **Tiempo fisico**: Milisegundos desde epoch (ordenamiento aproximado)
2. **Counter**: Se incrementa cuando hay cambios en el mismo milisegundo
3. **Node ID**: Identificador unico del dispositivo (16 chars hex)

**Como funciona el ordenamiento:**
```typescript
// Dispositivo A hace cambio a las 12:00:00.000
const ts1 = "2024-02-26T12:00:00.000Z-0000-aaaaaaaaaaaaaaaa"

// Dispositivo B hace cambio a las 12:00:00.000 (mismo ms!)
const ts2 = "2024-02-26T12:00:00.000Z-0000-bbbbbbbbbbbbbbbb"

// ts1 < ts2 porque "aaa..." < "bbb..." lexicograficamente
// El ordenamiento es DETERMINISTA en todos los dispositivos
```

**Por que es critico para sync:**
Actual Budget usa CRDT para sincronizacion. Cada campo de cada registro tiene un timestamp. Cuando llegan cambios de multiples dispositivos, el cambio con timestamp mayor "gana". Esto permite merge automatico sin conflictos.

---

### BudgetMonth

**Problema que resuelve:**
En presupuestos, trabajamos con meses completos, no fechas especificas. Febrero 2024 es febrero 2024, sin importar si es el dia 1 o 28.

**Solucion:**
`BudgetMonth` representa un mes como `YYYYMM` (ej: 202402 para febrero 2024).

```typescript
// Navegacion entre meses
const febrero = BudgetMonth.fromString("2024-02");
const marzo = febrero.next();        // 2024-03
const enero = febrero.previous();    // 2024-01
const mayo = febrero.addMonths(3);   // 2024-05

// Cruce de ano automatico
const dic = BudgetMonth.fromString("2024-12");
const ene = dic.next(); // 2025-01 (no 2024-13!)
```

**Por que existe:**
- Evita errores de "que dia del mes usar" (el 1? el 15? el ultimo?)
- Navegacion de meses correcta (diciembre + 1 = enero del siguiente ano)
- Comparaciones simples (202402 < 202403)

**Usado en:**
- Pantalla de presupuesto (seleccionar mes a ver)
- Calculos de presupuesto (cuanto asigne este mes)
- Reportes mensuales

---

### TransactionDate

**Problema que resuelve:**
Las transacciones tienen fecha pero no hora. "Compre cafe el 26 de febrero" - no importa si fue a las 9am o 3pm para efectos del presupuesto.

**Solucion:**
`TransactionDate` almacena fechas como enteros `YYYYMMDD` (ej: 20240226).

```typescript
const fecha = TransactionDate.fromString("2024-02-26");
fecha.getYear();   // 2024
fecha.getMonth();  // 2
fecha.getDay();    // 26
fecha.toNumber();  // 20240226

// Conexion con BudgetMonth
fecha.getBudgetMonth(); // BudgetMonth(2024, 2)
```

**Por que entero y no Date:**
- **Sin problemas de timezone**: `20240226` es igual en cualquier parte del mundo
- **Comparaciones simples**: `20240226 < 20240301`
- **Compatible con SQLite**: Se almacena como INTEGER, busquedas rapidas

**Validacion:**
```typescript
TransactionDate.fromString("2024-02-30"); // ERROR: febrero no tiene 30 dias
TransactionDate.fromString("2023-02-29"); // ERROR: 2023 no es bisiesto
TransactionDate.fromString("2024-02-29"); // OK: 2024 es bisiesto
```

---

## Entidades

Las Entidades tienen identidad unica que persiste a lo largo del tiempo. Dos entidades con los mismos atributos pero diferentes IDs son diferentes. Pueden mutar su estado interno.

### Account

**Que representa:**
Una cuenta bancaria, tarjeta de credito, efectivo, o cualquier lugar donde se guarda dinero.

**Por que existe:**
Es el contenedor principal de transacciones. Cada transaccion debe pertenecer a una cuenta.

**Atributos clave:**
```typescript
interface AccountProps {
  id: EntityId;          // Identificador unico
  name: string;          // "Checking", "Visa", "Cash"
  offbudget: boolean;    // Si false, afecta el presupuesto
  closed: boolean;       // Cuenta cerrada (no borrada)
  sortOrder: number;     // Orden en la lista
  tombstone: boolean;    // Borrado logico para sync
}
```

**offbudget explicado:**
- `offbudget: false` (normal): Transacciones afectan categorias de presupuesto
- `offbudget: true`: Transacciones no afectan presupuesto (ej: cuenta de inversion)

**tombstone explicado:**
En vez de borrar fisicamente, marcamos `tombstone: true`. Esto permite:
1. Sincronizar el borrado a otros dispositivos
2. Mantener historial
3. Posible recuperacion

**Invariantes:**
- Nombre no puede estar vacio
- sortOrder >= 0

---

### Transaction

**Que representa:**
Un movimiento de dinero: compra, deposito, transferencia, etc.

**Por que es la entidad mas compleja:**
Es el corazon de la app. Cada gasto, ingreso o movimiento es una transaccion.

**Atributos clave:**
```typescript
interface TransactionProps {
  id: EntityId;
  accountId: EntityId;      // Cuenta donde ocurrio
  categoryId?: EntityId;    // Categoria (Groceries, Rent, etc.)
  payeeId?: EntityId;       // Quien recibio/envio dinero
  amount: Money;            // Monto (negativo = gasto)
  date: TransactionDate;    // Cuando ocurrio
  notes?: string;           // Descripcion opcional
  cleared: boolean;         // Confirmado con estado de cuenta
  reconciled: boolean;      // Cuadrado con el banco
  tombstone: boolean;       // Borrado logico

  // Para split transactions
  isParent: boolean;        // Es padre de splits
  isChild: boolean;         // Es hijo de un split
  parentId?: EntityId;      // ID del padre si es child
  sortOrder: number;
}
```

**Split Transactions explicado:**
Una compra de $100 en el supermercado puede dividirse:
- $60 en Groceries
- $30 en Household
- $10 en Personal Care

```
Transaction (Parent): $100, Walmart, isParent: true
  └── Transaction (Child): $60, Groceries, isChild: true, parentId: parent.id
  └── Transaction (Child): $30, Household, isChild: true, parentId: parent.id
  └── Transaction (Child): $10, Personal Care, isChild: true, parentId: parent.id
```

**Estados cleared/reconciled:**
```
Flujo normal:
1. Creas transaccion -> cleared: false, reconciled: false
2. Ves que aparece en estado de cuenta -> clear() -> cleared: true
3. Cuadras el mes con el banco -> reconcile() -> reconciled: true

Regla: Solo puedes reconcile() si ya esta cleared()
Regla: No puedes unclear() si ya esta reconciled()
```

**Convencion de signos:**
- **Negativo**: Dinero que sale (gastos, transferencias enviadas)
- **Positivo**: Dinero que entra (ingresos, transferencias recibidas)

---

### Category

**Que representa:**
Una categoria de presupuesto: Groceries, Rent, Entertainment, etc.

**Por que existe:**
El presupuesto por sobres (envelope budgeting) requiere asignar dinero a categorias. Cada dolar tiene un trabajo.

**Atributos clave:**
```typescript
interface CategoryProps {
  id: EntityId;
  name: string;           // "Groceries", "Rent"
  groupId: EntityId;      // Grupo al que pertenece
  isIncome: boolean;      // Categoria de ingresos
  hidden: boolean;        // Oculta pero no borrada
  sortOrder: number;
  tombstone: boolean;
}
```

**isIncome explicado:**
Las categorias de ingreso funcionan diferente:
- Ingresos no se "presupuestan" de la misma forma
- Alimentan el dinero "To Be Budgeted"

**Relacion con CategoryGroup:**
```
CategoryGroup: "Monthly Bills"
  └── Category: "Rent"
  └── Category: "Utilities"
  └── Category: "Internet"

CategoryGroup: "Everyday Expenses"
  └── Category: "Groceries"
  └── Category: "Transportation"
  └── Category: "Dining Out"
```

---

### CategoryGroup

**Que representa:**
Un agrupador visual de categorias relacionadas.

**Por que existe:**
Organiza la pantalla de presupuesto. Sin grupos, tendrias 30+ categorias en una lista plana.

**Atributos clave:**
```typescript
interface CategoryGroupProps {
  id: EntityId;
  name: string;           // "Monthly Bills", "Savings Goals"
  isIncome: boolean;      // Grupo de ingresos
  hidden: boolean;
  sortOrder: number;
  tombstone: boolean;
}
```

**Ejemplo de estructura tipica:**
```
Income (isIncome: true)
  └── Salary
  └── Freelance

Monthly Bills
  └── Rent
  └── Utilities
  └── Phone

Everyday Expenses
  └── Groceries
  └── Gas
  └── Dining Out

Savings Goals
  └── Emergency Fund
  └── Vacation
  └── New Car
```

---

### Payee

**Que representa:**
Una persona, empresa o destino de dinero: "Amazon", "Landlord", "Transfer: Savings".

**Por que existe:**
- Permite autocompletar al ingresar transacciones
- Agrupa transacciones por comercio/persona
- Maneja transferencias entre cuentas

**Atributos clave:**
```typescript
interface PayeeProps {
  id: EntityId;
  name: string;                    // "Amazon", "Starbucks"
  transferAccountId?: EntityId;    // Si es payee de transferencia
  tombstone: boolean;
}
```

**Transfer Payees explicado:**
Cuando transfieres dinero entre cuentas, Actual crea payees especiales:

```typescript
// Cuentas
const checking = Account.create({ name: "Checking" });
const savings = Account.create({ name: "Savings" });

// Payees de transferencia (creados automaticamente)
const transferToSavings = Payee.createTransferPayee({
  name: "Transfer: Savings",
  accountId: savings.id
});

// Transferencia de Checking a Savings
// En Checking: Transaction { payee: transferToSavings, amount: -500 }
// En Savings: Transaction { payee: transferFromChecking, amount: +500 }
```

**isTransferPayee:**
```typescript
payee.isTransferPayee  // true si tiene transferAccountId
```
Esto permite a la UI mostrar transferencias de forma especial y vincular las dos transacciones.

---

## Relaciones entre Entidades

```
┌─────────────────────────────────────────────────────────────┐
│                        Account                               │
│  (Checking, Savings, Credit Card)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Transaction                             │
│  (amount, date, cleared, reconciled)                        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ N:1                │ N:1                │ N:1
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Payee     │      │  Category   │      │ Transaction │
│             │      │             │      │  (Parent)   │
│ Transfer?───┼──────│─────────────│──────│─────────────│
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            │ N:1
                            ▼
                   ┌─────────────────┐
                   │ CategoryGroup   │
                   └─────────────────┘
```

---

## Por que Value Objects vs Primitivos

| Primitivo | Problema | Value Object |
|-----------|----------|--------------|
| `number` para dinero | Errores de precision flotante | `Money` |
| `string` para UUID | Sin validacion, typos | `EntityId` |
| `string` para timestamp | Formato inconsistente | `Timestamp` |
| `string` para fecha | Problemas timezone | `TransactionDate` |
| `number` para mes | Logica de navegacion dispersa | `BudgetMonth` |

---

## Por que Entidades vs Objetos Planos

| Objeto Plano | Problema | Entidad |
|--------------|----------|---------|
| `{ name: "" }` | Permite estados invalidos | `Account` valida nombre |
| Mutacion directa | Sin control de invariantes | Metodos controlados |
| Sin identidad | No sabemos si es "el mismo" | `EntityId` unico |
| Sin encapsulacion | Logica dispersa en la app | Logica en la entidad |

---

## Conclusion

Este modelo de dominio:

1. **Previene bugs comunes** (precision monetaria, validacion de fechas)
2. **Es compatible con sync CRDT** (timestamps HULC, tombstones)
3. **Es testeable** (sin dependencias externas)
4. **Es expresivo** (el codigo dice lo que hace: `money.add(other)` vs `a + b`)
5. **Encapsula reglas de negocio** (no puedes reconciliar sin cleared)

El Domain Layer es el nucleo de la aplicacion. Todas las demas capas (persistence, API, UI) dependen de el, pero el no depende de nada externo.
