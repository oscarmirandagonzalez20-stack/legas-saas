# ADR 0004 — Rol de la IA: clasificadora, no asesora

- **Estado:** Aceptado
- **Fecha:** 2026-05-06

## Contexto

La tentación obvia es construir un "ChatGPT legal" que responda comentarios y DMs por sí mismo. Esto:

- Constituye potencialmente **ejercicio no autorizado de la profesión jurídica** en México y la mayoría de jurisdicciones.
- Expone al despacho cliente a responsabilidad civil y disciplinaria por consejos incorrectos firmados con su nombre.
- Es difícil de defender ante el colegio de abogados o un cliente final que reciba mala información.

## Decisión

La IA cumple **tres funciones limitadas** y nunca redacta respuestas finales libres al lead:

1. **Clasificación de intención** (Haiku 4.5): comentario/DM → `{ intent: divorcio|laboral|herencia|otro, lead_score: 0..1, urgencia: baja|media|alta }`.
2. **Sugerencia de plantilla**: dada la intención, propone una plantilla de la biblioteca aprobada por el despacho.
3. **Resumen de conversación** (Sonnet 4.5, on-demand): para que el abogado vea el contexto rápido al abrir un caso.

**Reglas duras:**
- Toda respuesta enviada a un lead viene de una **Template** persistida y aprobada.
- Las plantillas que dan información jurídica llevan campo `hasDisclaimer = true` y el disclaimer se concatena automáticamente.
- El "auto-reply" sólo automatiza el envío de la **plantilla seleccionada** según reglas (`AutomationRule`), no genera prosa nueva.
- En el inbox, la IA puede sugerir una plantilla, pero el envío final es decisión humana o de una regla pre-aprobada.

## Alternativas rechazadas

- **IA generativa libre con disclaimer:** el disclaimer no neutraliza la responsabilidad si el contenido es asesoría sustantiva.
- **Fine-tuning con casos del despacho:** sin acuerdo escrito y sin curaduría, contamina el modelo y agrava el problema.
- **"Modo borrador editable":** suena seguro pero en producción los humanos firman sin leer. Mantener templates fijas.

## Consecuencias

**Positivas:**
- Postura defensible ante el colegio y ante usuarios finales.
- Reduce alucinaciones a casi cero — la IA elige entre N opciones cerradas.
- Costos predecibles (Haiku es barato; volumen alto de clasificaciones).

**Negativas:**
- Menos "wow factor" en demo vs. competidores que prometen IA conversacional.
- Requiere que cada despacho construya/curaduría su biblioteca de plantillas.
- Hay que educar al cliente: "la IA filtra, ustedes responden".

## Referencias

- `CLAUDE.md` sección "Reglas IA"
- `WHAT_NOT_TO_BUILD.md` punto 1
