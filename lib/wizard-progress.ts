import { validateNewClientCurrentStepV2 } from "@/lib/new-client-wizard-validation-v2";

/**
 * Returns the first wizard step (1–4) that fails validation, or null if steps 1–4 are valid.
 * Step 5 is intentionally excluded so we do not force users onto preview when earlier work is done.
 */
export async function findFirstIncompleteWizardStepNumber(
  stepData: Record<string, unknown>,
): Promise<number | null> {
  for (let step = 1; step <= 4; step++) {
    const result = await validateNewClientCurrentStepV2(step, stepData);
    if (!result.isValid) return step;
  }
  return null;
}
