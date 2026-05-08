# SETUP.md — Guía paso a paso desde cero

> Esta guía es para el primer desarrollador que arranca el proyecto en su máquina o el primer día en Claude Code/Antigravity.
> Tiempo estimado: 60–90 min si todas las cuentas externas ya existen.

---

## 0. Pre-requisitos en tu máquina

```bash
# Verificar versiones
node --version          # Debe ser ≥ 20.11
pnpm --version          # Debe ser ≥ 9.0
docker --version        # Cualquier versión moderna
git --version
```

Si falta `pnpm`:
```bash
npm install -g pnpm@latest
```

Si falta Node con la versión correcta, usa `nvm`:
```bash
nvm install 20.11.0 && nvm use 20.11.0
```

---

## 1. Crear cuentas externas (puedes hacerlo en paralelo)

| Servicio | Para qué | Plan inicial |
|---|---|---|
| [GitHub](https://github.com) | Repositorio y CI | Free |
| [Meta for Developers](https://developers.facebook.com/) | Graph API | Free (con verificación) |
| [Anthropic Console](https://console.anthropic.com/) | LLM | Pay-as-you-go |
| [Vercel](https://vercel.com/) | Hosting frontend | Hobby (gratis) |
| [Railway](https://railway.app/) o [Render](https://render.com/) | Hosting backend | $5–20/mes |
| [Clerk](https://clerk.com/) | Auth multi-tenant | Free hasta 10K MAU |
| [Stripe](https://dashboard.stripe.com/) | Pagos (test mode) | Free |
| [Sentry](https://sentry.io/) | Error tracking | Free |
| [Resend](https://resend.com/) | Email transaccional | Free hasta 3K/mes |
| [Cloudflare](https://www.cloudflare.com/) | DNS + WAF | Free |

**Puedes posponer Stripe, Resend y Sentry hasta el Sprint 4.** Lo crítico para arrancar es: Meta Developers, Anthropic, Clerk.

---

## 2. Setup de Meta Developers (lo más complejo, hazlo primero)

1. Ir a [developers.facebook.com](https://developers.facebook.com/) e iniciar sesión.
2. **My Apps → Create App** → tipo **"Business"**.
3. Nombre: "Legal SaaS Dev" (cambiarás esto antes de producción).
4. En la app, agregar productos:
   - **Facebook Login for Business**
   - **Webhooks**
   - **Messenger** (incluye Instagram Messaging)
5. En **Webhooks**:
   - Subscription URL: la usaras de tu túnel ngrok/cloudflared (ver paso 8).
   - Verify Token: el valor que pondrás en `.env` como `META_VERIFY_TOKEN`.
6. En **App Settings → Basic**:
   - Política de privacidad URL: por ahora un placeholder; antes de App Review debe ser real.
   - Categoría: "Business and Pages".
7. **Crear página de Facebook de prueba** (puede ser una página de prueba: "Despacho Test").
8. **Crear cuenta de Instagram Business de prueba** y vincularla a la página FB.
9. En la app, sección **App Roles**, agregar tu usuario como **Tester**.

> Más adelante (Sprint 6) solicitarás permisos vía App Review. Por ahora trabajamos en modo Development con Tester users, lo que es suficiente para todo el dev.

---

## 3. Inicializar el repositorio

Si ya tienes este paquete inicial:

```bash
cd legal-saas
git init
git branch -M main
git add .
git commit -m "chore: initial monorepo scaffold"

# Crear repo privado en GitHub (puedes usar gh CLI)
gh repo create legal-saas --private --source=. --remote=origin --push
```

---

## 4. Instalar dependencias del monorepo

```bash
pnpm install
```

Esto **fallará** la primera vez si los `apps/*` no tienen `package.json`. Los crearemos en los pasos siguientes.

---

## 5. Configurar variables de entorno

```bash
cp .env.example .env
```

Generar `ENCRYPTION_KEY` y `META_VERIFY_TOKEN`:

```bash
# ENCRYPTION_KEY (32 bytes en base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# META_VERIFY_TOKEN (cualquier string fuerte)
openssl rand -hex 32
```

Pega ambos en `.env`. También pega tu `ANTHROPIC_API_KEY` y los datos de la app de Meta.

---

## 6. Levantar Postgres + Redis

```bash
pnpm db:up
```

Verificar que todo esté arriba:

```bash
docker ps
# Debes ver: legal-saas-postgres, legal-saas-redis, legal-saas-adminer, legal-saas-redis-commander
```

Test de conexión a Postgres:

```bash
docker exec -it legal-saas-postgres psql -U legal_saas -d legal_saas_dev -c "SELECT version();"
```

---

## 7. Crear el scaffold de las apps

### 7.1 `apps/api` (NestJS)

```bash
cd apps/api
pnpm dlx @nestjs/cli new . --skip-install --package-manager pnpm --strict
# Seleccionar Fastify cuando pregunte (o configurar después).
```

Después de crear, instalar Prisma y dependencias adicionales:

```bash
pnpm add prisma @prisma/client
pnpm add @nestjs/platform-fastify fastify
pnpm add bullmq ioredis
pnpm add zod nestjs-zod
pnpm add @clerk/backend
pnpm add -D @types/node ts-node
```

Inicializar Prisma:

```bash
pnpm prisma init
# Reemplazar el schema.prisma generado con el provisto en este paquete inicial
# (apps/api/prisma/schema.prisma).
```

### 7.2 `apps/web` (Next.js)

```bash
cd ../web
pnpm dlx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint
# (eslint lo agregaremos compartido desde packages/eslint-config)
```

Instalar dependencias adicionales:

```bash
pnpm add @clerk/nextjs
pnpm add @tanstack/react-query zustand
pnpm add react-hook-form zod @hookform/resolvers
pnpm add lucide-react sonner cmdk
pnpm add class-variance-authority clsx tailwind-merge
```

Inicializar shadcn/ui:

```bash
pnpm dlx shadcn@latest init
# Estilo: New York. Color base: Neutral. CSS variables: yes.
```

### 7.3 `apps/ai` (FastAPI)

```bash
cd ../ai

# Inicializar con uv (recomendado) o poetry
pnpm dlx uv init --python 3.12

# Dependencias
uv add fastapi uvicorn[standard]
uv add anthropic openai
uv add pydantic pydantic-settings
uv add python-dotenv structlog
uv add --dev pytest pytest-asyncio ruff mypy
```

Crear estructura mínima:

```bash
mkdir -p app/routers app/services app/prompts
touch app/__init__.py app/main.py
touch app/routers/__init__.py app/routers/classify.py app/routers/health.py
touch app/services/__init__.py app/services/intent_classifier.py
```

---

## 8. Túnel HTTPS para webhooks de Meta (dev)

Meta requiere HTTPS público para los webhooks. En desarrollo usa **cloudflared** o **ngrok**:

```bash
# cloudflared (recomendado, free, sin login para dev)
brew install cloudflared          # macOS
# o descarga desde cloudflare.com

cloudflared tunnel --url http://localhost:4000
# Te dará una URL tipo: https://abc-def-ghi.trycloudflare.com
```

Pega esa URL en:
- `.env` → `META_WEBHOOK_URL=https://abc-def-ghi.trycloudflare.com/webhooks/meta`
- En la app de Meta → Webhooks → Edit Subscription URL.

> En cada reinicio de cloudflared cambia la URL. Esto es normal en dev. En producción usarás tu dominio real.

---

## 9. Aplicar primera migración

Una vez tengas el `schema.prisma` correcto en `apps/api/prisma/`:

```bash
pnpm db:migrate
# Te pregunta el nombre: "init"
```

Aplicar la migración manual de RLS:

```bash
# Crear una migración vacía y reemplazar su contenido:
pnpm db:migrate:create --name enable_rls
# Esto crea apps/api/prisma/migrations/<timestamp>_enable_rls/migration.sql
# Copiar el contenido de apps/api/prisma/migrations/manual_rls_setup.sql ahí.
pnpm db:migrate
```

---

## 10. Verificar que todo levanta

```bash
pnpm dev
```

Esperado:
- `apps/web` en http://localhost:3000 muestra la home de Next.js.
- `apps/api` en http://localhost:4000/health responde `{"status":"ok"}` (cuando lo implementemos).
- `apps/ai` en http://localhost:8000/health idem.

Si algo falla, ver logs por servicio:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:ai
```

---

## 11. Configurar GitHub Actions (CI mínimo)

Ya hay un workflow base en `.github/workflows/ci.yml`. Lo único que necesita son secrets en el repo:

GitHub → Settings → Secrets and variables → Actions → **New repository secret**:

- `DATABASE_URL_TEST` (Postgres test, puede ser el de Railway test)
- `ANTHROPIC_API_KEY_TEST`
- (otros conforme se agreguen)

---

## 12. Listo para Sprint 1

Si llegaste hasta aquí sin errores, el setup está correcto. Continúa con `BACKLOG.md` (issue 1).

Si algo falló, ver `CHECKLIST.md` para diagnosticar.

---

## Apéndice A — Errores comunes

**`pnpm install` falla con "ERR_PNPM_PEER_DEP_ISSUES"**
→ Agregar al `package.json` raíz:
```json
"pnpm": {
  "peerDependencyRules": {
    "ignoreMissing": ["@types/react"]
  }
}
```

**`docker compose up` falla con "port already allocated"**
→ Otro servicio usa el puerto 5432 o 6379. Detenerlo o cambiar puertos en `docker-compose.dev.yml`.

**Prisma no encuentra `pgvector`**
→ Verificar que la imagen Docker es `pgvector/pgvector:pg16` (no `postgres:16`). Recrear: `pnpm db:down && docker volume rm legal-saas-dev_postgres_data && pnpm db:up && pnpm db:migrate`.

**Webhook de Meta marca el verify token como inválido**
→ El valor en `.env` (`META_VERIFY_TOKEN`) y el que pegaste en la UI de Meta deben ser idénticos. Reiniciar `apps/api` después de cambiar `.env`.
