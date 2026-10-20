# Edit Plan (Edit Client) Testing

This document is the test inventory for [`app/(dashboard)/edit-client/[id]/page.tsx`](<../../app/(dashboard)/edit-client/[id]/page.tsx:3189>), the five-tab editor for a saved plan.

It covers the page's orchestration (loading / error / preview branches, header and page title, the tab bar including `?tab=` deep links, the comment surface, the save bar), the components and hook the page delegates to, the helpers that decide what a plan publishes, and the three API routes a save goes through.

## Summary

- **Unit tests:** 197 passing in 9 files
- **E2E:** 5 Playwright journeys, env-gated (the two write journeys need `E2E_ALLOW_EDIT=1`)
- **Runner:** Vitest + React Testing Library + jsdom

| Layer              | What it proves                                                              |
| ------------------ | --------------------------------------------------------------------------- |
| Page               | The branches, header/title, portaled tabs, comment surface, save bar wiring |
| Header band        | Validation badges, Open Portal URL, delete-plan type-to-confirm gate        |
| Save bar           | Whether a plan can be saved at all, and the busy/invalid affordances        |
| `useEditClient`    | API → form mapping, validation, the PUT payload                             |
| Visibility helper  | Which hubs and contacts a plan publishes                                    |
| Slug registry      | Renaming keeps the old URL alive as a reserved alias                        |
| PUT route          | Authorization, optional-field safety, disclaimer precedence, retries        |
| Slugs route        | The Previous URLs list and releasing an alias                               |
| Availability route | The debounced Portal URL check                                              |

## Running these tests

Edit Plan-only commands:

```bash
pnpm test:edit-client           # all Edit Plan suites (197 tests)
pnpm test:edit-client:watch     # watch mode
pnpm test:edit-client:coverage  # suites + V8 coverage
```

These are backed by [`vitest.edit-client.config.mts`](../../vitest.edit-client.config.mts) and [`scripts/tests/run-edit-client-tests.mjs`](../../scripts/tests/run-edit-client-tests.mjs), which list the suites explicitly so the command cannot pick up unrelated tests.

E2E:

```bash
E2E_BASE_URL=https://… E2E_EMAIL=… E2E_PASSWORD=… \
  E2E_EDIT_PLAN_NAME="Acme" pnpm exec playwright test e2e/edit-client.spec.ts

# add E2E_ALLOW_EDIT=1 to include the Save and Portal URL rename journeys
```

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e             # Playwright E2E
```

## Test inventory

| #   | Suite                                                                | Tests | Focus                                                                                         |
| --- | -------------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------- |
| 1   | `app/(dashboard)/edit-client/[id]/__tests__/page.test.tsx`           |    14 | Loading/error/preview branches, header + title, tab bar/deep links, comment surface, save bar |
| 2   | `components/pages/edit-client/__tests__/edit-client-header.test.tsx` |    16 | Badges, status select, Open Portal, delete-plan gate and DELETE flow                          |
| 3   | `components/pages/edit-client/__tests__/save-button.test.tsx`        |     8 | `canSave` matrix, invalid hint, busy label                                                    |
| 4   | `hooks/__tests__/useEditClient.test.tsx`                             |    31 | Load mapping, validation, PUT payload, form helpers                                           |
| 5   | `lib/__tests__/portal-category-visibility.test.ts`                   |    38 | Visibility normalization, hub/contact filtering                                               |
| 6   | `lib/__tests__/slug-registry.test.ts`                                |    32 | Register, rename (alias kept), release, resolve                                               |
| 7   | `app/api/clients/[id]/__tests__/put.test.ts`                         |    28 | Access matrix, optional-field safety, disclaimer precedence, slug rename, retries             |
| 8   | `app/api/clients/[id]/__tests__/slugs.test.ts`                       |    13 | Previous URLs list and alias release                                                          |
| 9   | `app/api/check-portal-url/__tests__/route.test.ts`                   |    17 | Sanitizer, own-client/session exclusion, registry reservation                                 |
| 10  | `e2e/edit-client.spec.ts`                                            |     5 | Shell, deep link, delete gate, Save, Portal URL rename                                        |

## Unit test inventory

**`app/(dashboard)/edit-client/[id]/__tests__/page.test.tsx`** — page orchestration

**Page states**

- while `loading`, renders `EditClientLoading`; its back action pushes `/clients`
- with an `error`, renders `EditClientError` with the message; back pushes `/clients`
- with no `client` and no `error`, shows **Client not found**
- in preview mode, renders `EditClientPreview`; back calls `setShowPreview(false)`; its Save calls `handleSave`
- the header is not rendered while the preview branch is active

**Header, title and tabs**

- passes status, plan name, `hasClient` and `isFormValid` to the header
- delegates a status change and the header's back action
- sets the title to `Edit Plan - <company>` and clears it on the Preview tab
- portals the five tab triggers (Branding, Preview, Key Contacts, Documents, Disclosures) into `#header-tabs-portal`
- switching to Key Contacts renders that tab's content (with the plan's contacts)
- `?tab=documents` opens the Documents tab; an unknown `?tab` leaves Branding selected
- publishes the plan comment surface with `clientId`, `targetType: "plan"`, `persisted: true`

**Save bar**

- Cancel pushes `/clients`
- the Save button receives `clientStatus`, `saving` and `isFormValid`
- a successful save refreshes `/api/clients/:id/slugs` (mount + after save)
- a failed save does not refresh the slug list

**`components/pages/edit-client/__tests__/edit-client-header.test.tsx`**

- renders the plan name and current status; omits the heading without a name
- **Form incomplete** only for `Active && !isFormValid`
- **Ready to activate** for any non-Active plan that validates, never otherwise
- delegates the back button and the status `Select`
- Open Portal opens `https://…/<slug>?comments=on` in a new tab, falling back to the client id
- Open Portal and Delete Plan are disabled until the plan is loaded
- the delete dialog's confirm button is disabled until the phrase matches `delete plan` (trimmed, case-insensitive)
- closing and reopening the dialog re-locks it
- DELETE `/api/clients/:id` → success toast + `router.push("/clients")`
- a failed request, or `{ success: false }`, toasts and does not navigate

**`components/pages/edit-client/__tests__/save-button.test.tsx`**

- Draft plans save even when the form is incomplete
- an invalid Active plan is blocked and shows the amber hint
- the hint becomes a button that jumps to the first missing field when a handler is given, static text otherwise
- a valid Active plan saves and hides the hint
- while saving, the label is **Saving...** and a second click cannot fire
- Archived plans never save, and never show the hint
- the idle label is **Save Changes**

**`hooks/__tests__/useEditClient.test.tsx`**

- **Loading:** maps the flat API shape onto the form (`slug` → `portalUrl`, base64 logo → image object); reads contacts from the `{contacts, displayStyle, mobileDisplayStyle}` envelope, the legacy array, and a JSON string; fills the contact defaults the form needs; normalizes visibility from a JSON string; falls back to the legacy top-level brand-image fields; splits the SPD out of `documents.documentRows`; lets `?status=` override the stored status; normalizes unknown statuses to Active
- **Failures:** `404` → **Client not found** (no retry); `400` → `Failed to load client data (HTTP 400)` (no retry); `success:false` → generic failure; a `500` is retried after the back-off; unmounting aborts the in-flight request
- **Validation:** Draft/Archived bypass both checks; an Active plan requires name, logo, portal URL, hero headline/text, mission headline/body and one contact; the field decorator adds hero ≤ 400 and mission 250–2000 rules the save gate does not enforce; a contact without an organization is reported without failing the gate
- **Saving:** no-ops before the plan loads; refuses an invalid Active plan with a toast and no PUT; PUTs the composed payload (`keyContacts` wrapped with both display styles, visibility normalized to four keys, `status`, hero/mission fields) and toasts success; a rejected request or `success:false` returns false, toasts, and resets `saving`
- **Helpers:** accordion toggling, headshot removal by index, logo/background clearing, SBC removal by index, the empty `optional` branch, and logo upload through `FileReader`

**`lib/__tests__/portal-category-visibility.test.ts`**

- `getCategoryPortalVisibility`: `null`/`undefined`/empty/broken JSON/array → all visible; explicit `false` hides one hub; string and numeric booleans; JSON strings; lower-case, snake_case and no-space aliases; unknown keys dropped; unrecognised values treated as visible
- `benefitCategoryToVisibilityKey`: every benefit label maps to a hub, case/whitespace-insensitively, unknown → Other
- `syncBenefitsWithCategoryVisibility`: re-enables benefits in a restored hub, leaves hidden ones disabled, uses the mirror's `title`, passes through without a map
- `isCategoryVisibleInPortal`, `areAllCategoriesHiddenInPortal`, `isNonHubContactCategory`
- `isContactVisibleInPortal`: every contact shows when all hubs are hidden (a new plan's default), uncategorised and non-hub contacts always show, a hidden sole hub hides the contact, any visible hub keeps a multi-hub contact
- `getContactCategories`: all four field spellings, label normalization, non-hub labels preserved, de-duplication
- `filterContactsByPortalVisibility`: drops hidden hubs, normalizes raw payloads first, keeps everything when all hubs are hidden

**`lib/__tests__/slug-registry.test.ts`**

- `ensureRegistryForClient`: no-op when a current row exists or the plan has no slug; registers `Client.slug`; promotes the plan's own row; never steals another plan's row
- `isSlugTaken`: another plan's row is taken, the caller's is not; legacy `Client.slug` fallback
- `registerClientSlug`: ignores blanks, throws on a foreign owner, demotes the plan's other current rows first, revives the plan's own row
- `renameClientSlug`: ignores blanks and same-slug renames, refuses a foreign owner, demotes old → alias and creates the new current row (never deletes), revives the plan's earlier alias when a URL is restored, backfills a legacy plan first
- `listClientSlugs`: backfills, orders current first, projects the Previous-URL fields
- `releaseClientSlug`: refuses unregistered, current, and foreign slugs; deletes an owned alias
- `resolvePortalSlug`: current → itself; alias → the owner's current slug; falls back to `Client.slug`; legacy `Client.slug`; unknown → `null`

**`app/api/clients/[id]/__tests__/put.test.ts`**

- **Access:** 401; 404 when neither id nor slug resolves; a slug resolves to `Client.id` for the write; `resolvePlanAccess` refusal → 403 with its `code`; `plan_not_found` → 404; a teammate without `create_benefits` or `plan_details_branding` edit → 403 `permission_denied`; a teammate with `plan_details_branding` passes; the access check receives the plan's own id
- **Payload:** `keyContacts` untouched (and not normalized or mirrored) when omitted; normalized and mirrored when sent; a mirror failure still returns 200; visibility written as the four canonical keys and kept when omitted; disclaimer precedence `disclaimersData` → parsed JSON string → plain text → stored; `status: ""` keeps the stored status; `previousName`/`nameUpdatedAt` only on a real rename
- **Portal URL:** renames through the registry, suffixes `-2`/`-3` until free, ignores an unchanged value, leaves the slug untouched when the registry fails
- **Resilience:** a `P2028` is replayed and succeeds; `P2002` fails immediately with `{ error, code }`; the success body carries `message` and the saved plan

**`app/api/clients/[id]/__tests__/slugs.test.ts`**

- GET: 401; 404 when nothing resolves; lists by the resolved `Client.id`; resolves a portal slug first; refuses another advisor's plan; 500 on registry failure
- DELETE: 401; 400 for a missing or blank `slug`; 404 for a foreign plan; 400 when the slug is not a releasable alias; releases the trimmed alias for the resolved id; works through a portal slug; 500 on registry failure

**`app/api/check-portal-url/__tests__/route.test.ts`**

- 401; 400 for a missing, blank, or unusable slug
- checks the sanitized value (lowercase, dashes, trim, 30-char cap)
- free slug → `{ available: true, taken: false, ownedByCurrentUser: false }`
- another plan holding the slug → taken; `ownedByCurrentUser` when the caller owns it
- excludes the plan being edited whether it is passed as an ObjectId or a slug
- flags the caller's own other draft and excludes the newest incomplete session (or uses an explicit `sessionId`)
- a retired alias reserved to another plan is taken; the caller's own alias is free
- skips the draft lookup once a plan owns the slug; 500 on failure

## E2E journeys (`e2e/edit-client.spec.ts`)

1. Open a plan from All Plans and render the editor shell (header name, five tabs, Cancel, Open Portal).
2. `?tab=contacts` selects Key Contacts and deselects Branding.
3. Delete Plan is locked until the phrase is typed; backing out leaves the plan intact.
4. **`E2E_ALLOW_EDIT=1`**: Save Changes returns `PUT 200` and toasts **Client updated successfully**.
5. **`E2E_ALLOW_EDIT=1`**: renaming the Portal URL asks for confirmation, persists, and after a reload the old URL is listed under **Previous URLs**.

## Running the page

```bash
pnpm dev
```

1. Sign in as an advisor who can see at least one plan.
2. Open **All Plans**, then the row's **Edit** action (or `/edit-client/<id>`).
3. Confirm the header shows the plan name and status, and the tab bar is in the fixed header.

Tabs:

- **Branding** — plan type, company info, portal URL, logo, colours, images
- **Preview** — the live portal preview and its editing panel
- **Key Contacts** — contacts by category, collaborators, invite and seat actions
- **Documents** — upload, list and preview of plan documents
- **Disclosures** — footer disclaimer text, mode and footer colour

The endpoints this page calls:

```bash
GET    /api/clients/:id/slugs              # current + previous portal URLs
DELETE /api/clients/:id/slugs?slug=…       # release a previous URL
GET    /api/check-portal-url?slug=…        # debounced availability check
PUT    /api/clients/:id                    # the Save request
GET    /api/clients/:id                    # the plan load
GET    /api/teammates/plan-assignments     # collaborators + owner emails
PATCH  /api/teammates/team/:profileId      # resend an invitation
DELETE /api/teammates/assignments/:id      # remove a collaborator
GET    /api/clients/:id/benefits/...       # Custom benefit title
PATCH  /api/documents/:id                  # document category edits
POST   /api/profile/fetch                  # advisor profile (organization name)
```

## Test data

Prepare these before running the manual checklist or the E2E suite:

- an **Active** plan with a logo, colours, both brand images and at least one contact (use its name as `E2E_EDIT_PLAN_NAME`);
- a **Draft** plan and an **Archived** plan (status changes and validation bypass);
- a plan with a **Custom benefit** named in the benefits wizard;
- a plan whose portal URL was renamed at least once (to exercise Previous URLs);
- an advisor profile with an organization name and a disclaimer;
- a viewer/teammate without team-management rights.

## Manual test checklist

### 1. Shell and permissions

- [ ] The header shows the plan name, status and a working Back to All Plans.
- [ ] Changing the status (Active/Draft/Archived) updates the header state.
- [ ] A viewer without plan access lands on the error state, not a half-rendered editor.
- [ ] A teammate with edit access can open every tab they are scoped to.

### 2. Tabs and deep links

- [ ] The tab bar renders in the fixed header and stays visible while scrolling.
- [ ] `?tab=contacts`, `?tab=documents`, `?tab=disclaimers` and `?tab=preview` open that tab.
- [ ] An unknown `?tab` value falls back to Branding.
- [ ] Switching tabs anchors the Comments rail to the new tab (`sectionKey`).
- [ ] The Preview tab hides the Edit Plan header and page title.

### 3. Branding tab

- [ ] Plan type, company name, website and portal URL persist through Save.
- [ ] Renaming the portal URL asks for confirmation before saving and then records the old URL under Previous URLs.
- [ ] A Previous URL can be restored or released.
- [ ] Logo, brand colours and the four brand images save and re-render.
- [ ] Missing required fields block Save for an Active plan and jump to the first offending field.

### 4. Preview tab

- [ ] The portal preview reflects unsaved company, welcome, contact and colour edits.
- [ ] The inline editing panel opens/closes and Save persists those edits.
- [ ] Preview errors focus the first invalid preview field.

### 5. Key Contacts tab

- [ ] Contacts are grouped by category; adding a contact re-opens that category's accordion.
- [ ] Add/Edit contact enforces the same rules as Create Plan (name, title, reachable method, category).
- [ ] A contact can be marked primary; the primary badge moves with it.
- [ ] Inviting a contact pre-fills the invite dialog; the collaborator list shows the pending invite.
- [ ] The seat control reflects owner / active / invited / deactivated, and “Give Team Seat” opens for team managers only.
- [ ] Deleting a contact asks first.

### 6. Documents tab

- [ ] Uploading documents requires the accuracy confirmation before Save.
- [ ] The list supports sorting, preview, download, category edit and delete.
- [ ] Deleting removes the R2 object and asks first.
- [ ] Preview mirrors the hub's category filters and language toggle.

### 7. Disclosures tab

- [ ] The editor shows the saved plan disclaimer, or the platform default.
- [ ] Switching Default/Custom and editing the text updates the preview.
- [ ] Changing the footer colour persists to the plan's `disclaimers` envelope.
- [ ] Saving an edited disclaimer asks for confirmation first.

### 8. Save bar

- [ ] Cancel returns to All Plans without saving.
- [ ] Save is disabled or explains why for an invalid Active plan.
- [ ] Save shows a busy state, toasts on success, and refreshes the slug list.
- [ ] A failed save keeps the page open and reports the API error.

### 9. Comments

- [ ] The plan-level Comments surface is available on every tab.
- [ ] Section anchors are per tab, so a comment created on Contacts reopens there.

## Known gaps

These are observations from the current implementation, not release blockers unless the product decides otherwise:

1. **The tab sections themselves are still only covered here at the seam.** Branding inputs, the preview editor, contact dialogs, the documents list and the disclosure editor render real markup inside the page; their internals need their own component suites.
2. **Archived plans cannot be saved.** [`SaveButton`](../../components/pages/edit-client/save-button.tsx:24) allows `Draft`, and `Active` only when valid, so `Archived` is always disabled while [`isFormValid()`](../../hooks/useEditClient.ts:721) returns `true` for it. The header can therefore show **Ready to activate** next to a dead Save button. Pinned by tests; decide whether Archived should save.
3. **The save gate and the field decorator disagree.** `validateForm` checks presence only; `getValidationErrors` adds the 400-character banner and 250–2000-character mission rules. A plan can be saveable while its fields are flagged. Pinned by tests.
4. **`handleFileRemove("spd")` targets the legacy `documentData` slot**, which the page no longer reads, so the modern `documentsData` SPD survives. Pinned; the branch is effectively dead like `"optional"`.
5. **Tab state is in memory.** `?tab=` is only read on mount; switching tabs does not update the URL.
6. **E2E write journeys are opt-in** (`E2E_ALLOW_EDIT=1`) because they mutate the fixture plan — the rename journey reserves one more alias per run.
7. **The page is ~5,700 lines.** Helpers such as the login/owner/organization-name matching, the slug-list loader and the profile/org-name seeding are embedded and cannot be unit-tested without extracting them.

## Future coverage

- extract the portal-URL rename guard, the slug-list loader and the profile/org-name seeding into hooks, then unit-test them directly;
- component suites for `EditClientPreview`, `PlanMeetingsSection`, `EditContactDialog` and the documents/disclosures sections;
- E2E: restore and release a Previous URL; change the status and confirm the header badge and Save availability follow.

## Related documentation

- [`docs/testing/new-client-tests.md`](new-client-tests.md) — Create Plan, which shares the wizard-shaped data model and contact rules.
- [`docs/testing/clients-tests.md`](clients-tests.md) — the All Plans table this page is opened from.
- [`docs/testing/settings-test.md`](settings-test.md) — the reference format for a page-level suite.
