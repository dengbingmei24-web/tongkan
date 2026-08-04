export interface Env {
  ROOMS: DurableObjectNamespace;
  ROOM_CREATION_RATE_LIMITER: DurableObjectNamespace;
  ALLOWED_WEB_ORIGINS?: string;
}
