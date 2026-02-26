# Plan General: Actual Budget Mobile (Expo)

## Vision General

Crear una aplicacion movil con Expo que replique Actual Budget, compatible con el servidor de sincronizacion existente. Utilizaremos **Arquitectura Hexagonal** con **Entidades y Value Objects** para facilitar testing y mantener la logica de negocio independiente de las implementaciones.

---

## Arquitectura Hexagonal

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│              (React Native / Expo Components)                   │
│   Screens, Components, Navigation, Hooks de UI                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│                    (Use Cases / Services)                       │
│   CreateTransaction, SyncBudget, ImportTransactions, etc.       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                               │
│            (Entidades, Value Objects, Ports)                    │
│   Account, Transaction, Category, Money, Timestamp, etc.        │
│   Repository Interfaces (Ports)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                           │
│                    (Adapters / Implementations)                 │
│   SQLiteAccountRepository, ActualServerAPI, CRDTSync, etc.      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estructura de Carpetas

```
actual-expo/
├── app/                          # Expo Router (Presentation)
│   ├── (tabs)/
│   ├── (auth)/
│   └── _layout.tsx
│
├── src/
│   ├── domain/                   # DOMAIN LAYER
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── ports/
│   │   ├── errors/
│   │   └── events/
│   │
│   ├── application/              # APPLICATION LAYER
│   │   ├── use-cases/
│   │   ├── services/
│   │   └── dtos/
│   │
│   ├── infrastructure/           # INFRASTRUCTURE LAYER
│   │   ├── persistence/
│   │   ├── sync/
│   │   ├── api/
│   │   ├── crypto/
│   │   └── storage/
│   │
│   └── presentation/             # PRESENTATION LAYER
│       ├── hooks/
│       ├── components/
│       ├── screens/
│       ├── stores/
│       └── providers/
│
├── docs/                         # Documentacion
│   ├── PLAN.md
│   └── subplans/
│
└── package.json
```

---

## Subplanes

| # | Subplan | Capa | Estado |
|---|---------|------|--------|
| 1 | [Fundacion](./subplans/01-fundacion.md) | Domain | Pendiente |
| 2 | [Persistencia](./subplans/02-persistencia.md) | Infrastructure | Pendiente |
| 3 | [CRDT Sync](./subplans/03-crdt-sync.md) | Infrastructure | Pendiente |
| 4 | [API Client](./subplans/04-api-client.md) | Infrastructure | Pendiente |
| 5 | [Use Cases](./subplans/05-use-cases.md) | Application | Pendiente |
| 6 | [Presupuestos](./subplans/06-presupuestos.md) | Domain + App | Pendiente |
| 7 | [UI Base](./subplans/07-ui-base.md) | Presentation | Pendiente |
| 8 | [UI Budget](./subplans/08-ui-budget.md) | Presentation | Pendiente |
| 9 | [Rules/Schedules](./subplans/09-rules-schedules.md) | Domain + App | Pendiente |
| 10 | [Integracion](./subplans/10-integracion.md) | All | Pendiente |

---

## Dependencias entre Subplanes

```
[1] Fundacion
     │
     ├──► [2] Persistencia ──► [5] Use Cases ──► [7] UI Base
     │         │                    │                 │
     │         │                    ▼                 ▼
     │         └──────────────► [6] Presupuestos ► [8] UI Budget
     │
     └──► [3] Sync CRDT ──► [4] API Client ──► [5] Use Cases
                                                     │
                                                     ▼
                                              [9] Rules/Schedules
                                                     │
                                                     ▼
                                              [10] Integracion
```

---

## Decisiones Tecnicas

| Decision | Eleccion | Razon |
|----------|----------|-------|
| **Ubicacion** | `../actual-expo/` | Carpeta hermana al proyecto original |
| **State Management** | Zustand | Simple, menos boilerplate |
| **Testing** | Vitest | Rapido, compatible con TypeScript |
| **Database** | expo-sqlite | Nativo, compatible con Actual |
| **Navigation** | Expo Router | File-based routing |

---

## Tecnologias

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-sqlite": "~15.0.0",
    "expo-crypto": "~14.0.0",
    "expo-secure-store": "~14.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",
    "protobufjs": "^7.0.0",
    "uuid": "^9.0.0",
    "date-fns": "^3.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react-native": "^12.0.0",
    "typescript": "~5.3.0"
  }
}
```

---

## Criterios de Exito

- [ ] App puede hacer login contra servidor Actual
- [ ] App puede descargar archivo existente
- [ ] App puede mostrar cuentas y transacciones
- [ ] App puede crear transaccion que se sincroniza al servidor
- [ ] App puede editar presupuesto mensual
- [ ] Cambios hechos en web se reflejan en app movil

---

## Notas

- **No over-engineering:** Implementar solo lo necesario para MVP
- **Incremental:** Cada subplan produce codigo funcional
- **Compatibilidad:** Mantener formato exacto para sincronizacion
- **Mobile-first:** Optimizar UX para pantallas tactiles
