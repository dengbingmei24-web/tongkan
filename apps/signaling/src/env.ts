export interface Env {
  ROOMS: DurableObjectNamespace;
  ROOM_CREATION_RATE_LIMITER: DurableObjectNamespace;
  ACCOUNT_HISTORY?: Fetcher;
  HISTORY_GRANT_SECRET?: string;
  HISTORY_INGEST_SECRET?: string;
  ALLOWED_WEB_ORIGINS?: string;
}
