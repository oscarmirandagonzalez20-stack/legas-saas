export class MetaApiError extends Error {
  override readonly name = 'MetaApiError';

  constructor(
    message: string,
    readonly code: number,
    readonly subcode?: number,
    readonly fbtraceId?: string,
  ) {
    super(message);
  }
}

// Known Meta error codes relevant to this application
export const META_ERROR_CODES = {
  TOKEN_INVALID: 190,
  PERMISSION_MISSING: 200,
  OUTSIDE_MESSAGING_WINDOW: 230,
  USER_BLOCKED: 551,
  RATE_LIMIT: 10903,
} as const;

export function isMetaTokenError(err: unknown): err is MetaApiError {
  return err instanceof MetaApiError && err.code === META_ERROR_CODES.TOKEN_INVALID;
}

export function isMetaRateLimitError(err: unknown): err is MetaApiError {
  return err instanceof MetaApiError && err.code === META_ERROR_CODES.RATE_LIMIT;
}
