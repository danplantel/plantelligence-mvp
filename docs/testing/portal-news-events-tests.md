# Portal News & Events Testing

This document is the test inventory for [`app/(portal)/[id]/news-events/page.tsx`](<../../app/(portal)/[id]/news-events/page.tsx:10>) and the three surfaces it composes: the header, the published news-post list and the webinars section.

The page is a composition layer. It reads the portal's plan context, chooses brand colors and the plan id, resolves the header background, and mounts the header, published news posts and webinars. The child suites cover the rendering those sections own.

## Summary

- **Unit tests:** 157 passing across 15 files.
  - page composition: 12
  - page + real header integration: 8
  - page error paths: 5
  - `NewsPostList`: 19 + 13 edge cases
  - `NewsEventsHeader`: 5 + 3 edge cases
  - `WebinarsDashboard`: 3 + 3 parity checks
  - webinar helpers: 23
  - `UpcomingWebinarCard`: 15
  - `WebinarReplayCard`: 19
  - `WebinarsSection`: 13
  - `useMarketingAssets` / `useNewsPostAssets`: 7
  - `shouldShowPopUpOnPage`: 9
- **E2E:** 4, env-gated on `E2E_BASE_URL` + `E2E_PORTAL_SLUG` ([`e2e/portal-news-events.spec.ts`](../../e2e/portal-news-events.spec.ts:1)).
- **Runner:** `pnpm test:portal-news` / `:watch` / `:coverage` — [`vitest.portal-news.config.mts`](../../vitest.portal-news.config.mts:1) driven by [`scripts/tests/run-portal-news-tests.mjs`](../../scripts/tests/run-portal-news-tests.mjs:1).
- Seven defects were found and fixed while writing the suites (see [Fixed while writing these suites](#fixed-while-writing-these-suites)).

## Running these tests

```bash
pnpm test:portal-news            # all 157 unit tests in the scoped config
pnpm test:portal-news:watch
pnpm test:portal-news:coverage
E2E_BASE_URL=… E2E_PORTAL_SLUG=… pnpm exec playwright test e2e/portal-news-events.spec.ts
```

Individual suites, if you need to narrow it down:

```bash
pnpm exec vitest run "app/(portal)/[id]/news-events/__tests__"
pnpm exec vitest run "components/pages/client-portal/sections/__tests__/news-post-list.test.tsx"
pnpm exec vitest run "components/pages/client-portal/sections/__tests__/webinar-helpers.test.ts"
pnpm exec vitest run "components/pages/client-portal/sections/__tests__/webinars-section.test.tsx"
pnpm exec vitest run "hooks/__tests__/shouldShowPopUpOnPage.test.ts"
```

Everything in the project:

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

## Test inventory

| #   | Suite                                                                                  | Tests | Focus                                                                                      |
| --- | -------------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------ |
| 1   | `app/(portal)/[id]/news-events/__tests__/page.test.tsx`                                |    12 | Composition, brand forwarding, header background input/output, white surface               |
| 2   | `app/(portal)/[id]/news-events/__tests__/integration.test.tsx`                         |     8 | Real header default/resolved background, absolute/data URLs, color fallbacks, one `h1`     |
| 3   | `app/(portal)/[id]/news-events/__tests__/page-error-paths.test.tsx`                    |     5 | Non-string banner, missing/empty id, portal defaults                                       |
| 4   | `components/pages/client-portal/sections/__tests__/news-post-list.test.tsx`            |    19 | Loading/empty/sort, headline, category, dates, background map, CTA, brand color, client id |
| 5   | `components/pages/client-portal/sections/__tests__/news-post-list-edge.test.tsx`       |    13 | Publish window, invalid dates, CTA schemes, unsafe schemes, dead `secondaryColor`          |
| 6   | `components/pages/client-portal/sections/__tests__/news-events-header.test.tsx`        |     5 | Default/custom title and background, empty background, plain `<img>`, overlay              |
| 7   | `components/pages/client-portal/sections/__tests__/news-events-header-edge.test.tsx`   |     3 | Whitespace background, overlay without image, single `h1`                                  |
| 8   | `components/pages/client-portal/sections/__tests__/webinars-dashboard.test.tsx`        |     3 | Only `WebinarsSection`, prop forwarding, `enableEditing` not forwarded                     |
| 9   | `components/pages/client-portal/sections/__tests__/webinars-dashboard-parity.test.tsx` |     3 | No documents/support contacts, exact prop set                                              |
| 10  | `components/pages/client-portal/sections/__tests__/webinar-helpers.test.ts`            |    23 | Time/date formatting, URL coercion, embeds, meeting mapping, language guessing             |
| 11  | `components/pages/client-portal/sections/__tests__/upcoming-webinar-card.test.tsx`     |    15 | Title/format, detail rows, register/replay/disabled CTA matrix, accent colour              |
| 12  | `components/pages/client-portal/sections/__tests__/webinar-replay-card.test.tsx`       |    19 | Media precedence, modal lifecycle, lazy file fetch, teaser suspension                      |
| 13  | `components/pages/client-portal/sections/__tests__/webinars-section.test.tsx`          |    13 | Both reads, transforms, empty states, no-client path, `onLoadComplete`                     |
| 14  | `hooks/__tests__/useMarketingAssets.test.ts`                                           |     7 | No-client key, public feed URL, options, payload shape, error/loading, type filters        |
| 15  | `hooks/__tests__/shouldShowPopUpOnPage.test.ts`                                        |     9 | `all` / home / benefits / news-events / my-benefits-team targeting, substring matching     |

## Page composition

### `page.test.tsx`

- renders the header, news posts and webinars
- does not render the commented-out resources section
- forwards `clientId`, `brandColor` and `secondaryColor` to both lists
- falls back to `#1F3A60` / `#6B7280` without client data
- fills each missing color independently
- passes the stored `secondaryBannerImg` to `useBrandingImageUrl`
- trims surrounding whitespace
- passes `null` for empty and whitespace-only banners
- hands the resolved URL to the header
- passes `undefined` when no URL resolves
- renders on the white portal surface inside `<main>`

### `integration.test.tsx` (real header)

- default `/news-events-default-bg.webp` when no URL resolves
- resolved header background
- absolute banner URL passed through
- data URL passed through
- portal default colors when `clientData` is undefined
- only the missing brand color falls back
- only the missing secondary color falls back
- exactly one `h1`

## `NewsPostList`

### `news-post-list.test.tsx`

- loading: pulse skeleton, no section heading
- empty: renders `null`
- sorts by `createdAt` descending
- empty headline falls back to **Announcement**
- category badge + `flyerSubtitle`
- body copy
- created date as `MMM d, yyyy`
- start–end date range
- start-only window omits the separator
- `bg_01`–`bg_04` map to their public paths
- an unknown `bgImage` shows the brand gradient and no image
- CTA with a bare URL normalizes to `https://`
- CTA with an explicit `https://` is preserved
- CTA text without a URL is a non-link
- no CTA text renders no CTA
- brand color on the section heading
- `data: null` falls back without crashing
- client id passed to the hook
- no client id passed as `undefined`

## `NewsEventsHeader`

### `news-events-header.test.tsx`

- default title, background and alt
- custom title, background and alt
- empty background omits the image
- a plain `<img>` keeps an R2 proxy URL as-is
- the dark overlay stays behind the heading

## `WebinarsDashboard`

### `webinars-dashboard.test.tsx`

- renders only `WebinarsSection`
- forwards `brandColor`, `secondaryColor` and `clientId`
- does not forward `enableEditing`

## `useMarketingAssets`

### `useMarketingAssets.test.ts`

- no client id → `null` SWR key and an empty list
- public news-post feed URL and 30s dedupe/no-focus-revalidate options
- returns the payload's `data` array
- `data: null` → empty array
- error and loading flags pass through
- pop-up type filter
- portal-notice type filter

## Webinar helpers and cards

### `webinar-helpers.test.ts`

- `formatTime12h`: 24h → 12h with AM/PM, midnight, empty, unparseable passthrough
- `coerceToHttpUrl`: bare host and host/path gain `https://`, existing `http(s)` kept, whitespace/space-bearing/scheme values refused
- `firstRegisterableUrl`: first usable candidate, skips empty and invalid, `undefined` when none
- `hubDateKey`: date-only kept, timestamp truncated to the date
- `getEmbedUrl`: YouTube watch/short → embed, Vimeo → player, otherwise `null`
- `mapHubMeetingToWebinar`: drops rows missing a title/date/time; maps date, 12h time with timezone, description, duration, language; a URL-shaped location becomes the join link while a plain address stays the location; registration falls back to the meeting link; non-string id dropped
- `guessLanguageFromWebinar`: `[es]` / `(es)` / `español` markers, Spanish vocabulary, English default, and the English `plan` false positive

### `upcoming-webinar-card.test.tsx`

- the session's own title, and the `format` label defaulting to "Group Sessions"
- advisor description vs the generic "What we'll cover" agenda
- date, start time, duration, `meetingFormat · platform`, language and location rows, and their omission
- register link (registration → join → disabled), replay link, "Replay not available", non-http replay ignored
- accent colour from `secondaryColor`, defaulting to the portal gold

### `webinar-replay-card.test.tsx`

- media precedence: thumbnail → YouTube still → direct `<video>` → play placeholder
- modal: YouTube embed iframe, direct controlled `<video>`, close button, backdrop close, no video → no modal
- on-demand file: `?forPortal=1&clientId=…` fetch, loading state, success payload, `!ok` and thrown errors, missing-client variant, and fetching even when a thumbnail is showing
- title/description box, duration, `Popular`, teaser suspended while the modal is open, teaser preload on mount

## `WebinarsSection`

- both reads and their exact contracts (`?forHub=1` with credentials; `placement=news-events&includeVideoFiles=0`)
- upcoming/past cards from mapped meetings, rows that cannot be rendered dropped
- replay cards, malformed payloads, rejected reads
- no `clientId`: no request at all, and the section must leave its loading state
- loading copy per section, empty states, `onLoadComplete` once after both reads settle
- all three section headings

## Pop-up targeting

`shouldShowPopUpOnPage` decides which pages a Marketing pop-up appears on: `all`, `home`, `benefits` (including extra benefit paths), `news-events`, `my-benefits-team`, plus the documented substring matching and unknown-key behaviour.

## Fixed while writing these suites

1. **`UpcomingWebinarCard` never rendered the meeting title.** Upcoming and Past cards only ever said "Group Sessions" / "Webinar", so a participant could not tell which session they were registering for. The title now renders under the format label.
2. **Post CTA URLs mangled non-http schemes.** `mailto:` and `tel:` became `https://mailto:…`; the list now reuses `normalizePortalCtaUrl` and, because a post is advisor-authored on a public page, only allows `http(s):`, `mailto:`, `tel:` and same-site paths — anything else (notably `javascript:`) renders as the plain label.
3. **The page crashed on a non-string `secondaryBannerImg`.** `(value || "").trim()` threw on a number/object; the value is now read only when it is a string.
4. **A plan with no `clientId` stayed on "Loading…" forever.** Both reads returned before clearing their loading flag, so the empty states (and `onLoadComplete`) never appeared.
5. **`NewsEventsHeader` requested an image for a whitespace `backgroundImage`**; whitespace is now treated as "no background".
6. **The replay modal was not a dialog.** It is now `role="dialog"`/`aria-modal` named by the replay title, and its close button is labelled "Close video".
7. **`WebinarsDashboard` imported `HaveQuestionsSection` and `DocumentsSection` without rendering them**, making the route look like it also showed documents and support contacts. The dead imports are gone.

## Manual checklist

- [ ] `/acme/news-events` renders the News & Events header.
- [ ] Published Marketing news posts appear below the header.
- [ ] Upcoming webinars appear below the posts.
- [ ] A plan with a Page Image Header shows that image behind the header.
- [ ] A plan without one shows the bundled news-events default background.
- [ ] An R2 key (`org/...`) in `secondaryBannerImg` resolves to a usable image URL rather than a relative `/org/...` request.
- [ ] The plan's brand color styles the post and webinar sections.
- [ ] A plan with no brand colors uses the portal defaults.
- [ ] A post with a category badge, subtitle, body and CTA renders all four.
- [ ] A post without a background image uses the brand gradient.
- [ ] A bare CTA URL becomes a working `https://` link.
- [ ] The Resources section stays absent while its JSX is commented out.
- [ ] The page keeps its white surface and bottom padding on mobile and desktop.

## Known gaps

Observations pinned as-is rather than changed:

1. **The publish window is not enforced on the portal.** Posts render regardless of `startDate`/`endDate`; only `status` gates them, and that filter is server-side. An expired post keeps publishing.
2. **Invalid dates print the literal "Invalid Date"** for `createdAt`, `startDate` and `endDate`.
3. **`NewsPostList` accepts `secondaryColor` and never uses it**, and four of the five category badge entries share one class string — the badge map cannot differentiate anything. The page still passes the prop.
4. **`guessLanguageFromWebinar` classifies any title containing "plan" as Spanish**, because "plan" is in the Spanish word list.
5. **The Past empty state is gated on `clientId`** while the Upcoming and Replays empty states are not, so a plan-less render leaves "Past Meetings" blank.
6. **The replay play surface is a click-only `div`.** The modal is now a proper dialog, but the card cannot be opened from the keyboard.
7. **Read failures collapse into empty states** (`console.error` only): a plan whose meetings request fails sees "No upcoming sessions" rather than an error or a retry.
8. **`useBrandingImageUrl` is mocked** in the page suites; R2-key resolution and the `/api/r2/object` proxy have their own coverage.
9. **`framer-motion` is mocked** in the post list, so animation timing and viewport triggers are not asserted.
10. **The E2E is env-gated** (`E2E_BASE_URL` + `E2E_PORTAL_SLUG`) and is not part of `pnpm test`.

## Future coverage

- keyboard activation (role, `tabIndex`, Enter/Space) for the replay card;
- a user-facing retry when either read fails;
- an E2E run in CI with a seeded plan that has one post, one upcoming meeting and one replay.

## Related documentation

- [`docs/testing/testing.md`](testing.md) — the shared runner, conventions and inventory structure.
- [`docs/testing/documents-tests.md`](documents-tests.md) — the portal-facing document lists.
- [`docs/testing/marketing-tests.md`](marketing-tests.md) — the Marketing module that publishes news posts.
- [`docs/testing/webinars-tests.md`](webinars-tests.md) — the webinar data rendered here.
