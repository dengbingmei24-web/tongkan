export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
    readonly currentRevision?: number,
  ) {
    super(message);
  }
}
