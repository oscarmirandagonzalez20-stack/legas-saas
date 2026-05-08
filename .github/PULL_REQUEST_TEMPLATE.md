<!--
Plantilla obligatoria para PRs. Si tu cambio no se describe aquí, no se mergea.
-->

## Qué cambia
<!-- 3-5 líneas claras. Sin marketing. -->

## Por qué
<!-- Link a issue (Closes #N) o ADR. Si no hay, ¿por qué no? -->

## Cómo se verifica
- [ ] `pnpm typecheck` ✅
- [ ] `pnpm lint` ✅
- [ ] `pnpm test` ✅
- [ ] Probado manualmente: <pasos>

## Checklist específico (marcar lo que aplique)
- [ ] Si tocó schema Prisma → migración generada y RLS validado.
- [ ] Si tocó webhooks → tests de firma + idempotencia.
- [ ] Si tocó tokens/secretos → cifrado validado, no hay logs con plaintext.
- [ ] Si tocó multi-tenant → test de aislamiento A↔B.
- [ ] Si llamó a Graph API → manejo específico de errores 190/200/230/551/10903.
- [ ] Si introduce dep nueva → ADR + justificación.
- [ ] Si afecta UX → screenshot/video adjunto.

## Riesgos
<!-- Si no hay, escribir "ninguno conocido". -->

## Seguimiento
<!-- Lo que NO se hizo aquí pero debe hacerse después. -->
