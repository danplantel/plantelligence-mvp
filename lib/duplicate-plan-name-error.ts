export const DUPLICATE_PLAN_NAME_CODE = "DUPLICATE_PLAN_NAME" as const;

export class DuplicatePlanNameError extends Error {
  readonly code = DUPLICATE_PLAN_NAME_CODE;
  readonly existingClientId: string;
  readonly companyName: string;

  constructor(existingClientId: string, companyName: string) {
    super(
      `A plan named "${companyName}" already exists. Choose a different name or confirm overwrite.`,
    );
    this.name = "DuplicatePlanNameError";
    this.existingClientId = existingClientId;
    this.companyName = companyName;
  }
}

export function isDuplicatePlanNameError(e: unknown): e is DuplicatePlanNameError {
  return (
    e instanceof DuplicatePlanNameError ||
    (typeof e === "object" &&
      e !== null &&
      (e as { code?: string }).code === DUPLICATE_PLAN_NAME_CODE)
  );
}
