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

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "TeammateDataError";
    this.status = status;
    this.code = code;
  }
}
