# ADR 0001 — Monorepo con pnpm + Turborepo

- **Estado:** Aceptado
- **Fecha:** 2026-05-06
- **Decisores:** Equipo fundador

## Contexto

El SaaS legal requiere coordinar al menos tres aplicaciones (web Next.js, API NestJS, servicio IA FastAPI) y varios paquetes compartidos (tipos, SDK Meta, UI). Necesitamos:

- Compartir tipos TypeScript entre web y API sin publicar a npm.
- Cache de builds y tests para CI rápido.
- Un único `pnpm install` y versionado lockstep.
- Bajo overhead operacional (somos un equipo pequeño).

## Decisión

Usaremos un **monorepo único** gestionado con:

- **pnpm workspaces** (`pnpm-workspace.yaml`) para resolución de dependencias.
- **Turborepo** para orquestación de tareas (`build`, `lint`, `test`, `typecheck`) con cache local y remoto opcional.
- Estructura `apps/*` y `packages/*`.

## Alternativas consideradas

| Opción | Por qué no |
| --- | --- |
| Polirepo (un repo por app) | Multiplica CI, dificulta tipos compartidos, fricción para cambios cross-cutting. |
| Nx | Más potente pero curva de aprendizaje y opinión más fuerte de la necesaria en Fase 1. |
| Lerna + Yarn | Lerna en mantenimiento; pnpm + Turbo es el estándar de facto 2025+. |

## Consecuencias

**Positivas:**
- Un solo `git clone` + `pnpm install` deja el dev listo.
- Cache de Turbo acelera CI 3-10x en cambios incrementales.
- Tipos de Prisma exportables a web vía `@legal-saas/shared-types`.

**Negativas / a vigilar:**
- Tamaño del repo crece; usar `.gitattributes` para LFS si aparecen binarios.
- Hay que disciplinar las dependencias entre paquetes (no ciclos).
- Turborepo remote cache requiere cuenta Vercel si lo activamos; opcional.

## Referencias

- https://turborepo.com/docs
- https://pnpm.io/workspaces
