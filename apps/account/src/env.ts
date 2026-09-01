export interface Env {
  DB: D1Database;
  AUTH_TEST_MODE?: string;
  ALLOWED_WEB_ORIGINS?: string;
  EMAIL_HMAC_SECRET: string;
  AUTH_SECRET: string;
  SESSION_SECRET: string;
  HISTORY_GRANT_SECRET?: string;
  HISTORY_INGEST_SECRET?: string;
  TEST_ACCESS_TOKEN?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USERNAME?: string;
  SMTP_AUTHORIZATION_CODE?: string;
  SMTP_FROM?: string;
  SMTP_FROM_NAME?: string;
  CODE_TTL_SECONDS?: string;
  CODE_RESEND_SECONDS?: string;
  SESSION_TTL_SECONDS?: string;
  PUSH_TOKEN_SECRET?: string;
  PUSH_PROVIDER?: string;
  PUSH_WEBHOOK_URL?: string;
  PUSH_WEBHOOK_AUTH_TOKEN?: string;
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
}
