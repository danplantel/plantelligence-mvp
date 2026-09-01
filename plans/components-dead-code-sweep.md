# Plantelligence `components/` Dead-Code Sweep

**Date:** 2026-09-01
**Related plan:** [`plans/app-cleanup-plan.md`](app-cleanup-plan.md)
**Scope:** Identify dead code inside the root `components/` directory **assuming the app-folder cleanup is applied** (old `app/*` route folders deleted; `/new`, `(auth)`, `/api`, and the root files kept).
**Status:** Analysis complete — nothing deleted.

> ⚠️ This is an analysis document. It is safe to read but **do not delete anything based on it alone** without running a `tsc --noEmit` / `npm run build` check afterward, and confirm the "Complex / refactor" section below.

---

## Method

1. Collected every `@/components/*` import from the **kept** code:
   - `app/new/**` (the whole new app)
   - `app/(auth)/**`
   - `app/api/**` (route handlers, e.g. `api/plans/create-plan`)
   - Root files (`app/layout.tsx`, `app/page.tsx`, `app/not-found.tsx`, `middleware.ts`)
2. Traced each import into its own imports to build the full **kept dependency graph**.
3. Classified every component as:
   - **KEEP** — reachable from the kept graph.
   - **DEAD (after cleanup)** — imported **only** by old app route folders being deleted.
   - **ORPHAN** — no importers anywhere (dead today, independent of cleanup).
   - **COMPLEX** — partially reused by kept code; needs refactoring before removal.
4. Excluded the `.next/` build-artifact directory from all results.

---

## KEEP — used by `/new`, `(auth)`, `/api`, or root files

### Top-level
- `faq-section.tsx` — `/new/view/*` insurance/retirement/wellness pages
- `footer.tsx` — `/new/view` layout + `benefits-steps/step-5` + `new-client-steps/step-5d`
- `icons.tsx` — `pages/view-video/ViewPlanVideo.tsx` (kept via `/new/view/*`)
- `google-auth-button.tsx` — `forms/user-auth-form` + `forms/user-signup-form`

### `animations/`
- `page-fade.tsx` — `/new/view/*` pages

### `forms/`
- `forget-password-form.tsx`, `reset-pass-form.tsx`, `user-auth-form.tsx`, `user-signup-form.tsx`, `verify-code-form.tsx`

### `layout/`
- `new-layout-client.tsx`, `new-sidebar.tsx`, `header.tsx` (all used by `/new/layout.tsx` → `NewLayoutClient`)
- `user-nav.tsx` — rendered by `header.tsx` via relative `./user-nav` (profile avatar, name, title, logout)
- `providers.tsx` — root layout

### `meetings/`
- `plan-meeting-schedule-form.tsx` — `pages/edit-client/plan-meetings-section.tsx` (kept)

### `modals/`
- `invite-code-modal.tsx` — `providers/invite-code-provider.tsx` (root layout)

### `pages/`
- `clients-list-dashboard.tsx` — `/new/clients`
- `client-portal/**` (all sections + `client-portal.tsx`) — `/new/view/[id]/*`
- `dashboard/dashboard.tsx` + `dashboard/dashboard.funcs.ts` — `/new/dashboard`
- `documents/types.ts`, `documents/components/**`, `documents/tabs/**`, `documents/views/**` — `/new/documents` + `/new/edit-client`
- `edit-client/**` — `/new/edit-client/[id]`
- `settings/**` — `/new/settings` + `/new/edit-client` (`disclaimer-update-confirm-dialog`)
- `sign-in/index.tsx` — `(auth)/signin`
- `view-video/ViewPlanVideo.tsx` — `/new/view/[id]/*`
- `my-benefits-team/**` — `/new/view/[id]/my-benefits-team` + `/new/edit-client`
- `marketing/marketing-asset-modal.tsx`, `marketing/flyer-templates.tsx`, `marketing/flyer-image-position-editor.tsx` — `/new/communications/marketing`

### `plan-selector/`
- `sticky-plan-combobox.tsx` — `/new/communications/meetings`

### `providers/`
- `invite-code-provider.tsx`, `theme-provider.tsx` — root layout

### `wizard/`
- `benefits-wizard.tsx` + `benefits-steps/**` — `/new/benefits`
- `video-wizard.tsx` + `video-steps/**` — `/new/video` *(except `template-editor.tsx`, see DEAD)*
- `new-client-wizard.tsx` + `new-client-steps/**` — `/new/new-client` + `/new/edit-client`
- `wizard.tsx` (OnboardingWizard) + `steps/**` — `/new/onboarding`
- `wizard-stepper.tsx` — `new-layout-client` + `video-wizard` + `new-client-wizard`
- `onboarding-wizard-stepper.tsx` — `wizard.tsx`
- `duplicate-plan-name-dialog.tsx` — `new-client-wizard`

### `ui/` — core primitives (all kept)
Everything not listed under DEAD/ORPHAN below. Notably: `button`, `card`, `input`, `label`, `badge`, `select`, `dropdown-menu`, `popover`, `calendar`, `checkbox`, `skeleton`, `accordion`, `dialog`, `alert-dialog`, `alert`, `tabs`, `switch`, `radio-group`, `tooltip`, `scroll-area`, `textarea`, `sheet`, `separator`, `toaster`, `toast`, `sonner`, `use-toast`, `form`, `confirm-dialog`, `confirmation-dialog`, `navigate-away-warning-dialog`, `resume-or-new-plan-dialog`, `address-search`, `branding-image`, `headshot`, `monogram-avatar`, `universal-image-editor-modal`, `simple-image-editor-modal`, `modalGallery`, `color-picker`, `brand-image-upload`, `upload-input`, `drag-drop-upload`, `multi-file-upload`, `zip-file-picker-modal`, `info-block`, `info-dialog`, `form-error`, `loading-button`, `loading-overlay`, `progress`, `multi-select-dropdown`, `primary-service-categories-select`, `keyContactsModal`, `dashboard-nav`, `dashboard-panels`, `marketing-panel`, `meetings-panel`, `meeting-item`, `insights-panel`, `quick-actions`, `reset-onboarding-button`, `document-preview-modal`.

---

## DELETE — dead after the app-folder cleanup (only referenced by old routes)

| Path | Last referenced from (all deleted) |
|---|---|
| `pages/content-library/index.tsx` | `app/(dashboard)/content-library`, `app/content-library-old` |
| `pages/my-profile/index.tsx` | `app/(dashboard)/my-profile`, `app/my-profile-old` |
| `pages/plan-analytics/index.tsx` | `app/(dashboard)/plan-analytics` (+ `[id]`) |
| `pages/plan-list-dashboard/**` | `app/(dashboard)/dashboard` |
| `pages/plan-update-dashboard/index.tsx` | `app/edit-plan/[id]` |
| `pages/advisor-messages/index.tsx` | `app/advisor-messages` |
| `pages/plan-specs/**` | `app/plan-specs/[id]` |
| `pages/documents/index.tsx` + `pages/documents/legacy/**` | `app/(dashboard)/documents`, `app/documents-old` |
| `pages/create-dashboard-old/**` | `pages/plan-update-dashboard` (old) |
| `pages/view-video/Header.tsx` | `app/view-video/[id]`, `app/view/[id]`, `app/plan-specs/[id]` layouts |
| `layout/sidebar.tsx` | every old app `layout.tsx` |
| `guards/onboarding-guard.tsx` | every old app `layout.tsx` |
| `breadcrumb.tsx` | `app/profile`, `app/content-library-old`, `app/advisor-messages`, `app/edit-plan`, `app/documents-old`, `app/my-profile-old` |
| `date-range-picker.tsx` | `pages/plan-analytics/index.tsx` (dead) |
| `file-upload.tsx` | `pages/documents/legacy/PlanDocuments.tsx` (dead) |
| `forms/user-profile-stepper/create-profile.tsx` (whole dir) | `app/profile` |
| `ui/picker-color.tsx` | `pages/advisor-messages`, `pages/create-dashboard-old/steps/Branding` |
| `ui/progress-variants.tsx` | `pages/create-dashboard-old/index` |

---

## DELETE — orphaned today (no importers at all; independent of the app cleanup)

### Top-level
- `alert-banner.tsx`, `top-bar.tsx`, `document-accordion.tsx`, `mobile-navigation.tsx` (only exported by the unused `index.ts` barrel)
- `interactive-tools.tsx`, `video-carousel.tsx`, `video-modal.tsx`
- `index.ts` (barrel — exports only the orphans above)

### `layout/`
- `mobile-sidebar.tsx`, `document-expiration-notifications.tsx`, `ThemeToggle/**`

### `guards/`
- `onboarding-page-guard.tsx` (and `index.ts` — see DEAD section for `onboarding-guard.tsx`)

### `modal/` (singular — distinct from `modals/`)
- `alert-modal.tsx`, `invite-modal.tsx`

### `pages/`
- `documents-list-dashboard.tsx`
- `sign-up/index.tsx` (signup uses `forms/user-signup-form`, not this)
- `view-video/index.tsx`, `view-video/SynthesiaVideo.tsx` (both import the dead `../content-library`)
- `marketing/flyer-generator/**`, `marketing/meeting-flyer/**`, `marketing/pdf-builder/**`, `marketing/pdf-manager/**`, `marketing/missing-retirement/**`, `marketing/saved-pdfs-section.tsx`, `marketing/shared/types.ts`

### `wizard/`
- `universal-wizard.tsx`, `draft-selection-modal.tsx`, `validated-wizard-step.tsx`, `video-steps/template-editor.tsx`

### `ui/`
- `dashboard-nav-simple.tsx`, `progress-steps.tsx`, `save-preview-modal.tsx`, `universal-image-editor-examples.tsx`, `simple-drag-drop-upload.tsx`, `resources-panel.tsx`

---

## COMPLEX — refactor before deleting: `pages/create-dashboard`

The video wizard (`/new/video`) and one API route **reuse parts** of `pages/create-dashboard`, so it cannot be blanket-deleted:

- **KEEP (reused by kept code):**
  - `Section/EmployerContributionsSection/CompanyMatch.tsx`, `HarborDetails.tsx`, `FixedAmount.tsx`, `ProfitSharing.tsx` — imported by `wizard/video-steps/step-3/step-3a.tsx`
  - `Section/InvestmentsSection/index.tsx` — exports `listAdditionalFeatures`, imported by `wizard/video-steps/step-4/step-4b.tsx`
  - `index.tsx` — **only for its exported types** (`IPlanFormData`, `Errors`, `TouchedFields`, `SectionPreview`, …) imported by `api/plans/create-plan` **and** by `Section/InvestmentsSection/index.tsx` via `../..`
- **DEAD (only used by the old `app/create-new-plan` form):**
  - `branding-preview.tsx`, `logo-resize-preview.tsx`, `section-animation.tsx`, `modal/CustomAvatarModal.tsx`
  - `Section/BrandingSection/**`, `Section/PlanDetailSection/**`, `Section/Resources/**`
  - `Section/EmployerContributionsSection/{index.tsx, EmployerContributionsReview.tsx, EmployerContributionsPreview.tsx}`
  - `Section/InvestmentsSection/{InvestmentsPreview.tsx, InvestmentsReview.tsx}` *(verify — if `Section/InvestmentsSection/index.tsx` imports them, they are transitively KEEP)*

**Recommended approach:** extract the shared types (`IPlanFormData` et al.) into `types/` and move the 5 reused contribution components + `listAdditionalFeatures` into a shared location (e.g. `wizard/video-steps/` or `components/plan-builder/`), then delete the rest of `pages/create-dashboard`. Also note `index.tsx` imports `ProfileData` from the dead `../my-profile`, so `my-profile` cannot be removed until `create-dashboard/index.tsx` is refactored.

---

## Execution checklist (safe order)

1. Apply the app-folder cleanup from [`app-cleanup-plan.md`](app-cleanup-plan.md) first.
2. Refactor `pages/create-dashboard` (extract shared types/components).
3. Delete all **DEAD** items (safe after step 1).
4. Delete all **ORPHAN** items (safe at any time; they have no importers).
5. Run `npx tsc --noEmit` and `npm run build` to catch any missed references (e.g. type-only imports, dynamic `import()`, relative paths the sweep may have missed).
6. Consider running a tool like `knip` or `depcheck` for a machine-checked second pass, since this sweep was manual.
