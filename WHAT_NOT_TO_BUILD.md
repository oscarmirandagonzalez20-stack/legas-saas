# WHAT_NOT_TO_BUILD.md — Lo que NO debe construirse (todavía o nunca)

> Este documento es tan importante como el roadmap.
> Las startups no mueren por falta de features; mueren por construir las equivocadas.

---

## ❌ JAMÁS — Anti-features que destruyen el producto

### 1. IA generativa que responde libremente al lead en DM
**Por qué no:** Un LLM dando respuestas tipo "creo que tu caso aplica para amparo, deberías..." configura **asesoría legal no autorizada** bajo el código deontológico mexicano y abre al despacho a demandas. Adicionalmente, hallucinations comprometen la imagen profesional.

**Qué hacer en su lugar:** El LLM **clasifica** el comentario. Las respuestas vienen de **plantillas pre-aprobadas** por el despacho, con sustitución de variables (`{{nombre}}`).

### 2. Scraping, browser automation o uso de APIs no oficiales de Meta
**Por qué no:** Violación directa de los Términos de Servicio de Meta. Detección automatizada → ban permanente de la cuenta del despacho cliente, no solo de tu app. Es un evento de extinción para el SaaS.

**Qué hacer en su lugar:** Solo Graph API oficial. Si una feature parece requerir scraping, no se construye.

### 3. Bypass de App Review
**Por qué no:** Existen muchos artículos en la web sobre "cómo usar permisos sin App Review". Todos terminan en cuentas baneadas a los pocos días o semanas. Meta detecta patrones de uso anómalos.

**Qué hacer en su lugar:** Pasar por App Review. Tarda 2–6 semanas pero es la única ruta.

### 4. Almacenar passwords o tokens en texto plano
**Por qué no:** Obvio. Pero hay que repetirlo porque es la causa #1 de filtraciones en startups.

### 5. Borrar audit logs
**Por qué no:** En México, LFPDPPP exige conservación de evidencia de tratamiento de datos. Borrar logs puede constituir destrucción de evidencia.

### 6. DMs en frío (sin que el usuario haya iniciado interacción)
**Por qué no:** Violación directa de las políticas de Meta y de la LFPDPPP (consentimiento expreso). Detectable y sancionable.

**Qué hacer en su lugar:** Solo respondemos a comentarios (vía Private Reply) o a usuarios que iniciaron conversación.

---

## ⏸️ NO TODAVÍA — Features pospuestas

### A. Builder visual de flows tipo ManyChat
**Cuándo sí:** Tal vez Fase 4 (después de tener MRR estable y feedback de >20 despachos).

**Por qué no ahora:** Es 6+ meses de trabajo. No es nuestro diferenciador (ManyChat ya lo hace). Nuestro diferenciador es **especialización legal + IA + UX premium**, no un builder genérico.

**Qué hacer en su lugar:** Plantillas editables con variables y reglas simples de matching por keyword/área. Cubre 80% del valor con 5% del esfuerzo.

### B. App móvil nativa (iOS/Android)
**Cuándo sí:** Fase 3+ (después de validar producto con web responsive).

**Por qué no ahora:** Mantener una app móvil es un equipo dedicado. La web responsive cubre el 95% del valor para abogados que usan laptop el 80% del día.

**Qué hacer en su lugar:** Next.js responsive con UX optimizada para móvil en las vistas críticas (inbox, responder lead).

### C. Integración WhatsApp Business API
**Cuándo sí:** Después del MVP, cuando hayamos validado conversión y el dolor real sea volumen en WhatsApp.

**Por qué no ahora:** WhatsApp Business API requiere:
- Verificación de Meta Business (que ya tendremos para FB/IG, ventaja).
- Plantillas pre-aprobadas (proceso largo).
- BSP (Business Solution Provider) o Cloud API directa.
- Costos por conversación.

Todo eso para resolver un problema que hoy se resuelve con un link a WhatsApp en la plantilla.

**Qué hacer en su lugar:** Plantilla del Abog. Óscar incluye su número de WhatsApp. El lead lo escribe directo (con `wa.me/52...?text=...` con mensaje pre-rellenado). Funciona perfecto y mide igual de bien la conversión.

### D. TikTok, YouTube, X
**Cuándo sí:** Fase 2 (TikTok), Fase 3 (YouTube), Fase 4 (X), si el MVP de Meta valida el producto.

**Por qué no ahora:** Cada plataforma tiene limitaciones distintas y workarounds particulares. Construirlas en paralelo dispersa el equipo. Meta es donde está la conversión real para despachos en MX.

### E. Multi-idioma (i18n)
**Cuándo sí:** Cuando entremos a otro mercado LATAM con vocabulario legal distinto (Colombia, Argentina, España).

**Por qué no ahora:** Toda la UI y vocabulario son español MX. Agregar i18n ahora es complejidad innecesaria que no compra clientes.

### F. White-label completo
**Cuándo sí:** Plan Enterprise, cuando un despacho grande lo pague.

**Por qué no ahora:** Personalizar logo + color por tenant es suficiente para el plan Élite. Custom domain por tenant es complejo (DNS, SSL, multi-deployment) y solo paga en Enterprise.

### G. Agente IA conversacional (estilo "habla con tu IA")
**Cuándo sí:** Tal vez nunca. Si sí, solo como herramienta interna del despacho (no cara al lead).

**Por qué no ahora:** Mismo riesgo legal que en el punto 1. Adicionalmente, no es lo que el despacho necesita: necesita capturar leads, no chatear con ellos automáticamente.

### H. Integración con CRMs externos (Salesforce, HubSpot, Pipedrive)
**Cuándo sí:** Plan Enterprise, bajo demanda, vía API REST.

**Por qué no ahora:** Nuestro CRM interno cubre el caso. Construir integraciones desvía esfuerzo del core.

### I. Reportes downloadables PDF
**Cuándo sí:** Fase 2.

**Por qué no ahora:** El dashboard web cubre la necesidad de visibilidad. PDFs son nice-to-have.

### J. Calls voice / video integradas
**Cuándo sí:** Probablemente nunca. Hay 10 productos que hacen esto bien (Zoom, Google Meet, Cal.com).

**Por qué no ahora:** Out of scope. Integramos con Cal.com / Calendly cuando sea relevante.

---

## 🟡 ZONA GRIS — Discutir antes de construir

### Sugerencias de IA en el inbox
**Riesgo:** Si la IA sugiere texto, el abogado puede copiar-pegar sin revisar y enviar lo mismo que un LLM diría libremente.

**Decisión propuesta:** Permitido **solo** si la sugerencia es un **subset de plantillas existentes** (no texto libre). Ejemplo: "Sugerencia: usa plantilla 'Familiar - Custodia'" en lugar de "Sugerencia: dile que tiene buen caso para...".

### Detección de "leads premium" automatizada
Usar IA para identificar leads de alto valor (vs leads triviales) y priorizarlos en el inbox.

**Riesgo:** Sesgo algorítmico. Un lead "barato" hoy puede ser un cliente importante mañana.

**Decisión propuesta:** OK como **score** mostrado, pero nunca filtrar leads "bajos" del inbox. El abogado decide.

### Auto-aplicación de etiquetas
La IA sugiere etiquetas (`#urgente`, `#alta-conversión`).

**Decisión propuesta:** OK, siempre que el abogado pueda quitarlas con un click.

### Generación de notas de caso
La IA resume el comentario del lead en una "nota de caso" para ahorrarle tiempo al abogado.

**Decisión propuesta:** OK, marcando claramente que es resumen automático y permitiendo edición. Siempre desde el comentario original (no infiere hechos no presentes).

---

## ✅ EL ÚNICO TEST QUE IMPORTA

Antes de construir cualquier feature, hacer estas 3 preguntas:

1. **¿Resuelve un dolor que el Abog. Óscar Miranda mencionó esta semana?**
   Si no: posponer.

2. **¿Es defensible legalmente bajo LFPDPPP y políticas de Meta?**
   Si no: matar la idea.

3. **¿Construirla nos toma más de 1 sprint (2 semanas)?**
   Si sí: ¿se puede dividir en una versión 80/20 que tome menos? Si no, ¿ya validamos suficiente con clientes que lo pidieron?

Tres "sí" → construir.
Cualquier "no" → escribir ADR explicando por qué se construye igual, o no construir.
