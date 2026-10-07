"use client";

import { useEffect } from "react";

import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";

/**
 * Scrolls to (and focuses) the top-most errored required field whenever
 * validation errors appear — mirroring the behavior of the new-client wizard's
 * `step-1-company-basics` component.
 *
 * Why a per-step hook: the onboarding wizard's own `focusFirstInvalidField`
 * only runs when the Next button is clicked and relies on validation order.
 * Running this effect inside each step means the page also scrolls to the
 * correct field when errors are produced by a step's own validation, and it
 * always lands on the FIRST field in document order rather than whichever field
 * the validator happened to flag first.
 *
 * Blur validation ("the user left a field") is deliberately excluded: its error
 * is shown in place, and scrolling/stealing focus back to the field the user
 * just left would fight them. Only the wizard's Next validation re-anchors the
 * viewport — read from `errorFieldsSource` in the onboarding store.
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

  // What produced the current errors — see `errorFieldsSource` in the store.
  const errorFieldsSource = useOnboardingWizardStore((s) => s.errorFieldsSource);

  useEffect(() => {
    if (!errorFieldsKey) return;
    // Blur errors paint in place; never scroll or steal focus for them.
    if (errorFieldsSource === "blur") return;

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
  }, [errorFieldsKey, errorFieldsSource]);
}
