# Ruslan's Requirements Status (16.02.2026)

## 1. Global sync (Step 1 → Step 3)

**Requirement:** On Step 1 (Branding) the user selects primaryColor. By default, all contact cards on Step 3 must use this color as cardBackgroundColor. If the user changes the brand color on Step 1, it should "project" to Step 3 and update all cards.

**Implementation:** ✅ Done.

- `use-contact-styles.ts`: global keyContacts styles take `cardBackgroundColor` from `keyContacts?.cardBackgroundColor || stepData.companyBasics?.primaryColor`.
- In step-3b when saving a contact: `cardBackgroundColor: individualCardBackgroundColor || backgroundColor`, where `backgroundColor` comes from `styles.cardBackgroundColor` (i.e. from Step 1).
- On the portal and in preview, `contact.cardBackgroundColor || baselineBackgroundColor || brandColor` is used — so if a contact has no custom color, the brand color is used.
- Changing primaryColor on Step 1 updates `companyBasics`; when moving to Step 3, styles sync from the store, so the default card color equals the brand color.

---

## 2. Manual override for a single card (Step 3)

**Requirement:** In the contact editor (step-3b), the Color Picker changes the color only for that card. KeyContact stores the `cardBackgroundColor` field.

**Implementation:** ✅ Done.

- step-3b has a Color Picker (BrandColorsSection); state `individualCardBackgroundColor` is saved on the contact as `cardBackgroundColor`.
- Type `KeyContact` includes `cardBackgroundColor?: string`.

---

## 3. Confirmation modal (card color)

**Requirement:** When the user first picks a color in the picker that differs from the brand color, show a modal: "You are changing the standard card color for this contact. This card will no longer update automatically when you change your global Brand Colors. Continue?"

**Implementation:** ✅ Done (updated).

- The modal is shown **only when** the chosen color differs from the brand color (for both the picker and presets).
- Modal text in English: title "Change standard card color for this contact?", description as above, buttons "Cancel" / "Continue".
- Files: `step-3b.tsx` (AlertDialog), `brand-colors-section.tsx` (defaultBrandColor + applyOrConfirm for picker and presets).

---

## 4. Company name change confirmation (Step 3)

**Requirement:** For the main contact (Company / Plan Sponsor), when changing the company name, intercept the action and show confirmation (name is synced with the global profile).

**Implementation:** ✅ Done.

- `CompanyNameSelector`: `handleNameChangeWithConfirmation` for name changes.
- For Company / Plan Sponsor category (`isHRPeople`), `CompanyBrandingOverrideModal` opens (type "name").
- The modal asks how to apply the change: globally (Step 1 + all cards) or for this card only.

---

## 5. Logo change confirmation (Step 3)

**Requirement:** Replacing or removing the logo for the Plan Sponsor contact is an important change and requires confirmation.

**Implementation:** ✅ Done.

- `CompanyNameSelector`: `handleLogoChangeWithConfirmation` for changing/removing the logo.
- For Plan Sponsor, the same `CompanyBrandingOverrideModal` opens (type "logo").
- Modal text for logo: update/remove logo and choice of scope.

---

## 6. "Apply to all plans" option (in the modal)

**Requirement:** In the confirmation window, a choice: change only for this plan or globally for the entire firm.

**Implementation:** ✅ Done (as global / local for the plan).

- `CompanyBrandingOverrideModal`: two options in a RadioGroup:
  - **Update Plan Name/Logo Globally** — updates Company Basics (Step 1) and affects all cards in the plan.
  - **Override for this card only** — this card only, no sync with global settings.
- On confirm, `onConfirm(syncGlobally: boolean)` is called; in `company-name-selector`, when `syncGlobally`, `onUpdatePlanName` / `onUpdatePlanLogo` are called (update Step 1) and then the contact is updated.

**Note:** Currently "globally" means updating Step 1 and the whole plan. If "all plans" is meant as multiple client/firm plans, that would need a separate API/state for the firm and can be extended later.

---

## Summary

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Global sync Step 1 → Step 3 | ✅ |
| 2 | Manual card color override (Step 3) | ✅ |
| 3 | Card color confirmation modal (text + only when different from brand) | ✅ Updated |
| 4 | Company name change confirmation (Plan Sponsor) | ✅ |
| 5 | Logo change confirmation (Plan Sponsor) | ✅ |
| 6 | "Apply to all plans" option (global / local) | ✅ (global = plan + Step 1) |

Code changes made:
- Card color modal text is in English (per Ruslan’s requirement).
- Confirmation is shown only when the chosen color differs from the brand color (picker and presets).
- `BrandColorsSection` has `defaultBrandColor` and `applyOrConfirm` logic for presets and picker.
