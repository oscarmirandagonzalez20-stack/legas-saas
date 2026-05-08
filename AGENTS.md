# AGENTS.md — Convenciones para agentes (Antigravity, Claude Code, etc.)

> Este archivo complementa a `CLAUDE.md`. Mientras `CLAUDE.md` describe el contrato del proyecto (stack, reglas, prohibiciones), `AGENTS.md` describe **cómo trabajar** dentro de un IDE agentic.
> Optimizado para Antigravity (Google) pero compatible con Claude Code y otros agentes que respeten la convención `AGENTS.md`.

---

## 1. Cómo descomponer trabajo

**Regla de oro:** una tarea de agente debe ser ejecutable en una sola "sesión continua" y verificable de forma independiente. Si una tarea requiere más de 4 horas o más de 6 archivos modificados, divídela.

### Tamaño correcto de una tarea
- ✅ "Implementa el módulo `comments` en `apps/api`: controller, service, DTOs, tests."
- ✅ "Agrega la página `/leads` en `apps/web` con tabla server-side y filtros por etapa."
- ✅ "Crea `packages/meta-sdk` con cliente tipado para `POST /me/messages` y manejo de errores 190, 200, 230."
- ❌ "Implementa todo el sistema de inbox." (Demasiado grande, dividir en: vista lista, vista detalle, acciones, websocket realtime).
- ❌ "Mejora el rendimiento." (Sin objetivo medible).

### Cómo dividir
- **Por capa horizontal** cuando la feature tiene front + back: 1 tarea para el endpoint + tests, 1 tarea para la UI que lo consume.
- **Por entidad vertical** cuando la feature es un nuevo dominio: schema → repo → service → controller → UI.
- **Por riesgo** cuando hay módulos de seguridad: separar el módulo crítico (auth, webhooks, cifrado) en tarea propia con review más estricto.

---

## 2. Trabajo paralelo (especialmente útil en Antigravity)

Estas son las tareas que pueden ejecutarse en paralelo sin conflictos:

| Agente A | Agente B (paralelo seguro) |
|---|---|
| Backend: módulo `templates` en `apps/api` | Frontend: página `/templates` en `apps/web` |
| Backend: schema Prisma + migración | Documentación: ADR para esa feature |
| AI: nuevo prompt en `apps/ai` | Frontend: UI para sugerencias de IA |
| Tests e2e Playwright | Refactor de naming en otro módulo |

**No paralelizar** cuando:
- Ambas tareas tocan `prisma/schema.prisma` (conflicto de migraciones).
- Ambas tocan `packages/shared-types` (conflicto de tipos).
- Una depende del output de la otra (ej. UI necesita endpoint que no existe).

---

## 3. Protocolo de verificación (obligatorio antes de marcar tarea completa)

Cada tarea de agente debe terminar con:

```bash
# 1. Tipos
pnpm typecheck

# 2. Lint
pnpm lint

# 3. Tests del paquete tocado (mínimo)
pnpm --filter <package> test

# 4. Build del paquete tocado
pnpm --filter <package> build
```

Si todo verde, la tarea es candidata a PR. Si hay tests que fallan que **no son del cambio**, se documenta en el PR description con análisis de por qué.

### Verificación específica por tipo de cambio

**Cambio en schema Prisma:**
```bash
pnpm db:migrate         # Aplica migración
pnpm db:studio          # Inspecciona visualmente
pnpm --filter api test  # Re-corre tests con nuevo schema
```
Además, ejecutar el test de RLS multi-tenant: `pnpm --filter api test:rls`.

**Cambio en webhooks Meta:**
- Tests de firma HMAC válida e inválida.
- Test de idempotencia (mismo `comment_id` dos veces → solo se procesa uno).
- Test de respuesta < 200ms (con timer mock).

**Cambio en envío de DM:**
- Test de error 230 (fuera de ventana 24h) no reintenta.
- Test de error 10903 (rate limit) reencola con backoff.
- Test de éxito persiste en `messages` y actualiza `conversations.last_message_at`.

---

## 4. Archivos críticos que requieren confirmación humana antes de modificar

Antes de modificar estos archivos, el agente debe **pedir confirmación explícita**:

- `apps/api/prisma/schema.prisma` (cambios destructivos: drop column, drop table, type change).
- `apps/api/src/modules/auth/**`
- `apps/api/src/modules/meta/meta.controller.ts` (webhook handler).
- `apps/api/src/common/encryption/**`
- `apps/api/src/common/tenant-context/**`
- `.env.example` (agregar variables, nunca secretos reales).
- `infra/terraform/**`
- Cualquier archivo en `docs/compliance/`.

Cambios no destructivos (agregar campo nullable, agregar endpoint nuevo, agregar test) no requieren confirmación.

---

## 5. Cuando un agente debe parar y preguntar

- Cuando la solución implica cambiar una dependencia mayor (Next, Nest, Prisma) de versión.
- Cuando el agente detecta un bug en código fuera del scope de la tarea (registrarlo en issue, no arreglarlo silenciosamente).
- Cuando los tests existentes fallan después de un cambio que parecía no relacionado (señal de acoplamiento oculto).
- Cuando la solución más natural choca con una regla de `CLAUDE.md` (la regla gana, pero documentar el trade-off).
- Cuando se sospecha que la tarea revela un problema arquitectónico mayor (proponer ADR antes de continuar).

---

## 6. Estilo de pull requests generados por agentes

Plantilla obligatoria:

```markdown
## Qué cambia
<3-5 líneas>

## Por qué
<link a issue, ADR o motivo>

## Cómo se verifica
- [ ] `pnpm typecheck` ✅
- [ ] `pnpm lint` ✅
- [ ] `pnpm test --filter <pkg>` ✅
- [ ] Probado manualmente: <pasos si aplica>

## Riesgos
<lista corta. Si no hay, escribir "ninguno conocido".>

## Seguimiento
<lo que NO se hizo en este PR pero debe hacerse después>
```

---

## 7. Browser automation y testing visual (Antigravity)

Cuando Antigravity ejecute pruebas visuales con browser:

- Usar el preview deploy de Vercel del PR, no localhost (más estable).
- Login con cuenta tester pre-creada (credenciales en secret manager, no hardcodeadas).
- Escenarios obligatorios para todo cambio en `apps/web`:
  1. Onboarding wizard completo.
  2. Conexión de Meta (mock OAuth en preview).
  3. Vista de inbox con seed data.
  4. Crear y editar plantilla.
- Captura de pantalla de cualquier estado nuevo. Adjuntar al PR.

---

## 8. Manejo de secretos durante ejecución agentic

- **Nunca** hardcodear secretos. Si un agente necesita un secret para un test, debe leerlo de `process.env` y el setup de CI debe inyectarlo.
- Para desarrollo local, los agentes leen `.env` (que está en `.gitignore`). Si el archivo no existe, el agente debe **detenerse y pedir** que se cree desde `.env.example`.
- Bajo ninguna circunstancia un agente sube un `.env` real a git ni a un PR.

---

## 9. Comunicación entre agentes (multi-agent en Antigravity)

Cuando múltiples agentes trabajen en paralelo:

- **Coordinador (humano o agente lead)** asigna tareas usando issues etiquetados con `agent:N` (1, 2, 3…).
- Cada agente trabaja en su propia branch: `agent-N/feature-name`.
- Antes de hacer rebase/merge, comunicar via comentario en el issue.
- Si dos agentes tocan el mismo archivo, el segundo en terminar es responsable del rebase y de re-correr la verificación completa.

---

## 10. Qué NO automatizar con agentes

- Decisiones de arquitectura (siempre humanas, plasmadas en ADR).
- Pricing y comunicación con clientes.
- Cambios en términos legales o aviso de privacidad.
- App Review submissions a Meta (humano lo hace, agente prepara el material).
- Despliegues a producción (CI puede deployar a staging; producción requiere aprobación humana en GitHub Environment).
- Borrado de datos (incluso en dev, prefiere reset completo de DB que delete selectivo automatizado).

---

**Versión:** 1.0
**Compatible con:** Antigravity, Claude Code, Cursor (con adaptaciones), cualquier IDE que respete la convención AGENTS.md.
