# Documents Testing

This document is the test inventory for the Documents surface: the page at [`app/(dashboard)/documents/page.tsx`](../../app/(dashboard)/documents/page.tsx), the nine document API handlers, the shared upload/calendar/table/preview components, and the document date/category helpers.

## Summary

- **Unit tests:** 305 passing in 16 files
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** 3 journeys in [`e2e/documents.spec.ts`](../../e2e/documents.spec.ts), gated by environment variables

## Running these tests

Documents-only commands:

```bash
pnpm test:documents           # all Documents unit suites (16 files, 305 tests)
pnpm test:documents:watch     # Documents unit tests in watch mode
pnpm test:documents:coverage  # Documents unit tests + V8 coverage
```

These are backed by [`config/vitest/vitest.documents.config.mts`](../../config/vitest/vitest.documents.config.mts) and [`scripts/tests/run-documents-tests.mjs`](../../scripts/tests/run-documents-tests.mjs). The config lists every Documents suite explicitly; add new page, API, component, or helper suites there.

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

[`e2e/documents.spec.ts`](../../e2e/documents.spec.ts) contains three journeys:

- `/documents` loads the page heading and the plan picker;
- `/documents?planId=…&tab=upload` opens the Upload surface and its 10-file guidance;
- with a plan selected, the Calendar and Preview view modes render.

Requirements:

- `E2E_BASE_URL` (or `E2E_START_SERVER=1`);
- `E2E_EMAIL` / `E2E_PASSWORD`;
- `E2E_PLAN_ID` (id or slug) for the plan-scoped journeys.

Without those variables the tests skip cleanly.

## Test inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| 1 | `app/(dashboard)/documents/__tests__/page.test.tsx` | 68 | Plan picker/sticky selection, URL and company deep links, brute-force fetches, alerts, list/cards/calendar/preview, filters, upload guard, delete, preview/download/edit, order persistence, page edge cases |
| 2 | `app/api/documents/__tests__/routes.test.ts` | 73 | All nine document API handlers: list/create/patch/delete/view, batch, client-scoped list, expiring, reorder |
| 3 | `components/pages/documents/components/__tests__/compliance-documents-upload.test.tsx` | 18 | Category review, bulk assignment, save-handler registration, manual save contract, failure toasts, preview wiring |
| 4 | `components/pages/documents/components/__tests__/document-edit-modal.test.tsx` | 13 | Prefill, validation, trimming, multiple categories, file replacement/removal, saving and rejection states |
| 5 | `components/pages/documents/components/__tests__/document-preview-modal.test.tsx` | 7 | Loading/error/blob states, download, close/backdrop blob revocation |
| 6 | `components/pages/documents/tabs/__tests__/document-list-tab.test.tsx` | 5 | No-plan/loading/empty states, CTA gating, table prop forwarding |
| 7 | `components/pages/documents/tabs/__tests__/document-preview-tab.test.tsx` | 5 | No-plan/loading/empty, wizard hint, banner, cards prop forwarding |
| 8 | `components/pages/documents/views/__tests__/documents-calendar-view.test.tsx` | 10 | Window filtering, month counts, day drawer, preview, date set/clear, failure/in-flight states |
| 9 | `components/pages/documents/views/__tests__/documents-cards-view.test.tsx` | 10 | Default/custom edit saves, editDocument event, delete/download forwarding, visual-only reorder |
| 10 | `components/pages/documents/views/__tests__/documents-table-view.test.tsx` | 12 | Sort callbacks, language/upload badges, category editing, hidden columns, review badges, action menus |
| 11 | `lib/__tests__/compliance-document-utils.test.ts` | 38 | Type detection, category scoring, descriptions, PDF extraction, language guessing, document conversion |
| 12 | `lib/__tests__/document-category.test.ts` | 14 | Category aliases, type/storage-key inference, unresolved predicate, hub ordering |
| 13 | `lib/__tests__/document-expirations.test.ts` | 8 | Reminder tiers, labels, date formatting, ordering |
| 14 | `lib/__tests__/document-sort.test.ts` | 8 | Custom `sortOrder`, nulls last, newest-first fallback, immutability |
| 15 | `lib/__tests__/notification-date-keys.test.ts` | 9 | Day-key validation, UTC/local conversion, offsets, timezone validation, ordering |
| 16 | `lib/__tests__/portal-document-language.test.ts` | 7 | EN/ES normalization and fallbacks |

## Unit test inventory

The inventory below is generated from the suites' `describe`/`it` titles.
### `app/(dashboard)/documents/__tests__/page.test.tsx`


**Documents page shell**

- shows the plan skeleton until the client list arrives
- renders the plan picker title, module, and only non-archived clients
- does not auto-select a plan without a URL id or a stored selection
- restores the sticky plan selection from localStorage
- selects the URL plan and persists the selection
- falls back to the first plan for an unknown URL id without persisting it
- resolves a company query param case-insensitively
- publishes the page title and the selected plan as the subtitle
- rewrites the URL with the plan id and section
- opens the upload tab from a ?tab=upload deep link
- switches between the Upload and View tabs

**Document loading**

- sends the URL search and type filters with the plan id
- dedupes documents returned by the API
- toasts and clears rows when the list request fails
- shows the loading dialog while switching plans
- does not refetch when the same plan is selected
- honors the default category saved on the device

**Review-date alerts**

- summarizes expired and expiring documents and caps each list at five
- persists the dismissal of the due-for-review alert

**Document views**

- renders rows with category, language, and review date
- sorts by filename ascending and descending
- filters by category
- filters by language and shows the filtered count
- offers an upload CTA when the plan has no documents
- explains when filters hide every document and clears them
- renders the cards view
- forwards the documents and callbacks to the calendar view
- updates and clears the review date from the calendar
- reports a rejected review-date update
- reports a thrown review-date request

**Document preview mode**

- shows the empty state when there is nothing to preview
- renders the portal section with the plan brand colors
- falls back to the default brand colors when the plan has none
- saves a reordered preview and refetches the plan
- reverts a pending preview order
- reports a rejected order save and keeps the pending order
- reports a thrown order save

**Selection and deletion**

- selects every visible document, shows the bulk bar, and clears it
- bulk-deletes every selected document and refetches
- reports a bulk delete where every request fails
- deletes a single document after confirmation
- reports a failed single delete

**Preview, download, and edit**

- opens the preview modal for a document blob
- reports a preview request that fails
- reports a blob that is too small to be a document
- reports a thrown preview request
- downloads a document through an object URL
- reports a failed download request
- opens the edit modal from a row
- patches a document with form data when no file is chosen
- uploads a replacement file to R2 before patching metadata
- falls back to form data when the R2 upload fails
- reports a rejected metadata patch

**Upload tab and leave guard**

- reports unsaved upload changes only while the Upload tab is active
- refuses to save and exit until the upload tab registers a save handler
- runs the registered save handler and clears the dirty flag
- switches to the documents section and shows the transition dialog after an upload
- toasts and refetches when the upload tab reports saved documents

**Documents page edge cases**

- treats ?tab=preview and ?tab=list as the documents section
- sorts by review date in both directions
- infers SPD and SBC types from titles when type is missing
- alerts at exactly 30 days but not at 31
- supports individual selection and select-all
- clears the selection on a partial bulk delete without a failure toast
- reports a thrown download
- keeps the dirty flag when save-and-exit rejects
- rewrites the URL when the plan changes
- does not select a plan when the company param matches nothing

### `app/api/documents/__tests__/routes.test.ts`


**GET /api/documents**

- returns 401 without a session
- scopes a plan-less list to every accessible plan
- authorizes an explicit plan and uses the resolved client id
- returns 403 for a denied plan
- returns 404 when the plan does not exist
- builds search and type filters
- filters archived rows in JS unless includeArchived=1
- maps expiration dates to ISO strings and null
- returns 500 when the query fails

**POST /api/documents**

- returns 401 without a session
- rejects a JSON create missing required fields
- returns 404 when the plan edit guard rejects the caller
- creates an R2 document with normalized defaults
- returns the existing row instead of creating a duplicate storage key
- rejects FormData uploads when R2 is configured
- rejects a legacy FormData upload missing required fields
- creates legacy SPD and SBC rows and replaces the old SPD
- rejects a metadata-only FormData POST because spdFile is required
- returns 500 when creation fails

**PATCH /api/documents/[id]**

- returns 401 without a session
- returns 404 when the document does not exist
- returns 403 when plan edit access is denied
- rejects an invalid expiration date
- rejects an empty title
- applies JSON metadata, archive, QR, and R2 storage updates
- rejects a FormData file replacement when R2 is configured
- accepts a legacy FormData file replacement when R2 is off
- returns 500 when the update fails

**DELETE /api/documents/[id]**

- returns 401 without a session
- returns 404 when the document is missing
- returns 403 when edit access is denied
- deletes an authorized document
- returns 500 when deletion fails

**GET /api/documents/[id]/view**

- returns 401 for an anonymous non-portal request
- rejects temp ids before querying
- returns 404 when the document is missing
- returns 404 when the document has no client relation
- refuses a portal document owned by another advisor
- refuses a session caller without plan view access
- redirects an R2-backed document to a presigned URL
- returns 404 when a legacy document has no file data
- rejects a data URL without a comma
- rejects a data URL that is not base64
- rejects empty base64 data
- rejects a buffer that is too small
- rejects a file without a PDF header
- serves a valid legacy PDF with cache and disposition headers
- allows the development loopback preview without a session
- returns 500 when the document query fails

**POST /api/documents/batch**

- returns 401 without a session
- rejects a missing client or empty items
- returns 404 when the client is not owned by the caller
- collects per-row validation errors
- normalizes rows before creating them in a transaction
- skips storage keys that already exist for the client
- returns 500 when the transaction fails

**GET /api/documents/client/[clientId]**

- returns 401 without a session, portal, or dev loopback
- returns 404 when the plan is not visible to the caller
- orders by category hub order then newest first and hides archived
- resolves a portal advisor and a slug-scoped plan
- includes archived rows when requested
- returns 500 when the query fails

**GET /api/documents/expiring**

- returns 401 without a session
- keeps only the 0/2/7-day tiers, drops archived rows, and sorts
- caps the response at 20 reminders
- falls back to today when the day key is invalid
- returns 500 when the query fails

**POST /api/documents/reorder**

- returns 401 without a session
- rejects an invalid JSON body
- rejects an empty orderedIds array
- updates only documents on plans the caller may edit
- returns an empty success when no id is editable
- returns 500 when the transaction fails

### `components/pages/documents/components/__tests__/compliance-documents-upload.test.tsx`


**ComplianceDocumentsUpload**

- shows the info card and both surfaces
- registers a save handler when a client id is present
- does not register a save handler without a client id
- shows the uncategorized review unless it is hidden
- hides the uncategorized review when hideCategoryReview is set
- disables the secondary action while documents are uncategorized
- enables the secondary action once every document has a category
- applies one category to every uncategorized row
- updates a single uncategorized row
- saves temp R2 documents through the manual handler
- blocks manual save until every document is categorized
- does nothing when the manual save has no documents
- reports an API rejection during save
- reports a thrown save request
- renders the preview cards only when there are documents
- omits the preview when disabled
- passes the compact and PDF-only flags to the upload section
- lets a non-strict reviewer skip the category review

### `components/pages/documents/components/__tests__/document-edit-modal.test.tsx`


**DocumentEditModal**

- renders nothing when closed
- prefills the form from the document
- disables Save when the title is blank
- trims fields and closes after a successful save
- keeps the modal open and re-enables Save when saving rejects
- shows the saving state while the save is in flight
- joins the Multiple category selection
- rejects an unsupported file type
- passes a valid replacement file to onSave
- removes a selected replacement file
- ignores a title over 85 characters
- ignores a description over 200 characters
- closes from Cancel

### `components/pages/documents/components/__tests__/document-preview-modal.test.tsx`


**DocumentPreviewModal**

- renders nothing when closed
- shows the loading state
- shows the error state when there is no blob URL
- renders the blob in an iframe
- downloads the blob through an anchor
- revokes the blob URL and closes from the X button
- revokes the blob URL when the backdrop is clicked

### `components/pages/documents/tabs/__tests__/document-list-tab.test.tsx`


**DocumentListTab**

- asks for a plan when none is selected
- shows a loading state
- offers the upload CTA for an empty plan when a handler exists
- omits the upload CTA when no handler is supplied
- passes every callback and display flag to the table

### `components/pages/documents/tabs/__tests__/document-preview-tab.test.tsx`


**DocumentPreviewTab**

- asks for a plan when none is selected
- shows a loading state
- shows the empty state
- renders the banner and wizard hint
- forwards documents and branding to the cards view

### `components/pages/documents/views/__tests__/documents-calendar-view.test.tsx`


**DocumentsCalendarView**

- shows the empty summary when no document has a review date
- counts documents inside the 15-month window
- excludes dates outside the window
- renders the month grid and a per-month count badge
- opens the day drawer with the document's metadata
- forwards the preview callback
- saves a newly picked review date
- clears the review date
- keeps the editor open when the update fails
- disables the save action while the update is in flight

### `components/pages/documents/views/__tests__/documents-cards-view.test.tsx`


**DocumentsCardsView**

- renders the editable section with defaults
- calls a custom onEdit instead of the info toast
- shows the coming-soon toast when no onEdit is provided
- opens edit mode from the editDocument event
- ignores an editDocument event for an unknown document
- uses a custom onSaveEdit and resets edit mode
- PATCHes form data by default and notifies after a delay
- reports a rejected default save
- reports a thrown default save
- keeps order changes visual only

### `components/pages/documents/views/__tests__/documents-table-view.test.tsx`


**DocumentsTableView**

- fires the sort callbacks from the headers
- shows the language badge and upload date/time
- hides the upload time when requested
- renders a Spanish badge
- lets the category select call onEdit
- renders a static category badge when editing is disabled
- renders an uncategorized badge
- hides the category column when requested
- shows the review date, expired badge, and countdown
- shows a dash when there is no review date
- forwards preview, download, and direct edit/delete actions
- uses the overflow menu for edit and delete

### `lib/__tests__/compliance-document-utils.test.ts`


**detectDocumentType**

- maps %s to %s

**analyzeDocumentCategory**

- recognizes a strong retirement filename
- recognizes a strong health filename
- recognizes a strong life filename
- uses body text when the filename is generic
- returns Other Benefits with low confidence when nothing matches
- keeps confidence conservative when categories are close
- delegates through detectBenefitsCategory

**getDocumentDescription**

- prefers and trims a short description
- uses the default copy for %s

**extractTextFromPDF**

- skips empty, R2, and short non-data values
- posts inline data and normalizes the returned text
- returns empty text when extraction fails
- swallows a thrown request

**guessLanguageFromDocument**

- uses Spanish markers in the filename
- uses English markers in the filename
- uses franc when inline PDF text is long enough
- falls back to Spanish special characters
- defaults to English

**convertToDocumentFormat**

- maps an R2 storage key to the signed-url display path
- generates an id when one is missing
- preserves an existing language and derives a suggested category
- only auto-applies a suggested category at high confidence

### `lib/__tests__/document-category.test.ts`


**resolvePersistedDocumentCategory**

- normalizes R2 slugs and common aliases
- normalizes benefit-language aliases
- trims and preserves an unknown explicit category
- infers from the document type when no category is set
- infers from the R2 storage-key segment
- prefers an explicit category over the type inference
- falls back to Other Benefits

**isDocumentCategoryUnresolved**

- is false for any explicit category
- is false when the type or storage key implies a category
- is true when nothing implies a category

**compareDocumentCategoriesHubOrder**

- orders the hub categories
- treats empty and Other as Other Benefits
- sorts unknown categories after the known ones
- alphabetizes ties deterministically

### `lib/__tests__/document-expirations.test.ts`


**document expiration tiers**

- only fires on the day-of, 2-day, and 7-day marks
- returns null for every other offset
- exposes the reminder window and cap
- labels each tier

**formatDocumentExpirationWhen**

- uses the same-day copy
- formats a future date key
- returns an empty string for an invalid key

**compareDocumentExpirations**

- sorts soonest first and is stable for equal offsets

### `lib/__tests__/document-sort.test.ts`


**compareDocumentsByCustomOrder**

- orders explicit sortOrder values ascending
- puts untracked rows last
- falls back to newest upload first for equal sortOrder
- accepts numeric strings for sortOrder
- accepts ISO strings and numbers for uploadedAt
- returns a new array without mutating the input
- returns zero for rows with identical order and upload time
- treats an invalid uploadedAt as the oldest value

### `lib/__tests__/notification-date-keys.test.ts`


**date keys**

- validates yyyy-MM-dd keys
- reduces stored dates to their UTC day
- formats a day key without timezone conversion
- builds UTC instants with day offsets
- counts whole days between keys
- uses the local calendar day for todayDateKey
- formats a day key in an explicit time zone
- validates IANA time zones
- sorts by days then time

### `lib/__tests__/portal-document-language.test.ts`


**normalizePortalDocumentLanguage**

- defaults empty values to EN
- honors a custom fallback
- normalizes Spanish variants
- normalizes English variants
- accepts short two-letter prefixes only
- trims and ignores case
- falls back for an unknown language
## Mocking and test architecture

- **Route suites** mock `next-auth`, Prisma (both default and named `prisma` exports), `resolvePlanAccess`, `listAccessiblePlanIds`, `getAuthorizedClient`, `resolvePortalAdvisorId`, `isLocalDevLoopback`, the R2 helpers, and `resolvePersistedDocumentCategory`. Requests are real `NextRequest` instances; FormData handlers replace `request.formData()` because undici rejects jsdom `File` objects.
- **Page suite** mocks `next/navigation`, `swr`, `sonner`, the page-title and leave-guard hooks, `PlanSearchBar`, `DocumentUploadTab`, `DocumentsCalendarView`, `BenefitDocumentSection`, the preview/edit modals, `ConfirmDialog`, Select/Checkbox, and `@hello-pangea/dnd`, while exercising the real page state machine.
- **Component suites** mock only their child surfaces and browser APIs (`URL.createObjectURL`, anchor clicks, `fetch`, `sonner`), so the component under test keeps its own state and effects.
- **Helper suites** are pure; the compliance utils suite mocks `franc`, `normalizePdfText`, and `fetch`.

Document ids and plan ids use realistic 24-hex Mongo ids, and API mocks use the real routes (`/api/documents?clientId=…`, `/api/documents/:id`, `/api/documents/:id/view`, `/api/documents/reorder`, `/api/documents/batch`, `/api/documents/client/:planId`, `/api/documents/expiring`).

## Coverage notes

- Plan selection follows the sticky contract: URL id wins, then `lastPlanId_documents`, and an unknown URL id falls back to the first non-archived plan without persisting the fallback.
- The page fetches documents directly (not through SWR), so every plan switch clears the previous rows and fetches the new plan; the suite asserts `search`, `type`, and `clientId` in the request.
- Review-date math uses the app's US scheduling-day helpers, so date offsets are generated from `todayScheduleDayKey()` rather than from the host timezone.
- Route suites verify tenant and teammate authorization on every handler, including the view route's portal-advisor path, R2 signed redirect, and legacy PDF validation.
- Preview-order saves post `{ orderedIds }` to `/api/documents/reorder`; the batch and reorder suites cover idempotency and edit-permission filtering.
- Delete flows assert both the request shape and the toast copy; the modal is a presentation mock, so the page's confirmation state is what is exercised.

## Hardening findings

### Fixed

- **Upload save handler was stored as a React updater.** `page.tsx` passed `onSaveFunctionReady={setUploadSaveFn}` directly. `ComplianceDocumentsUpload` calls it with `handleManualSave`, so React invoked the handler as a state updater and stored its return value (a Promise). Save and exit then either called a Promise or found no callable handler. The page now wraps it in [`handleSaveFunctionReady()`](../../app/(dashboard)/documents/page.tsx:125); the suite asserts the registered handler runs and clears the dirty flag.
- **Dead Documents components removed.** `documents-header.tsx`, `documents-filters.tsx`, and `unsaved-changes-dialog.tsx` had no importers. They were deleted instead of being given tests for unreachable UI.

### Remaining findings

- **Legacy metadata-only FormData POST is unreachable.** `POST /api/documents` requires `spdFile` in its guard, while the following branch handles “no new file” and updates titles/descriptions. The suite documents the 400 rejection; either relax the guard or remove the dead branch.
- **Reorder indices compact after permission filtering.** `POST /api/documents/reorder` maps the filtered list, so unowned ids in the middle shift the persisted `sortOrder` values. The suite asserts the current compacted indices.
- **Language sort overrides type order in the page list.** `retirementDocs` re-sorts English before Spanish for the portal preview, and the table renders that array, so the header's type ordering is not the final order when languages differ.
- **One empty-state branch is unreachable.** The “No documents in {language}” branch requires `retirementDocs.length === 0` while `sortedDocuments.length > 0`, but `retirementDocs` maps every sorted document.
- **Search and type filters are URL-only.** `searchTerm` and `typeFilter` have no inputs; they are read from `?search=` and `?type=`. The route's `type` filter also searches `title` instead of the persisted `type` field, so an SBC document whose title does not contain “SBC” can be missed.
- **Teammate access is inconsistent across document routes.** `GET /api/documents`, `PATCH/DELETE /api/documents/[id]`, `[id]/view`, and `reorder` use `resolvePlanAccess`, but `POST /api/documents/batch`, `GET /api/documents/client/[clientId]`, and `GET /api/documents/expiring` use owner-only `client.userId` lookups. Teammates holding `documents` permissions are refused by those three.
- **Dead page state.** `handleRowExpand`, `expandedRow`, `docPreviews`, `loadedCards`, `handleCardLoad`, and `availableLanguages` are not rendered in the table/cards views. Wire them up or remove them.
- **Card drag reorder is not persisted.** The cards view explicitly reorders local state only; the preview view is the persisted reorder surface.
- **Partial bulk delete is silent.** If at least one delete succeeds, the page clears the selection and does not report the failures; only a total failure toasts.
- **Deep-link keys are inconsistent.** The tab buttons and `updateURL` write `section`, while the initial state reads `tab`. A `?section=upload` link does not open the Upload tab; only `?tab=upload` does.
- **Edit refetch is a 500 ms timeout.** `handleSaveEdit` schedules `fetchDocuments()` with `setTimeout(..., 500)` after a successful PATCH; a navigation in that window can drop it.
- **Rejected metadata patches double-toast.** The API error is toasted, then the outer catch toasts the generic message and rethrows. The suite asserts both calls. Decide whether the generic toast should be suppressed for an already-reported error.
- **Not covered here:** the real R2 uploader (`lib/upload-to-r2`, presign/PUT), `DocumentsUploadSection` staging internals, the real calendar day picker (the calendar suite replaces `Calendar` with a one-button picker), `BenefitDocumentSection` internals, and the signed-url proxy. Each deserves its own focused suite.

See [`testing.md`](testing.md) for shared conventions, plus the onboarding, auth, settings, chrome, and dashboard inventories.
