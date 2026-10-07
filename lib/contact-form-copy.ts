/**
 * Copy and the reachability rule shared by every contact editor:
 *   • the Create Plan contact slide
 *     (components/wizard/new-client-steps/step-3-key-contacts/slides/contact-form-slide.tsx)
 *   • the Edit Client contact dialog (app/(dashboard)/edit-client/[id]/page.tsx)
 *   • the Benefits contact dialog
 *     (components/wizard/benefits-steps/benefit-contact-dialog.tsx)
 *
 * The rule has two halves and they are deliberately different:
 *
 *  1. A contact must carry a phone number or an email *in the system*, whether or
 *     not either is shown on the card. A call-to-action button alone does not
 *     count — the details have to exist so the contact is reachable away from
 *     the card (the portal, exports, notifications). This half is validation.
 *
 *  2. The card must surface at least one way to reach the contact: the email, the
 *     phone, or the call-to-action button. A contact with details but nothing
 *     displayed would be invisible to employees. This half gates Save.
 */

export const CONTACT_METHOD_HELPER_TEXT =
  "Enter a phone number or email for this contact. This is required even if you don't display it.";

export const CONTACT_VISIBILITY_HELPER_TEXT =
  "Choose at least one way employees can reach this contact: email, phone, or a call to action button.";

/** The field key the contact editors use to report rule 2 as a validation error. */
export const CONTACT_VISIBILITY_FIELD = "contactVisibility";

/**
 * True when the card shows at least one way to reach the contact — the email, the
 * phone, or the call-to-action button. Gate "Save Contact" on this.
 */
export function hasReachableMethod(options: {
  displayEmail?: boolean;
  displayPhone?: boolean;
  enableContactButton?: boolean;
}): boolean {
  return Boolean(
    options.displayEmail ||
      options.displayPhone ||
      options.enableContactButton,
  );
}
