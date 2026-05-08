# Meta App Review — Guía de Preparación

**Producto:** Legal SaaS — Captación automática de leads para despachos jurídicos  
**Última actualización:** 2026-05-08  
**Responsable:** Engineering

---

## Qué hace la aplicación

La aplicación conecta páginas de Facebook y cuentas de Instagram Business de despachos de abogados. Detecta comentarios públicos con intención de contratar servicios legales, los convierte en leads en un CRM interno, y permite al despacho responder desde un inbox centralizado.

**Flujo completo:**
1. El despacho conecta su página FB y su cuenta IG mediante OAuth de Facebook.
2. La app suscribe el webhook de la página para recibir comentarios nuevos.
3. Cuando un usuario comenta en un post del despacho, Meta envía un evento al webhook.
4. La app clasifica el comentario, crea un lead y lo muestra en el inbox del despacho.
5. El abogado responde desde el inbox — nunca se envía nada automáticamente sin aprobación humana.

---

## Permisos solicitados

Estos son los permisos exactos que solicita la app en el diálogo OAuth. Justificación para cada uno:

### `pages_show_list`

**Para qué:** Obtener la lista de páginas de Facebook que administra el usuario que autoriza.  
**Por qué es necesario:** Sin este permiso, la app no puede saber qué páginas conectar después del login. Es el primer paso del flujo de onboarding.  
**Dato alternativo considerado:** No existe alternativa — es el permiso estándar de Meta para listar páginas administradas.

### `pages_read_engagement`

**Para qué:** Leer comentarios públicos en posts de la página.  
**Por qué es necesario:** La función core del producto es detectar comentarios con intención de contratar servicios legales. Sin este permiso, el webhook de comentarios no entrega datos del comentario.  
**Alcance real:** Solo se leen comentarios en posts de la página del despacho. Nunca se accede a datos de terceros.

### `pages_manage_metadata`

**Para qué:** Suscribir la página al webhook de Meta (`/PAGE_ID/subscribed_apps`).  
**Por qué es necesario:** Meta requiere este permiso para activar la entrega de eventos de webhook en la página. Sin él, el webhook queda verificado pero Meta no entrega eventos.  
**Acción que realiza:** Un único `POST /PAGE_ID/subscribed_apps` al conectar la página. No modifica contenido.

### `instagram_basic`

**Para qué:** Obtener información básica (username, nombre) de la cuenta Instagram Business vinculada a la página FB.  
**Por qué es necesario:** El usuario conecta FB+IG en un solo flow. Este permiso permite mostrar el nombre correcto de la cuenta IG en el dashboard del despacho.  
**Alcance real:** Solo `id`, `username`, `name` de la cuenta IG del propio usuario. Nunca datos de terceros.

### `instagram_manage_comments`

**Para qué:** Recibir eventos de comentarios de Instagram vía webhook.  
**Por qué es necesario:** Meta requiere este permiso para entregar eventos de comentarios de Instagram Business en el webhook. Sin él, los eventos de IG no se reciben aunque el webhook esté suscrito.  
**Acción que realiza:** Solo lectura de eventos entrantes. No publica, no modifica, no borra comentarios.

---

## URLs de la aplicación

| Propósito | URL |
|-----------|-----|
| OAuth Redirect URI | `https://api.yourdomain.com/meta/oauth/callback` |
| Webhook Callback URL | `https://api.yourdomain.com/webhooks/meta` |
| App Domain | `yourdomain.com` |
| Frontend del despacho | `https://app.yourdomain.com` |

> Reemplazar `yourdomain.com` con el dominio real antes de enviar a revisión.

---

## Credenciales de prueba para el reviewer

> El reviewer de Meta necesita credenciales reales para reproducir el flujo. Sin ellas, rechaza automáticamente.

Crear antes de enviar la revisión:

**Cuenta de usuario de prueba:**
- Email: `reviewer@tudominio.com` (cuenta Meta Business)
- Rol en la app: Developer o Tester
- Acceso a: página de demo FB + IG Business de demo

**Página de Facebook de demo:**
- Nombre: `Demo Despacho Jurídico`
- Tipo: Página de empresa / servicios legales
- Tiene al menos 1 post público con comentario de prueba

**Cuenta Instagram Business de demo:**
- Vinculada a la página FB de demo
- Tiene al menos 1 post con comentario de prueba

**Cuenta de despacho en la app:**
- URL de login: `https://app.yourdomain.com`
- Email: `reviewer@tudominio.com`
- Contraseña: [definir antes de enviar]

---

## Pasos exactos para el reviewer

El reviewer debe seguir estos pasos en orden. Hacer el camino extremadamente explícito — no asumir que investigará.

### Paso 1 — Login en el dashboard

1. Ir a `https://app.yourdomain.com`
2. Hacer clic en **"Iniciar sesión"**
3. Ingresar: `reviewer@tudominio.com` / `[contraseña]`
4. Se redirige al dashboard principal

### Paso 2 — Conectar página de Facebook

1. En el menú lateral, hacer clic en **"Configuración"** → **"Cuentas sociales"**
2. Hacer clic en **"Conectar cuenta"**
3. Se abre el diálogo de Facebook OAuth (login.facebook.com)
4. Iniciar sesión con la cuenta Meta de prueba
5. Seleccionar la página **"Demo Despacho Jurídico"** cuando se solicite
6. Hacer clic en **"Permitir"** para todos los permisos solicitados
7. El navegador redirige de vuelta al dashboard
8. La página FB y la cuenta IG vinculada aparecen en la lista de cuentas sociales con estado **"Activa"**

### Paso 3 — Verificar que el webhook está suscrito

1. Permanecer en **"Configuración"** → **"Cuentas sociales"**
2. La fila de la página FB debe mostrar: estado **"Activa"**, campo **"Webhook"**: subscrito
3. Si muestra error de webhook: indica que `pages_manage_metadata` no se concedió correctamente

### Paso 4 — Generar un comentario de prueba

1. Ir a la página FB **"Demo Despacho Jurídico"** como usuario externo (otra cuenta)
2. Comentar en cualquier post: _"¿Cuánto cobran por divorcio express?"_
3. Esperar 5–10 segundos

### Paso 5 — Verificar el lead en el inbox

1. Volver al dashboard en `https://app.yourdomain.com`
2. Hacer clic en **"Leads"** en el menú lateral
3. El comentario del paso 4 aparece como un nuevo lead con:
   - Nombre del usuario que comentó
   - Texto del comentario
   - Fecha y hora
   - Fuente: Facebook
4. Hacer clic en el lead para abrir el detalle

### Paso 6 — Verificar el inbox de conversaciones

1. Hacer clic en **"Inbox"** en el menú lateral
2. La conversación del lead aparece en la lista
3. Se puede ver el comentario original

---

## Script para video de demostración

El video es obligatorio para la App Review. Debe durar entre 2–5 minutos y mostrar exactamente los pasos del reviewer.

**Estructura recomendada:**

```
00:00 – 00:30  Introducción: mostrar el dashboard del despacho, explicar en voz off que es un CRM para despachos de abogados
00:30 – 01:30  Paso 1-3: conectar la página FB (mostrar el diálogo OAuth completo)
01:30 – 02:30  Paso 4: hacer el comentario en la página FB (mostrar la pantalla del post)
02:30 – 03:30  Paso 5-6: mostrar el lead apareciendo en tiempo real en el dashboard + inbox
03:30 – 04:00  Pantalla final: mostrar la lista de cuentas conectadas con estado "Activa"
```

**Notas para el video:**
- Grabar en resolución 1080p mínimo
- Ritmo lento y deliberado — los reviewers odian videos rápidos o confusos
- Cursor visible y ampliado (usar Cursor Highlighter en macOS o similar)
- Texto grande en el navegador (zoom al 125% o más)
- Sin música de fondo
- Sin cortes abruptos entre pasos
- Sin edición agresiva — el reviewer necesita ver que el sistema es real, no una demo editada
- Mostrar la URL en el navegador en todo momento
- No cortar entre el comentario y la aparición del lead — mostrar el flujo completo en tiempo real
- Si hay latencia de 5–10 segundos al aparecer el lead, no cortar: esa latencia demuestra que el sistema procesa eventos reales
- Subtítulos o voz en off en inglés (Meta reviewers no necesariamente hablan español)

**Herramientas:** Loom (recomendado — fácil de compartir), OBS, o QuickTime. Subir a YouTube (unlisted) o Google Drive.

---

## Preguntas frecuentes de rechazo y cómo responderlas

Meta rechaza revisiones por estas razones con más frecuencia. Preparar respuesta para cada una:

### "No podemos reproducir el flujo"

**Causa más común:** Las credenciales del paso anterior no funcionaron, o la cuenta de prueba no era Tester/Developer de la app.  
**Prevención:** Verificar que `reviewer@tudominio.com` aparece en Meta for Developers → Tu App → Roles → Testers antes de enviar.

### "El permiso X no está justificado"

**Respuesta para `pages_manage_metadata`:** "Este permiso es necesario únicamente para ejecutar `POST /PAGE_ID/subscribed_apps` al conectar la página. Es el mecanismo estándar de Meta para activar la entrega de webhook events en una página específica. Sin él, el webhook queda registrado en la app pero Meta no entrega eventos a la página individual."

**Respuesta para `instagram_manage_comments`:** "La app recibe comentarios de Instagram vía webhook. Meta requiere este permiso para entregar eventos de comentarios de cuentas Instagram Business en el callback del webhook. La app no publica, modifica ni elimina comentarios — solo los recibe como eventos entrantes."

### "La app no tiene Privacy Policy"

Publicar una Privacy Policy antes de enviar. Mínimo debe incluir:
- Qué datos se recopilan (comentarios públicos, nombre del usuario)
- Cómo se usan (clasificación de leads para el despacho)
- Con quién se comparten (no se comparten con terceros)
- Cómo el usuario puede solicitar eliminación

URL sugerida: `https://app.yourdomain.com/legal/privacidad`

### "La app no tiene Terms of Service"

Igual que Privacy Policy — publicar antes de enviar.  
URL sugerida: `https://app.yourdomain.com/legal/terminos`

### "El video no muestra el uso real de los permisos"

Asegurarse de que el video muestre explícitamente:
1. El diálogo OAuth con los permisos listados
2. El usuario aceptando cada permiso
3. Un comentario real generando un lead — que demuestra `pages_read_engagement` en uso

---

## Estabilidad del entorno demo

El reviewer puede volver 2–3 días después de la primera sesión, o un segundo reviewer puede tomar el caso. El entorno debe funcionar sin intervención manual durante toda la ventana de revisión (típicamente 5–10 días hábiles).

### Riesgos de inestabilidad y mitigaciones

**Tokens de página revocados:**  
Los tokens de página son técnicamente "no-expiring" mientras estén activos, pero se invalidan si el usuario revoca el acceso o cambia su contraseña de Facebook.  
Mitigación: la cuenta `reviewer@tudominio.com` debe tener **2FA activado** y la contraseña no debe cambiarse durante el período de revisión. Documentarlo en el equipo.

**Seed de base de datos:**  
`apps/api/prisma/seed.ts` está implementado e idempotente (seguro de re-ejecutar). Crea el tenant demo, usuario demo, membresía y 5 leads realistas. Si la staging DB se resetea: `pnpm db:seed` restaura el estado base en menos de 1 minuto. No resetear staging durante el período de review de todas formas.

**Instancia Railway durmiendo:**  
Ya configurado: `sleepApplication = false` en `apps/api/railway.toml`. El API no duerme aunque no haya tráfico. Sin acción adicional.

**Credenciales de Clerk expirando:**  
Si se usa Clerk en staging con claves de desarrollo, verificar que las claves no tienen fecha de expiración corta. Usar las mismas claves staging durante toda la revisión.

**Página FB de demo desconectada:**  
Un admin de la página puede desconectar la app accidentalmente. Verificar que solo `reviewer@tudominio.com` tiene acceso a administrar la app Meta durante la revisión.

### Verificación el día antes de enviar

```bash
# 1. Smoke test de staging
./scripts/smoke-test.sh https://staging-api.yourdomain.com

# 2. Esperar 5 minutos post-deploy (warmup de Prisma pool, Redis, Next.js cache)
#    No medir tiempos en el primer request — distorsiona la percepción real.

# 3. Verificar que el token de la cuenta demo no está próximo a expirar
#    Meta for Developers → Tu App → Herramientas → Access Token Debugger
#    Pegar el token de la página y verificar fecha de expiración
```

### Dry run de estabilidad — 3 corridas consecutivas

Ejecutar el flujo completo 3 veces **sin intervención manual** entre corridas. Llenar la tabla:

| Corrida | OAuth → cuenta Activa | Comentario → webhook | Lead visible en dashboard | Total | ¿OK? |
|---------|----------------------|----------------------|--------------------------|-------|------|
| #1 | ___ s | ___ s | ___ s | ___ s | ☐ |
| #2 | ___ s | ___ s | ___ s | ___ s | ☐ |
| #3 | ___ s | ___ s | ___ s | ___ s | ☐ |

**Criterio de aprobación:**
- Las 3 corridas pasan sin reinicio ni intervención manual
- Total comentario → lead visible: < 2 min en condiciones normales, < 5 min como máximo
- Si alguna corrida falla o supera 5 min: investigar antes de grabar el video

**Cuando las 3 corridas pasan → grabar el video → submit ese mismo día.**

---

## Checklist pre-envío

**Entorno demo:**
- [ ] `pnpm db:seed` ejecutado en staging (crea tenant demo + usuario demo + 5 leads)
- [ ] Tenant demo visible en staging dashboard con leads pre-cargados
- [ ] `reviewer@tudominio.com` agregado como Tester en Meta for Developers → Roles
- [ ] Página FB demo conectada y webhook suscrito (estado "Activa" en el dashboard)
- [ ] Al menos 1 post público en la página demo con comentario de prueba visible
- [ ] 2FA activado en la cuenta Meta de demo — contraseña NO cambiar durante review
- [ ] Smoke test en staging pasado: `./scripts/smoke-test.sh https://staging-api.yourdomain.com`
- [ ] Dry run de 3 corridas consecutivas completadas (tabla de tiempos llenada y firmada)
- [ ] Las 3 corridas dentro del rango: comentario → lead < 5 min, sin intervención manual

**App Review submission:**
- [ ] URLs reales configuradas en Meta for Developers (Redirect URI, Webhook URL, App Domains)
- [ ] Privacy Policy publicada en URL accesible públicamente (sin login)
- [ ] Terms of Service publicados en URL accesible públicamente (sin login)
- [ ] Video grabado (2–5 min), lento, subtitulado en inglés, subido a enlace compartible
- [ ] Descripción de cada permiso escrita en el formulario (usar texto de la sección "Permisos solicitados")
- [ ] Credenciales del reviewer incluidas en el formulario de revisión (email + contraseña + URL de login)
- [ ] App en modo Development verificada: flujo completo funciona con las credenciales incluidas

---

## Después de la aprobación

1. En Meta for Developers → Tu App → Configuración → Básica: cambiar a **Live Mode**
2. Verificar que la app en producción recibe eventos de páginas externas (no solo testers)
3. Documentar la fecha de aprobación y los permisos aprobados aquí:

| Permiso | Estado | Fecha aprobación |
|---------|--------|-----------------|
| `pages_show_list` | ⏳ Pendiente | — |
| `pages_read_engagement` | ⏳ Pendiente | — |
| `pages_manage_metadata` | ⏳ Pendiente | — |
| `instagram_basic` | ⏳ Pendiente | — |
| `instagram_manage_comments` | ⏳ Pendiente | — |

---

## Notas adicionales

**Por qué no se solicita `pages_messaging`:**  
La versión actual solo lee comentarios y crea leads. El envío de Private Replies vía Messenger está planificado para una fase posterior y se solicitará en una revisión separada, con justificación y demo propios.

**Sobre el modo Development durante staging:**  
En Development Mode, Meta solo entrega eventos de páginas administradas por cuentas con rol en la app (Developer o Tester). Esto es suficiente para validar el flujo técnico completo durante los Días 1–3 de la Operational Launch, antes de que llegue la aprobación de App Review.
