# legal-saas-ai

Servicio FastAPI en Python para clasificación de intención y resúmenes con Anthropic Claude.

## Estado: scaffolding pendiente (Issue #8)

Sigue `SETUP.md` sección 6:

```bash
cd apps/ai
# Con uv (recomendado):
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
# O con pip:
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

Arrancar dev:

```bash
uvicorn app.main:app --reload --port 8000
```

## Endpoints planeados (Fase 1)

- `POST /classify` — body `{ text, context? }` → `{ intent, lead_score, urgencia, suggested_template_id? }`. Usa Haiku.
- `POST /summarize` — body `{ messages: [...] }` → `{ summary, action_items[] }`. Usa Sonnet.
- `GET /health`.

## Reglas

- **Nunca** redacta respuestas finales al lead. Sólo clasifica y sugiere plantillas (ver ADR 0004).
- Toda llamada a Anthropic con timeout, retries con backoff y log estructurado.
- Auth interna: header `X-Internal-Token` compartido con `apps/api` (no exponer público).
- Caché en Redis para clasificaciones por hash de texto (TTL 7 días).
