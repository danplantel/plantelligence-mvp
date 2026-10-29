# Marketing Testing

This document is the test inventory for the Marketing surface:

- [`app/(dashboard)/communications/marketing/page.tsx`](../../app/(dashboard)/communications/marketing/page.tsx)
- the eleven [`app/api/marketing`](../../app/api/marketing) route handlers
- the shared [`lib/marketing`](../../lib/marketing) helpers
- [`MarketingAssetModal`](../../components/pages/marketing/marketing-asset-modal.tsx)
- the flyer templates and the flyer image-position editor

## Summary

- **Unit tests:** 232 passing in 10 files
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** [`e2e/marketing.spec.ts`](../../e2e/marketing.spec.ts) — skips unless `E2E_BASE_URL` (or `E2E_START_SERVER=1`) and `E2E_EMAIL` / `E2E_PASSWORD` are set; plan journeys also need `E2E_PLAN_NAME`.

## Running these tests

Marketing-only commands:

```bash
pnpm test:marketing           # all Marketing unit suites (232 tests)
pnpm test:marketing:watch     # Marketing unit tests in watch mode
pnpm test:marketing:coverage  # Marketing unit tests + V8 coverage
```

These are backed by [`config/vitest/vitest.marketing.config.mts`](../../config/vitest/vitest.marketing.config.mts) and [`scripts/tests/run-marketing-tests.mjs`](../../scripts/tests/run-marketing-tests.mjs). The config lists every Marketing suite explicitly so unrelated tests cannot leak into the scoped run.

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e:install     # install Chromium once
pnpm test:e2e             # Playwright E2E
pnpm test:e2e:ui          # Playwright UI mode
```

## End-to-end tests

[`e2e/marketing.spec.ts`](../../e2e/marketing.spec.ts) signs in, opens `/communications/marketing`, and covers:

- the plan picker and Marketing workspace shell;
- opening the flyer creator and backing out without saving;
- walking the portal-notice picker to the Top Banner form;
- restoring the sticky plan (and its picker value) after a reload.

Environment requirements:

- `E2E_BASE_URL` (or `E2E_START_SERVER=1`);
- `E2E_EMAIL` / `E2E_PASSWORD`;
- `E2E_PLAN_NAME` — the company name exactly as the plan picker renders it. Plan-scoped journeys skip without it because the picker selects by name, not by id.

The remaining live journeys worth adding once fixtures exist: create → preview → edit → reload for a flyer, status-change persistence for a top banner, bulk delete, and a PDF download whose filename is derived from the plan.

## Test inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| 1 | `app/(dashboard)/communications/marketing/__tests__/page.test.tsx` | 38 | Plan picker and sticky selection, plan-change loading (including the 8s cap), creation cards, notice/flyer lists, filters, selection and bulk delete, single delete, status updates, flyer metadata and PDF download, modal preview/edit/save wiring, no-client state |
| 2 | `app/api/marketing/__tests__/routes.test.ts` | 79 | Every Marketing route: auth, ACL, validation, whitelists, QR cleanup, file proxying, AI/QR/render fallbacks |
| 3 | `lib/__tests__/marketing-urls-and-modes.test.ts` | 20 | Hub paths/URLs, portal segments, flyer modes, brand snapshot, plan guard |
| 4 | `lib/__tests__/marketing-qr-service.test.ts` | 17 | QR.io creation, image preference, error mapping, local fallback, PNG buffers |
| 5 | `lib/__tests__/marketing-flyer-ai.test.ts` | 7 | Deterministic fallback, OpenAI success/errors, model selection |
| 6 | `lib/__tests__/marketing-render-flyer.test.ts` | 4 | Server-side PDF/PNG rendering, brand colors, QR size, wrapping |
| 7 | `lib/__tests__/marketing-flyer-pdf.test.ts` | 10 | SVG builder, logo/color fallbacks, QR inlining and failure paths |
| 8 | `components/pages/marketing/__tests__/marketing-asset-modal.test.tsx` | 12 | Flyer step jump, portal-notice picker/element, validation, top-banner update, preview-only actions |
| 9 | `components/pages/marketing/__tests__/flyer-templates.test.tsx` | 34 | Shared text/body helpers, thumbnails, router, Topical/Meeting templates, QR and logo paths |
| 10 | `components/pages/marketing/__tests__/flyer-image-position-editor.test.tsx` | 11 | Placeholder/reset, drag math, clamping, pointer lifecycle, aspect-ratio canvas |

## Unit test inventory

### `app/(dashboard)/communications/marketing/__tests__/page.test.tsx`

**Marketing page shell**

- shows the client skeleton while plans load
- renders the picker with the marketing module and non-archived clients
- sets the page title
- restores the sticky marketing plan and publishes its subtitle
- does not select a plan without a stored marketing selection
- shows the plan loading dialog while a new plan loads
- does not reload the same plan

**Marketing creation cards**

- renders both creation options
- opens the flyer modal from Create Flyer
- opens the portal notice modal from Create Notice

**Marketing asset lists**

- splits notices and flyers and shows their counts
- shows skeleton rows while assets load
- shows the empty copy when there are no assets
- filters notices by status
- shows the filtered empty state
- filters notices by type
- renders type labels and flyer metadata
- selects all filtered assets and clears the selection
- bulk-deletes selected assets and refreshes
- keeps the selection when every bulk delete fails
- previews an asset when its row is clicked
- edits a flyer from the template step
- edits a portal notice on the top-banner element
- deletes a single asset after Yes
- cancels a single delete with No
- updates a notice status
- downloads a flyer through the PDF pipeline
- swallows a failed flyer download

**Marketing modal wiring**

- refreshes assets after a modal save
- clears edit state when the modal closes
- switches a preview into edit mode
- closes the plan loading dialog when the asset request errors
- previews a flyer asset without entering edit mode
- disables the picker and hides the workspace when no clients exist
- caps the plan loading dialog at eight seconds

**Marketing asset edge cases**

- reports only the successful portion of a partial bulk delete
- does not report or refresh a rejected single delete
- refreshes assets even when the status update is rejected

### `app/api/marketing/__tests__/routes.test.ts`

Real `NextRequest` objects, mocked `next-auth`, `@/lib/prisma`, `resolvePlanAccess`, `resolvePersistedDocumentCategory`, `@/lib/marketing`, `qr-service`, `@/lib/r2`, and `mongodb` `ObjectId`.

- **`GET /api/marketing`** — stub list, 401.
- **`GET /api/marketing/assets`** — 401, 400 without `clientId`, 404 for a missing plan, 403 for a non-owner, filtered payload, 500.
- **`POST /api/marketing/assets`** — 401, 400 validation, plan-access gate, 201 with defaults, 500.
- **`PATCH /api/marketing/assets/[id]`** — 401, 404, 403 teammate/owner mismatch, no valid fields, field whitelist, 500.
- **`DELETE /api/marketing/assets/[id]`** — 401, 404, 403, QR.io cleanup, skipped cleanup when no id, non-blocking cleanup failure, 500.
- **`GET /api/marketing/assets/public`** — 400, unknown slug, type filtering, `take: 20`, 500.
- **`GET /api/marketing/flyers`** — 401, 400, 404, archived flyers, ISO dates, 500.
- **`PATCH /api/marketing/flyers/[id]`** — 401, 400, 404, 403, empty body, archive/unarchive, 500.
- **`GET /api/marketing/flyers/[id]/file`** — 401, invalid format, 404, PDF, PNG, 503 when R2 is unconfigured, 500.
- **`POST /api/marketing/flyers/generate-copy`** — 401, 400, invalid mode, 404, copy payload, 500.
- **`POST /api/marketing/flyers/render`** — 401, 503, 400, invalid mode, 404, hub URL failure, upload failure, success, 500.
- **`POST /api/marketing/qr/generate`** — 401, 400, QR.io success, local fallback, fallback error, 500.
- **`POST /api/marketing/save-pdf`** — 401, 400, missing payload, 404, R2 upload, base64 output, 500.

### `lib/__tests__/marketing-urls-and-modes.test.ts`

- `getBenefitsHubPath` / `getBenefitsHubPathFromSlug`: plan ids, leading dots, slug sanitization.
- `getBenefitsHubAbsoluteUrl`: absolute URL env precedence, app/NEXTAUTH fallbacks, missing-env throw, dev vs production open-portal URLs.
- `getBenefitPortalSegment`: portal segments and unknown categories.
- `FLYER_MODES`: meeting/topical definitions.
- `buildFlyerBrandSnapshot`: organization/plan colors and logos.
- Plan guard: `resolvePlanAccess` delegation and the `canAccessPlan` alias.

### `lib/__tests__/marketing-qr-service.test.ts`

- QR.io configuration and request shape.
- default/named title handling.
- PNG > SVG > JPG preference.
- HTTP, non-JSON, API `message`, and missing-image errors.
- `generateQrDataUrl`: QR.io success, fallback, local generation.
- `renderQrToPngBuffer`: defaults, overrides, empty URL.
- data-URL prefix.

### `lib/__tests__/marketing-flyer-ai.test.ts`

- deterministic copy when `OPENAI_API_KEY` is absent.
- OpenAI success and trimming.
- configured model.
- blank fields filled from the fallback.
- HTTP error, missing content, and invalid JSON all fall back.

### `lib/__tests__/marketing-render-flyer.test.ts`

- PDF: QR size `280`, brand RGB, `addImage`, arraybuffer output.
- malformed brand color falls back safely.
- PNG: QR size `360`, XML-escaped copy, CTA text, QR data URL.
- long headlines wrap.

### `lib/__tests__/marketing-flyer-pdf.test.ts`

- `buildFlyerSvgFromData`: viewBox, headline, subtitle, image, meeting details, resolved logo, fallback color, missing text.
- `resolveQrImageDataUrl`: data passthrough, remote inlining, qrserver fallback, both-fail original, no-source empty.

### `components/pages/marketing/__tests__/marketing-asset-modal.test.tsx`

- renders nothing when closed.
- starts a flyer at the meeting/topical choice.
- advances a meeting flyer to the benefit category step.
- jumps directly to the template step with `initialFlyerStep`.
- renders preview-only flyers without form actions.
- asks a portal notice to pick an element.
- skips the picker with `initialPortalElement` (the picker slide moves off-screen).
- closes from Cancel.
- reports the first missing flyer field before saving (QR link at step 3).
- validates a top-banner headline.
- updates an existing top banner and PATCHes the expected payload.
- calls `onEditFromPreview` in preview mode.

### `components/pages/marketing/__tests__/flyer-templates.test.tsx`

**Shared helpers** — truncation, color adjustment, template categories, bullet detection, body segmentation, single-line wrapping, plain/bold/color `tspan` rendering, bullet parts, max-line cap.

**`TemplateThumbnail`** — an SVG for each known template, nothing for unknown ids.

**`FlyerPreview` router** — each template id routes to its implementation; unknown ids fall back to `TopicalTemplate1`.

**`TopicalTemplate1`** — uppercase/truncated headline, default body copy, custom hero image, user bullets, inline QR data URL, QR-service fallback, dashed QR placeholder, footer logo preference, Spanish labels, custom disclosure.

**`MeetingTemplate1`** — date/time/location formatting, TBD fallbacks, default vs custom hero image.

### `components/pages/marketing/__tests__/flyer-image-position-editor.test.tsx`

- placeholder and disabled Reset without an image.
- image `objectPosition` and X/Y readout.
- Reset returns `{ x: 50, y: 50 }`.
- drag moves the focal point opposite the drag direction.
- one-decimal rounding.
- clamping to 0–100.
- drags ignored without an image or when disabled.
- pointer-leave stops tracking.
- aspect-ratio canvas height, with an invalid-ratio fallback.

## What is mocked

- **SWR** is keyed by URL in the page and modal suites; each key returns its own fixture and `mutate` spy.
- [`MarketingAssetModal`](../../components/pages/marketing/marketing-asset-modal.tsx) is replaced by a prop-capturing stub on the page suite, while the modal suite exercises the real component with the flyer templates, editor, dialog primitives, and branding hook stubbed.
- `next-auth`, `@/lib/prisma`, plan access, R2, QR.io, OpenAI, `jspdf`, `sharp`, and `qrcode` are mocked in the API/helper suites.
- `fetch`, `sonner`, `URL.createObjectURL`/`revokeObjectURL`, `HTMLAnchorElement.prototype.click`, and pointer-capture methods are stubbed where used.
- FormData handlers assign `request.formData = async () => fd` because undici rejects jsdom `File` objects.
- `NextResponse.redirect` is asserted as **307**, not 302.

## Coverage notes

- Sticky selection uses `getLastPlanId("marketing")` + `resolveStickyPlanId` once clients arrive; the resolved plan becomes the page subtitle.
- The plan-change dialog closes when the asset request settles, on error, and after the 8-second cap; the test suite now covers all three.
- Bulk selection uses `filteredAssets`; selection clears when the asset list or either filter changes.
- Flyer PDF generation resolves the QR image, applies the category disclaimer, renders the SVG, converts it to a data URL, builds the PDF blob, and revokes the object URL after the anchor click.
- The asset modal's picker slide stays mounted and is moved off-screen with `translateX(-100%)`, so tests assert the slide transform rather than element absence.
- Save-button labels derive from `ASSET_META`: a Top Banner reads **Save Portal Notice** / **Update Portal Notice**.
- At flyer step 3 the template defaults prefill headline/subtitle/body/disclaimer, so the first missing field is the QR link.

## Findings from this phase

Authorization inconsistencies across the Marketing routes (kept as characterization tests until the policy is decided):

- `GET /api/marketing/assets` still filters `where.userId` after `resolvePlanAccess`, so teammates see no assets.
- `PATCH` / `DELETE /api/marketing/assets/[id]` require `existing.userId === userId`, refusing teammates.
- `save-pdf`, the flyers list, and the flyer file route use owner-only lookups.
- `GET /api/marketing` is a stub returning `[]`.

Page and UI observations:

- **Flyer rows do not show the headline.** Both flyers are labelled “Flyer”; the headline renders only for non-flyer assets.
- **Bulk delete hides partial failures.** It counts successes and toasts only when at least one succeeded; failures are console-only. The suite now pins the partial-success contract.
- **Status changes ignore the response.** `res.ok` is never checked before `mutateAssets()`, so a rejected update still refetches with no error toast. The suite pins that current behavior; this is a bug to fix.
- **Single delete has no failure toast.** A non-OK response leaves the row in place silently.
- **The asset error state is invisible.** `assetsError` only closes the plan-loading dialog; lists render their empty states.
- **Flyer download logic is duplicated** between the page and the modal, so the two pipelines can drift.
- **Top-banner save labels are generic.** “Save Portal Notice” is used for a Top Banner.
- **Sticky initialization runs once.** `stickyInit` prevents re-resolving after the first client list.
- **Filter counts are independent.** Status and type counts come from all assets, so pill counts can differ from visible rows.

## Hardening backlog

- Decide the teammate policy for the asset `GET`/`PATCH`/`DELETE` routes, then update both the handlers and the API suite.
- Surface partial bulk-delete failures and rejected status changes to the user.
- Show a headline or subtitle on flyer rows.
- Extract the duplicated flyer PDF pipeline into one shared helper.
- Replace the `GET /api/marketing` stub with a real summary or remove it.

See [`testing.md`](testing.md) for shared conventions, plus the onboarding, auth, settings, chrome, dashboard, and documents inventories.
