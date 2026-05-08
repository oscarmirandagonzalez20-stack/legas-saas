export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM';
export type SocialAccountStatus = 'ACTIVE' | 'REVOKED' | 'ERROR';

export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'WHATSAPP_INITIATED'
  | 'CONSULTATION_SCHEDULED'
  | 'CONSULTATION_PAID'
  | 'CLIENT'
  | 'LOST';

export type ConversationStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  externalId: string;
  displayName: string;
  status: SocialAccountStatus;
  webhookSubscribedAt: string | null;
  webhookSubscriptionError: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  externalUserId: string;
  displayName: string | null;
  areaLegal: string | null;
  stage: LeadStage;
  stageChangedAt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResponse {
  data: Lead[];
  total: number;
  page: number;
  pages: number;
}

export interface Conversation {
  id: string;
  leadId: string;
  socialAccountId: string;
  status: ConversationStatus;
  in24hWindow: boolean;
  humanOwned: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    displayName: string | null;
    areaLegal: string | null;
    stage: LeadStage;
  };
}

export interface Message {
  id: string;
  direction: MessageDirection;
  sender: string;
  body: string;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface QueueStats {
  queueName: string;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
}

export interface FailedJob {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  finishedOn: number | null;
  correlationId: string | null;
  eventType: string | null;
}

export interface ApiErrorBody {
  message: string;
  errorCode?: string;
  statusCode: number;
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
