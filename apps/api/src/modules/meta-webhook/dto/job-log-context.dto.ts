export interface JobLogContext {
  jobId: string;
  attempt: number;
  tenantId: string;
  platform: string;
  externalId: string;
  correlationId?: string;
}
