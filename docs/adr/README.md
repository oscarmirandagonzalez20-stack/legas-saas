# Architecture Decision Records (ADRs)

Decisiones arquitectónicas con contexto, alternativas y consecuencias. Formato: [Michael Nygard short ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## Índice

| # | Título | Estado |
| --- | --- | --- |
| 0001 | [Monorepo con pnpm + Turborepo](./0001-monorepo-pnpm-turborepo.md) | Aceptado |
| 0002 | [Multi-tenancy con shared DB + RLS](./0002-multi-tenancy-rls.md) | Aceptado |
| 0003 | [Integración Meta vía Graph API oficial](./0003-meta-graph-api-oficial.md) | Aceptado |
| 0004 | [Rol de la IA: clasificadora, no asesora](./0004-ia-clasificadora-no-asesora.md) | Aceptado |
| 0005 | [Cifrado de tokens AES-256-GCM](./0005-cifrado-tokens-aes-gcm.md) | Aceptado |

## Cómo escribir un ADR nuevo

1. Copia uno existente como plantilla.
2. Numéralo secuencial (`0006-...`).
3. Estado: `Propuesto` → `Aceptado` (tras review) → `Reemplazado por NNNN` o `Deprecado`.
4. PR con label `area:docs` y `type:adr`.
5. Discute en el PR; al merge, queda registro inmutable.

**No edites un ADR aceptado.** Si la decisión cambia, crea uno nuevo que lo reemplace y actualiza el estado del antiguo.
