"use client";

import { useEffect } from "react";

/**
 * Scrolls to (and focuses) the top-most errored required field whenever
 * validation errors appear — mirroring the behavior of the new-client wizard's
 * `step-1-company-basics` component.
 *
 * Why a per-step hook: the onboarding wizard's own `focusFirstInvalidField`
 * only runs when the Next button is clicked and relies on validation order.
 * Running this effect inside each step means the page also scrolls to the
 * correct field when errors are produced by real-time validation
 * (`validateCurrentStepFields`), and it always lands on the FIRST field in
 * document order rather than whichever field the validator happened to flag
 * first.
 *
 * @param errorFields   Field names currently flagged as invalid (store state).
 * @param orderedFields Required field names for the step, in document order.
 *                      The first entry that is also present in `errorFields`
 *                      wins, so the user lands on the highest visible error.
 */
export function useScrollToErrorField(
  errorFields: string[] = [],
  orderedFields: string[] = [],
) {
  // Serialize so a new array instance on every render doesn't re-run the effect.
  const errorFieldsKey = errorFields.join(",");
  const orderedFieldsKey = orderedFields.join(",");

  useEffect(() => {
    if (!errorFieldsKey) return;

    const erroredFields = errorFieldsKey.split(",");
    const order = orderedFieldsKey ? orderedFieldsKey.split(",") : erroredFields;

    // Prefer the top-most errored field in document order. Fall back to the
    // first errored field when it isn't part of this step's ordered list.
    const erroredField =
      order.find((field) => erroredFields.includes(field)) ||
      erroredFields.find((field) => order.includes(field));
    if (!erroredField) return;

    const timer = setTimeout(() => {
      const target = document.querySelector(
        `[data-field="${erroredField}"]`,
      ) as HTMLElement | null;
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });

      // Focus the first text control inside (if any) so the user can correct it
      // immediately. `preventScroll` keeps our scroll position intact.
      const focusable = target.matches("input, textarea")
        ? target
        : (target.querySelector("input, textarea") as HTMLElement | null);
      if (focusable) {
        focusable.focus({ preventScroll: true });
      }
    }, 150);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorFieldsKey]);
}
