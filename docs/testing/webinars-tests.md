# Webinars Testing

This document is the test inventory for the Webinars surface:

- [`app/(dashboard)/communications/webinars/page.tsx`](../../app/(dashboard)/communications/webinars/page.tsx)
- the webinar API routes under [`app/api/webinars`](../../app/api/webinars)
- [`lib/webinar-placements.ts`](../../lib/webinar-placements.ts) and [`lib/webinar-video-embed.ts`](../../lib/webinar-video-embed.ts)
- [`hooks/useWebinarHoverPreview.ts`](../../hooks/useWebinarHoverPreview.ts) and [`components/webinars/webinar-hover-preview.tsx`](../../components/webinars/webinar-hover-preview.tsx)

## Summary

- **Unit tests:** 145 passing in 6 files
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** [`e2e/webinars.spec.ts`](../../e2e/webinars.spec.ts) — skips unless `E2E_BASE_URL` (or `E2E_START_SERVER=1`) and `E2E_EMAIL` / `E2E_PASSWORD` are set; plan journeys also need `E2E_PLAN_NAME`.

## Running these tests

Webinars-only commands:

```bash
pnpm test:webinars           # all Webinars unit suites (145 tests)
pnpm test:webinars:watch     # Webinars unit tests in watch mode
pnpm test:webinars:coverage  # Webinars unit tests + V8 coverage
```

These are backed by [`vitest.webinars.config.mts`](../../vitest.webinars.config.mts) and [`scripts/tests/run-webinars-tests.mjs`](../../scripts/tests/run-webinars-tests.mjs). The config lists every Webinars suite explicitly so unrelated tests cannot leak into the scoped run.

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

[`e2e/webinars.spec.ts`](../../e2e/webinars.spec.ts) signs in, opens `/communications/webinars`, and covers:

- the plan picker and Webinars workspace shell;
- opening the upload dialog at its defaults and closing it with Escape;
- toggling the multi-select toolbar (Select → Done, Delete disabled with nothing selected);
- restoring the sticky plan (and its picker value) after a reload.

Environment requirements:

- `E2E_BASE_URL` (or `E2E_START_SERVER=1`);
- `E2E_EMAIL` / `E2E_PASSWORD`;
- `E2E_PLAN_NAME` — the company name exactly as the plan picker renders it.

The live journeys still worth adding: create a URL video → reload → play; upload a video with a thumbnail; edit without a new file and then replace it; bulk delete; and the empty-plan state.

## Test inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| 1 | `app/(dashboard)/communications/webinars/__tests__/page.test.tsx` | 53 | Client load/skeleton/failure, sticky plan and subtitle, list cards/sorting, add/edit dialog, source switching, thumbnails (upload/frame), placements, uploads, create/update/delete, bulk delete, video preview, frame capture and other edges |
| 2 | `app/api/webinars/__tests__/routes.test.ts` | 51 | List filtering/projection/placement/sorting, stored runtime, create validation/access, detail get, partial update semantics, delete, bulk delete |
| 3 | `lib/__tests__/webinar-placements.test.ts` | 7 | Placement constants, normalization, membership, key guard |
| 4 | `lib/__tests__/webinar-video-embed.test.ts` | 13 | YouTube/Vimeo/direct-URL parsing and hover embed parameters |
| 5 | `hooks/__tests__/useWebinarHoverPreview.test.tsx` | 13 | Hover intent, in-hand/cached/lazy payloads, in-flight dedupe, stale requests, suspension, failures, preloading, preload→card hand-off, cleanup |
| 6 | `components/webinars/__tests__/webinar-hover-preview.test.tsx` | 8 | Null/loading states, base64 video looping, YouTube/Vimeo framing, direct video, empty preview |

## Unit test inventory

### `app/(dashboard)/communications/webinars/__tests__/page.test.tsx`

**Webinars page shell** — skeleton, title, active-client filtering + sticky plan, first-visit state, client/webinar failures, rejected payload, hover preload subjects/endpoint factory/suspension.

**Webinars list** — empty state, card labels, invalid-date `—`, date sort + direction, size sort, plan scoping, plan-change reset.

**Upload video form** — defaults/counters, required validation, URL↔upload switching, URL create payload, uploaded create with base64, 10MB rejection, non-image thumbnail rejection, thumbnail removal, placement minimum, benefit/placement payload, rejected create.

**Editing and deleting** — edit without a new file (PUT), stored-video preview on demand, preview failure, delete confirmation, rejected delete.

**Multi-select and bulk delete** — single id payload, select-all/clear-all, counted bulk toast, rejected bulk delete.

**Video preview** — YouTube/Vimeo/MP4 rendering, lazy base64 fetch, lazy failure, no play affordance.

**Webinars page edge cases** — frame capture gating, canvas frame capture, compression/read failures, video replacement on edit, Cancel reset, delete/bulk cancel, plan-change selection reset, size ascending, empty lazy payload, title cap.

### `app/api/webinars/__tests__/routes.test.ts`

- **`GET /api/webinars`** — 401, portal advisor resolution, denied plan → empty, accessible-plan scoping, plan narrowing, `includeVideoFiles=0` projection (including the stored runtime), payload size fallback, placement filtering, newest-first sorting, 500.
- **`POST /api/webinars`** — 401, core-field 400, missing `sourceType` 500 (current), source combinations, unknown client 404, marketing-edit 403, 13MB cap, URL create normalization, upload size sync/default placement, measured runtime stored (blank → null), 500.
- **`GET /api/webinars/[id]`** — 401, an unknown id is a plain 404 by lookup (ids are cuids — no shape check), unknown plan, ownership, placement normalization, stored runtime, 500.
- **`PUT /api/webinars/[id]`** — 401/404, keep/replace/clear the stored video, omitted-`sourceType` wipe (current), partial description/thumbnail/category/placements semantics, runtime replaced or kept when omitted, omitted-field/date preservation, unknown client, 500.
- **`DELETE /api/webinars/[id]`** — 401/404, delete, 500.
- **`POST /api/webinars/bulk-delete`** — 401, empty/non-array, no valid ids, invalid-id filtering + user scoping, count payload, 500.

### `lib/__tests__/webinar-placements.test.ts`

- five placement keys/labels and the default.
- normalize: known keys in order, dedupe, unknown/non-string dropped, non-array/empty fallback.
- membership with malformed input.
- key guard for strings vs unknown/non-strings.

### `lib/__tests__/webinar-video-embed.test.ts`

- 15-second teaser constant.
- YouTube watch/short-link/embed parsing, 11-char capture behavior, Shorts unsupported.
- Vimeo links/channel paths/embeds.
- direct mp4/webm/ogg/mov and unrelated URLs → null.
- hover embeds’ muted/autoplay/end parameters and null cases.

### `hooks/__tests__/useWebinarHoverPreview.test.tsx`

- hovered id published immediately; URL/base64 subjects need no request.
- subjects with nothing to play never arm.
- 250ms intent and leave cancellation.
- lazy fetch, cache reuse, `onFilePayload`, in-flight dedupe, stale-request protection.
- suspension clears/blocks; failures swallowed.
- preload only uploads, deduped/repeat calls free; pending timer cleared on unmount.

### `components/webinars/__tests__/webinar-hover-preview.test.tsx`

- null preview and no-source preview render nothing.
- loading spinner plus custom class.
- base64 video with muted/autoplay/playsinline and loop/restart behavior.
- YouTube/Vimeo hover iframes and direct-file `<video>`.

## What is mocked

- **Page `fetch`** dispatches `/api/clients`, `/api/webinars?includeVideoFiles=0`, `/api/webinars`, `/api/webinars/[id]`, and `/api/webinars/bulk-delete`.
- **API routes** mock `next-auth`, Prisma (default + named), portal advisor resolution, accessible plan ids, and plan access.
- **`@/components/plan-selector/plan-search-bar`**, Dialog, Select, Checkbox, DropdownMenu, Popover/Calendar, ConfirmDialog, and the hover layer are lightweight DOM stand-ins.
- **`@/hooks/useWebinarHoverPreview`** is replaced by a prop-capturing stub on the page suite; the hook suite exercises the real hook.
- **`@/lib/image-compression`** resolves a compressed data URL; canvas/FileReader spies cover failure and frame-capture paths.
- **`URL.createObjectURL`/`revokeObjectURL`**, `next/navigation`, `usePageTitleContext`, and `sonner` are stubbed.

## Coverage notes

- Active plans only; the sticky plan restores from `"communications"` and fills the form's client; changing plans resets the form, edit state, errors, and selection.
- The list filters by `clientName === selectedPlanClientName`, sorts by event date or `videoSize`/URL length, and shows `—` for an invalid date.
- New videos default to `news-events` + `All`; unchecking every placement blocks save.
- Editing keeps the stored upload unless a replacement is chosen; the PUT body sends `videoFile: null` in that case.
- The list requests `includeVideoFiles=0`; playback fetches one row's base64 payload lazily and shows a spinner/error/no-video state.
- Thumbnails can be uploaded (compressed to 640px JPEG) or captured from a video frame through a canvas.
- Bulk delete posts the frozen id list, exits select mode, and refreshes.

## Stored runtime (`Webinar.duration`)

The portal's webinar card prints the runtime in its bottom-right badge. That value is a **column**, not something the browser measures:

- the upload form reads `duration / timescale` off the picked file (a hidden `<video preload="metadata">`) and sends it as `duration` (`m:ss`, or `h:mm:ss` past an hour);
- `POST` stores it, `PUT` replaces it or keeps the stored value when the key is omitted, and `GET` returns it;
- `useHubVideos` / `VideosCardSection` map it onto `WebinarReplay.duration`, so the badge appears with the list read — the list deliberately omits the multi-MB video payload, so a badge that depended on loading the file would never render.

Rows uploaded before the column existed are filled by a script that reads the `moov/mvhd` box out of the stored base64 file:

```bash
pnpm webinars:backfill-durations --dry-run   # report only
pnpm webinars:backfill-durations             # write the runtimes
```

Backed by [`scripts/webinars/backfill-durations.ts`](../../scripts/webinars/backfill-durations.ts). Non-MP4 payloads, fragmented files whose `mvhd` duration is 0, and embed URLs are skipped and reported.

## Findings and hardening backlog

API findings:

- **PUT destroys the stored video on a partial update.** `videoFileUrl`/`videoUrl` are nulled whenever `sourceType` is omitted (`sourceType?.upload` is falsy), so a title-only PUT wipes the video.
- **Fixed: `ObjectId.isValid` rejected every real id.** Ids are cuids on Postgres, so `GET`/`PUT`/`DELETE /api/webinars/[id]` answered 404 for every row, which is what silently broke the hover teaser, the runtime badge and playback of any uploaded video. The guards are gone; the lookup is the gate.
- **POST throws a 500 when `sourceType` is missing** instead of returning the intended 400.
- **PUT/DELETE are owner-only and skip plan permissions.** POST enforces `marketing: edit` and an accessible plan, but PUT/DELETE check only `userId`; PUT’s client lookup is `userId`-scoped rather than accessible-plan-scoped.
- **Signed-in teammates cannot fetch a single webinar.** The list uses `listAccessiblePlanIds`, but `GET /api/webinars/[id]` filters by `userId`, so their lazy playback 404s.
- **Duplicate company names can attach the wrong plan** on POST, which resolves the client by name within the accessible set.
- **A long YouTube `v=` value is truncated to 11 characters** rather than rejected.

Page/UI findings:

- **Hidden list still preloads every video.** With no plan, `filteredWebinars` falls back to all rows while the list is hidden.
- **The empty-plan card never appears when the client list is empty/fails.** `planSelectionSettled` is set only inside an effect that returns early for `clients.length === 0`.
- **Filtering is by client name, not id**, so renaming a plan hides its existing webinars until they are re-saved.
- **Playability and editability disagree.** Cards use `videoUrl`/`videoFileUrl`/`hasVideoFile`; the edit form treats `sourceType.upload` as a stored file.
- **Plan changes leave thumbnail-mode state behind** (`thumbnailMode`, `frameTime`, `videoDuration`).
- **The page duplicates the embed parser** (`getEmbedUrl`) instead of importing `getWebinarEmbedUrl`, so the rules can drift.
- **A `success: false` client response is silently ignored**; only thrown requests toast “Failed to load plans”.
- **Bulk ids are scoped to visible rows, but the single-delete description uses the unfiltered list.**

See [`testing.md`](testing.md) for shared conventions, plus the onboarding, auth, settings, chrome, dashboard, documents, marketing, and meetings inventories.
