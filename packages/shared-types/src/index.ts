/**
 * Tipos y schemas compartidos entre apps/web y apps/api.
 *
 * Convención:
 *  - DTOs como zod schemas → exportar el schema y el type derivado.
 *  - Enums alineados con Prisma (no duplicar valores, importar si es posible).
 */

import { z } from "zod";

// ---------- Lead Stage ----------
export const LeadStageSchema = z.enum([
  "NEW",
  "CONTACTED",
  "WHATSAPP_INITIATED",
  "CONSULTATION_SCHEDULED",
  "CONSULTATION_PAID",
  "CLIENT",
  "LOST",
]);
export type LeadStage = z.infer<typeof LeadStageSchema>;

// ---------- Intent (clasificación de IA) ----------
export const IntentSchema = z.enum([
  "divorcio",
  "laboral",
  "herencia",
  "mercantil",
  "penal",
  "inmobiliario",
  "otro",
]);
export type Intent = z.infer<typeof IntentSchema>;

export const ClassifyResponseSchema = z.object({
  intent: IntentSchema,
  leadScore: z.number().min(0).max(1),
  urgencia: z.enum(["baja", "media", "alta"]),
  suggestedTemplateId: z.string().uuid().optional(),
});
export type ClassifyResponse = z.infer<typeof ClassifyResponseSchema>;

// ---------- Health ----------
export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  timestamp: z.string().datetime(),
  checks: z.record(z.string(), z.enum(["ok", "fail"])),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ---------- Error response (forma estándar de todos los errores de API) ----------
export const ErrorResponseSchema = z.object({
  statusCode: z.number().int().positive(),
  errorCode: z.string(),
  message: z.unknown(),
  requestId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
