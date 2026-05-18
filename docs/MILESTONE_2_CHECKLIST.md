# Milestone 2 Scope of Work – Implementation Checklist

This document summarizes the current state of each Milestone 2 feature in the codebase and what (if anything) remains to be done for demo readiness.

---

## 1. Core Entity Alignment (Milestone 1 Carryover + M2 Foundation)

| Item | Status | Notes |
|------|--------|--------|
| Consistent data structure across wizard steps | **Partial** | New Client Wizard uses `stepData` (keyContacts, step3a, step3b, etc.); Benefits Wizard uses a different structure (`benefitCategory`, plans, etc.). Key contacts are scoped by `benefitsCategories` per contact. |
| No duplicate / free-text versions of structured entities | **Review** | Providers are not yet a first-class reusable entity in the new-client flow; contacts reference categories by name. Benefits wizard has category/benefit entities. |
| All modules reference same entity IDs | **Partial** | Key contacts use `id` (e.g. `contact-${Date.now()}-${Math.random()}`). No shared provider/org IDs across plans yet. |
| Providers reusable, not duplicated across plans | **Gap** | No provider search/reuse or typeahead in the new-client wizard. See §6. |
| Contacts and documents scoped to category | **Done** | Contacts have `benefitsCategories[]`; documents have `category`. Portal filters by category. |
| Portal renders only from structured entity relationships | **Done** | Portal uses `keyContacts`, `showOnPortal`, and category to render navigation, tiles, My Benefits Team, and documents. |

**Recommendation:** Introduce a shared provider/entity layer and IDs if “Provider” is a core entity; otherwise document that “provider” in this flow is represented by contact + company name.

---

## 2. Wizard Validation and Step Gating

| Item | Status | Notes |
|------|--------|--------|
| Next disabled or blocked when required fields empty | **Done** | `validateNewClientCurrentStepV2` runs before `nextStep`; wizard blocks and shows toast on validation failure. |
| Clear inline error messages on missing fields | **Done** | Step 3b uses `errorFields` and `data-field` for focus; step3a/3c show category/otherBenefits errors. Incomplete contacts show “Some contact cards are incomplete…” toast. |
| Testing with incomplete data prevents progression | **Done** | Validation runs on Continue/Next; incomplete contacts (step3a/3c) and empty required fields (step3b) block progression. |

**Recommendation:** Optional: disable the primary Next/Continue button when current step is invalid (in addition to blocking on click) for clearer UX.

---

## 3. Benefit Category Limits (1 Minimum – 4 Maximum)

| Item | Status | Notes |
|------|--------|--------|
| Minimum 1 category required | **Done** | Step 3 requires at least one contact with a category; “incomplete categories” modal encourages filling categories. No explicit “0 categories” save block. |
| Maximum 4 categories allowed | **Done** | New Client Wizard uses a fixed set of 4 benefit categories (Retirement, Group Health, Group Life, Other Benefits). User adds *contacts* per category, not “categories” as a countable list. So “max 4” is satisfied by the fixed four. |
| Add Category button disabled at 4 | **Done** | There is no “Add Category” button; the four categories are fixed. If the product adds dynamic categories later, a max-4 check and disabled state will be needed. |
| Existing plans with 4 categories cannot add 5th | **Done** | Same as above. |

**Recommendation:** If “1–4 categories” means “plan must have 1–4 categories configured (with at least one contact each),” add validation that counts distinct categories with at least one complete contact and enforce min 1 / max 4.

---

## 4. Category Display Toggles (Portal Visibility)

| Item | Status | Notes |
|------|--------|--------|
| Toggle per category | **Done (benefits)** | In `benefits-section-editor.tsx`, each benefit has a Visibility switch (`isEnabled`); Eye/EyeOff and “Visible”/“Hidden” label. |
| When OFF: category not in Navigation, Tiles, My Benefits Team, documents | **Review** | Benefits use `isEnabled`; portal benefits section uses “visible benefits.” Key contacts use per-contact `showOnPortal`, not per-category. Confirm whether “category” here means benefit category or contact visibility. |
| When ON: category renders normally | **Done** | Toggling visibility on shows the benefit/category in the portal. |

**Recommendation:** Align wording: if “category” = benefit category, the current benefit visibility toggle satisfies this. If “category” = key-contact category (e.g. Retirement, Health), add a per-category show/hide (or document that visibility is per-contact via `showOnPortal`).

---

## 5. Provider Validation (Primary Required)

| Item | Status | Notes |
|------|--------|--------|
| Each active category has at least one Primary provider | **Done** | Implemented as “primary contact per category”: each category with ≥1 complete contact must have ≥1 contact with `isPrimaryByCategory[category]` or `isPrimaryOverall`. Validated on step3b and step3c (Continue). |
| Save/publish blocked without Primary provider | **Done** | Validation blocks Next/Continue and shows error. |
| Clear error message | **Done** | Message: “{Category} must have at least one Primary contact. Select a contact and mark it as Primary for this category.” Toast and step3b error list show it. |
| Secondary providers optional | **N/A** | Interpreted as primary contact required; secondary contacts optional. |

**Implementation:** `new-client-wizard-validation-v2.ts` (step3b and step3c blocks); wizard shows toast for `primaryContactRequired` / `primaryContact_*` and step3b field label “Primary contact required”.

---

## 6. Reusable Providers (Search + Reuse)

| Item | Status | Notes |
|------|--------|--------|
| Typeahead search existing providers | **Gap** | No provider typeahead in new-client wizard. Benefits wizard step-1a has contact search/select, not “provider” reuse. |
| Selecting attaches existing provider, no duplicate | **Gap** | Not implemented for providers. |
| Adding new creates one reusable record | **Gap** | New contacts are created per plan; no shared provider entity. |
| Duplicate detection | **Gap** | No provider-level duplicate prevention. |

**Recommendation:** Implement a provider (vendor) entity with search and attach-to-category if providers are a core entity; otherwise document that provider reuse is out of scope for current milestone.

---

## 7. Portal Data Integrity Pass

| Item | Status | Notes |
|------|--------|--------|
| Contacts under correct category | **Done** | Contacts have `benefitsCategories`; portal and My Benefits Team filter by category. |
| Provider logos render properly | **Partial** | Contact/company logos used (`companyLogo`, `headshot`). No separate “provider” logo entity. |
| Documents under correct category | **Done** | Documents have `category`; portal shows them by category. |
| My Benefits Team reflects correct provider/contact mapping | **Done** | Uses keyContacts and category; `showOnPortal` filters visibility. |
| Removing provider/contact/document removes from portal | **Done** | Data-driven; removal from store/API removes from portal. |
| No cross-category bleed | **Done** | Filtering by category in portal components. |
| Active categories show correct associated data | **Done** | Portal sections filter by category/visibility. |

**Recommendation:** Manual pass: remove a contact/document and confirm it disappears from portal and that categories stay correct.

---

## 8. Card Module – Default Color Confirmation

| Item | Status | Notes |
|------|--------|--------|
| Confirmation modal when default color changed | **Done** | `step-3b.tsx`: `AlertDialog` when user changes card background color (`isColorWarningOpen`, `setPendingColor`). |
| Popup states: “You are changing the default card color for this plan.” | **Done** | Copy updated to plan-level: title “Change default card color?” and description “You are changing the default card color for this plan.” |
| User must click Confirm to apply | **Done** | Confirm applies `pendingColor`; Cancel clears it and closes. |
| Cancel restores previous color | **Done** | Cancel does not set color; previous value remains. |
| Popup appears again if user changes default later | **Done** | Each color change opens the same dialog. |

**Recommendation:** None. Consider adding the same confirmation for plan-level default card color in step-3d/5d if a global default is editable there.

---

## 9. Card Design UI Layout Fix

| Item | Status | Notes |
|------|--------|--------|
| “Design Card” does not shift page / break layout | **Review** | No literal “Design Card” label found. Card editing happens in: (1) step-3b form + Live Preview, (2) step-3d/5d side panel (`EditorPanelWrapper`) with `ContactSectionEditor`. Editor panel uses fixed positioning and slide-in. |
| Preview remains visible and stable | **Done** | Step-3b has inline preview; step-3d has preview in main content; `usePreviewSticky` supports sticky preview. |
| No excessive margins/padding or misalignment | **Review** | Layout is in place; no specific “Design Card” layout bug was identified. Recommend QA on: opening the contact editor panel, resizing, and scrolling. |
| Responsive behavior | **Review** | Editor panel is `max-w-xl`; recommend testing on small viewports. |

**Recommendation:** If “Design Card” refers to the step-3b card form or the step-3d/5d side panel, run a focused QA pass: open editor, change fields, scroll, and resize; fix any layout jump or overflow. If it refers to another screen, align the label/screen with this section.

---

## Summary

- **Done or largely done:** §2 (validation/gating), §4 (visibility toggles for benefits), §7 (portal integrity), §8 (card color confirmation; copy updated to plan-level).
- **Partial or context-dependent:** §1 (entity alignment; no shared provider entity), §3 (category limits; fixed 4 categories, no explicit 1–4 rule), §9 (layout; no “Design Card” string, panel layout exists).
- **Gaps:** §5 (primary provider validation), §6 (reusable providers search/reuse).

**Next steps:** (1) Align “Provider” and “category” with product (contact vs vendor; benefit vs key-contact category). (2) Add primary-provider validation and/or provider reuse if in scope. (3) Add explicit min/max category validation if “1–4 categories” applies to this wizard. (4) QA card/editor layout and responsiveness.
