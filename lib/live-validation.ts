/**
 * Drop a reported validation error the moment its field becomes valid.
 *
 * The wizards compute `errorFields` once, when the user presses Next, and pass that list
 * down to the fields. The list is therefore a snapshot: a field the user has since
 * corrected keeps its red border, and its message, until the next validation run — which
 * makes a form the user has just fixed look broken, and invites them to "fix" a value
 * that is already fine.
 *
 * This filters the snapshot against the live form state. Each step supplies a validator
 * per field — only the step that owns a value knows what "valid" means for it — and a
 * reported field whose validator now passes is no longer reported, so its styling and
 * message clear as the user types rather than on the next submit.
 *
 * A reported field with no validator is left alone: an unknown field is not one we can
 * judge, and silently clearing it would hide a real error.
 */
export function clearResolvedErrors(
  errorFields: string[],
  isFieldValid: Record<string, () => boolean>,
): string[] {
  return errorFields.filter((field) => {
    const valid = isFieldValid[field];
    return valid ? !valid() : true;
  });
}
