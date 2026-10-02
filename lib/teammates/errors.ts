/**
 * errors — shared error type for the Team & Collaborator data layer.
 *
 * Route handlers can map `status` straight onto a `NextResponse.json(..., { status })`,
 * which keeps the "hard blocks cannot be overridden by direct API call" guarantee
 * (spec T2a Part B item 3) reachable from the API surface.
 */
export class TeammateDataError extends Error {
  readonly status: number;
  /** Stable machine-readable code (e.g. "collaborator_locked_function"). */
  readonly code?: string;
  /**
   * Seconds until the caller may retry, when the refusal is a WAIT rather than a wall.
   *
   * Only the invitation resend cooldown sets it, and it exists so the client can do something
   * useful with "not yet": start the same countdown a successful action starts, instead of
   * leaving the reader to time a toast with a stopwatch and click again into the same refusal.
   */
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status = 400,
    code?: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "TeammateDataError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
