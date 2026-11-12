# Portal Benefit Hub Testing

This document is the test specification for the four benefit hub pages a participant reaches from the landing page's cards:

| Hub        | Route                           | Page                                                                                            |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Retirement | `/{plan}/retirement`            | [`retirement/page.tsx`](<../../app/(portal)/[id]/retirement/page.tsx:39>)                       |
| Health     | `/{plan}/health-insurance`      | [`health-insurance/page.tsx`](<../../app/(portal)/[id]/health-insurance/page.tsx:38>)           |
| Life       | `/{plan}/life-insurance`        | [`life-insurance/page.tsx`](<../../app/(portal)/[id]/life-insurance/page.tsx:38>)               |
| Custom     | `/{plan}/{custom-benefit-name}` | [`[custom-benefit-name]/page.tsx`](<../../app/(portal)/[id]/[custom-benefit-name]/page.tsx:49>) |

The first three are the same page with different constants; the fourth adds a URL gate. That shape decides the strategy: **one shared harness, four thin suites, and the real logic tested where it actually lives** — the benefit read, the FAQ fallback, the support-contact resolver and the document pipeline.

## Summary

- **Unit tests:** 413 passing in 25 files (the sections the four pages render, the floating benefits assistant, the portal benefit read, the hub Edit Panel's Disclosure section, and the pages' blue edit affordances)
- **E2E:** none yet
- **Runner:** Vitest + React Testing Library + jsdom

```bash
pnpm test:portal-hubs           # the hub sections + assistant + portal benefit read (413 tests)
pnpm test:portal-hubs:watch
pnpm test:portal-hubs:coverage
```

Backed by [`config/vitest/vitest.portal-hubs.config.mts`](../../config/vitest/vitest.portal-hubs.config.mts) and [`scripts/tests/run-portal-hubs-tests.mjs`](../../scripts/tests/run-portal-hubs-tests.mjs).

## The floating benefits assistant

Every hub renders the same "Ask a question" sheet from
[`portal-chatbot.tsx`](../../components/pages/client-portal/sections/portal-chatbot.tsx:94).
It is deterministic — no model, no streaming, and no network beyond one plan read — and
it answers only from content the plan already shows.

- **Corpus.** [`buildAssistantCorpus()`](../../lib/topics/assistant.ts:199) indexes every
  topic in the shipped library for all five locations, overlays the plan's placements by
  slug, adds org-authored topics the library does not carry, and drops what the advisor
  hid. A topic the plan never placed is still answered, but it carries no deep link and
  says so.
- **Retrieval.** [`searchAssistantTopics()`](../../lib/topics/assistant.ts:532) scores
  title, tags, group, summary, quick answer, steps and location, with a small synonym map
  (`401k` → retirement, `PTO` → time off, `log in` → login) and title-specificity
  weighting. A close call becomes "Did you mean…" chips; below the threshold the
  assistant hands off instead of inventing an answer.
- **Opening state.** The sheet greets the visitor and shows one button per published hub
  (Employee Resources included). Pressing one asks the assistant about that benefit —
  [`respondToHub()`](../../lib/topics/assistant.ts:1250) offers its own topics as chips —
  so the conversation continues in the sheet instead of routing away. A chip answers the
  exact topic it stands for (`respondToTopic`), even when two hubs share a title.
- **Replies.** [`respondToQuestion()`](../../lib/topics/assistant.ts:1142) returns the
  topic's own quick answer, up to three steps, its CTA, its deep link
  (`/{plan}/retirement#401k-loans`) and the hub. Navigation questions resolve to the
  published hubs, sign-in, documents, News & Events or the benefits team; contact
  questions hand off to the advisor's booking link.
- **Links say where they go.** Every navigational control is a white pill with the
  plan's border, captioned with its destination ("Goes to your Retirement page and opens
  this answer", "Opens recordkeeper.example in a new tab"). Following one never closes
  the sheet.
- **One-hour session.** The transcript is kept in `sessionStorage` per plan. Reopening
  the sheet — or reloading the page in the same tab — restores the conversation, and
  exactly an hour after it began the sheet resets to the greeting.
- **Mobile offset.** The install prompt publishes `--portal-install-inset` (`4.5rem`
  while the bar is visible, `0rem` once dismissed or installed). The FAB adds it to its
  mobile bottom offset, so dismissing the prompt drops the pill into the freed space
  instead of leaving a gap above the corner.
- **Fullscreen on phones.** Below `md` the sheet fills the viewport (`inset-0`, no card
  chrome) and pads the header/composer for the safe areas; the floating pill is hidden
  while it is open (the header's X closes it). The page behind it is locked
  (`position: fixed` at the current offset, scrollbar gone) and the transcript uses
  `overscroll-contain`, so a swipe scrolls the chat, never the portal. From `md` up it
  is the floating card, clear of the comments rail.
- **Plan read.** [`loadPlanAssistantTopics()`](../../lib/topics/assistant.server.ts:118)
  does two reads for every published location (placements + groups) and resolves them
  with the same `resolveLocationTopics` the hubs use. It is exposed by
  [`GET /api/clients/[id]/portal/assistant?forPortal=1`](../../app/api/clients/[id]/portal/assistant/route.ts:28),
  a portal-only route scoped to the advisor its slug resolves to.
- **Deep links open in place.** The chatbot sits in the portal layout, so following one of
  its links while already on that hub changes only the hash. `HowCanWeHelpSection` listens
  for `hashchange`, opens the named card and scrolls its panel into view.
- **Tests.** `lib/topics/__tests__/assistant.test.ts` (corpus, retrieval, intents, links),
  `lib/topics/__tests__/assistant-server.test.ts` (the plan read — run by Edit Benefit's
  suite) and the two portal-hub suites: the route and the sheet itself.

## A benefit hub's five blue buttons

Each of the four hub pages (Retirement, Group Health, Group Life, Custom) draws the
same five regions, and each carries a blue button that opens THIS page's Edit Panel
on the section that owns it:

| Region | Button | Panel anchor | Panel section |
| --- | --- | --- | --- |
| Banner photograph | **Edit header background** | `benefit-hero-image` | 3 — Branding (header background card) |
| Journey section | **Edit video section** | `benefit-video` | 5 — Video Source |
| "How Can We Help You Today?" | **Edit how we can help** | `benefit-help` | 6 — How Can We Help You Today? |
| Quick Answers | **Edit quick answers** | `benefit-quick-answers` | 7 — Get Quick Answers… |
| "Have Questions?" | **Edit have questions** | `benefit-have-questions` | 8 — Have Questions? |

The layout's **Edit footer** on a hub needed no change: its Disclosure is Section 9
of the same panel, addressed by the section id the `extraSections` wrapper renders.

**The scroll had to be wired twice.** `BenefitsEditorPanel` renders its own
`EditorPanelWrapper`, so the provider's `focusRequest` stopped at
`PortalBenefitEditor` and every button opened the panel at the top. The panel now
takes `focusRequest` and hands it to the wrapper; the sections carry
`data-edit-anchor` because they are rendered as children, not through the
wrapper's `sections` list.

## The welcome banner's per-element pencils

Inside the banner's card, every editable element has its own icon-only pencil —
headline, description, closing/signature, the key-contact portrait and the provider
logo. The banner does not know which panel owns what: the page passes
[`editTargets`](../../components/pages/client-portal/sections/portal-welcome-banner.tsx:117)
and the banner draws a pencil on each anchor it is given (nothing for a region it
was not given, nothing without an editing provider). The hubs pass:

| Element | Anchor |
| --- | --- |
| Headline, description | `benefit-messaging` (Section 4) |
| Closing + signature | — plan-level: not in the benefit panel, so no pencil |
| Key-contact portrait | `benefit-key-contact-image` (Section 3) |
| Provider logo | `benefit-provider-logo` (Section 3) |

The pencils are revealed with **CSS** (`opacity-0 group-hover:opacity-100`), not
state. A state-rendered pencil unmounted the moment the pointer left the region to
reach it — the button was visible and unclickable.

## Employee Resources' three blue buttons

The fifth hub (`/{plan}/employee-resources`) is built from the same sections but
has its own Edit Panel, so each of its three regions gets a blue button that opens
that panel on the region it sits on:

| Region | Button | Panel anchor | Panel section |
| --- | --- | --- | --- |
| Header photograph | **Edit hero background** | `employee-resources-hero` | 1 — Hero Background |
| "How Can We Help You Today?" | **Edit how we can help** | `employee-resources-help` | 2 — How Can We Help You Today? |
| Quick Answers | **Edit quick answers** | `employee-resources-quick-answers` | 3 — Quick Answers |

Two details make it work. The panel renders its sections as **children**, not
through `EditorPanelWrapper`'s `sections` list, so each `<section>` carries its own
`data-edit-anchor` — the wrapper's scroll looks for a section id first and then for
an anchor. And each region on the page sits in a `relative` wrapper, because
`PortalSectionEditButton` is absolutely positioned.

The buttons render nothing for a participant (no editing provider ⇒ no button), and
the anchors live in [`lib/portal-editor-sections.ts`](../../lib/portal-editor-sections.ts:33)
so the page and the panel cannot spell one differently.
[`page-edit-affordances.test.tsx`](<../../app/(portal)/[id]/employee-resources/__tests__/page-edit-affordances.test.tsx:1>)
pins all three: one button per region in page order, each asking for its own anchor.

## What every hub does

In render order, each page:

1. reads the plan from [`useClientPortal()`](../../contexts/client-portal-context.tsx:76) and the route param;
2. resolves `brandColor` (`#1F3A60`) and `secondaryColor` (`#6B7280`) with fallbacks;
3. reads the benefit from `GET /api/clients/{id}/benefits/{category}?forPortal=1` through SWR (`revalidateOnFocus: false`, `dedupingInterval: 60_000`), falling back to `employeePortalPreview` via `getBenefitFromPreview`;
4. derives the FAQ list — enabled rows first, then `DEFAULT_FAQS[category]`;
5. resolves support contacts with `buildFaqSupportContacts({ keyContacts, supportContacts })`;
6. loads documents once per `clientId` + embedded-id signature: `fetchPlanDocumentsForClient` → `mergePlanDocumentRows` → `sortDocumentRowsByCustomOrder` → `mapMergedRowsToBenefitHubItems(rows, hubLabel)`;
7. renders, in order: `CompletenessAutoTrigger`, `PortalWelcomeBanner`, `BenefitsVideoSection`, `HowCanWeHelpSection`, `FAQSection`, `BenefitDocumentSection`, `HaveQuestions`. Account access (plan / group ID, login URL, provider) is the wide card inside `HowCanWeHelpSection`; the old `PortalMaterialsHero` band was removed, and the header's **Login** button scrolls to that section. The page's videos are the `VideoCarousel` rail at the bottom of `BenefitsVideoSection` — the old `BenefitsHubWebinarsSection` band is gone.

## Where the four differ

|                         | Retirement                                                                   | Health                                                                           | Life                                                                                                              | Custom                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| SWR path                | `.../benefits/Retirement?forPortal=1`                                        | `.../benefits/Group%20Health?forPortal=1`                                        | `.../benefits/Group%20Life?forPortal=1`                                                                           | `.../benefits/Company%20%2F%20Plan%20Sponsor?forPortal=1`                                    |
| `category` prop         | `Retirement`                                                                 | `Group Health`                                                                   | `Group Life`                                                                                                      | `Company / Plan Sponsor`                                                                     |
| Document hub label      | `Retirement`                                                                 | `Group Health`                                                                   | `Group Life`                                                                                                      | `Company / Plan Sponsor`                                                                     |
| Webinar `placement`     | `retirement`                                                                 | `health-insurance`                                                               | `life-insurance`                                                                                                  | `wellness-programs`                                                                          |
| `DEFAULT_FAQS` key      | `Retirement`                                                                 | `Group Health`                                                                   | `Group Life`                                                                                                      | `Company / Plan Sponsor`                                                                     |
| Documents `title`       | Retirement Plan Documents & Forms                                            | Health Plan Documents & Forms                                                    | Life Insurance Documents & Forms                                                                                  | Wellness Program Documents & Forms                                                           |
| `accordionHeaderTitle`  | _(not passed)_                                                               | Health Plan Documents                                                            | Life Insurance Documents                                                                                          | Wellness Program Documents                                                                   |
| Journey defaults        | "Your Retirement Journey Starts Here" / "Build your future with confidence." | "Understanding Your Health Benefits" / "Navigate your coverage with confidence." | "Life Insurance: Protecting What Matters Most" / "Secure your family's financial future with the right coverage." | "Whole-Person Wellness Programs" / "Supporting your health, mind, and financial well-being." |
| Fallback video image    | unsplash `photo-1454496522488…`                                              | unsplash `photo-1576091160399…`                                                  | unsplash `photo-1511895426328…`                                                                                   | unsplash `photo-1545205597…`                                                                 |

Every other prop is identical, which is why a shared harness can cover three of the four pages almost entirely through this table.

## The hub Edit Panel's Disclosure section

Opening **Edit** on any hub mounts
[`PortalBenefitEditor`](../../components/portal-editing/editors/portal-benefit-editor.tsx:1),
which renders Create/Edit Benefit's own editor **plus a ninth section: Disclosure**.
[`BenefitsEditorPanel`](../../components/wizard/benefits-steps/benefits-editor-panel.tsx:116)
takes an `extraSections` prop for exactly this — the benefits wizard has no footer,
so the portal supplies the section rather than the wizard growing one it would
never fill.

**What it edits.** This hub's own row, `Client.disclaimers.byCategory[<category>]` —
the record the benefit editor's Step 5 writes and
[`layout.tsx`](<../../app/(portal)/[id]/layout.tsx:310>) reads FIRST on a hub page.
The Custom benefit is stored under `Other`. The other benefits, the portal-wide
"Home Page" row and `footerBackground` are untouched; the helper preserves them and
the suite asserts it.

| Scope | Key | Notice says |
| --- | --- | --- |
| Benefit hub | `byCategory.Retirement` / `Group Health` / `Group Life` / `Other` | The footer of **this** page only; the four non-hub pages share a separate disclosure |
| Landing panel | the "Home Page" row | The four non-hub footers at once; benefits keep their own |

The footer **background** beside the text is plan-wide (it paints every portal page)
and is edited from whichever panel is open — the same behaviour Step 5 has, and the
section says so.

**How it saves.** `saveBenefit()` deliberately drops Step 5 so one hub's save can
never rewrite another benefit's disclosures, so the panel writes the disclosure to
the plan itself: editing patches `clientData.disclaimers` (the footer repaints at
once) and flags a draft; **Save** runs `saveBenefit()` and then
`PUT /api/clients/:id { disclaimers }`, where `mergeDisclaimersPayload` merges it in.
Cancel clears the flag and the refetch reverts the footer.

**What the suites pin.**
[`portal-benefit-editor-disclosure.test.tsx`](../../components/portal-editing/editors/__tests__/portal-benefit-editor-disclosure.test.tsx:1)
— the section is offered and scoped to this hub (named by the benefit's own title),
typing writes `byCategory.Retirement` while leaving the landing row and the other
benefit intact, and Save PUTs the edited disclosure to the plan after the benefit
save. The shared helpers and the section's two scopes are covered by the landing
suite (`portal-disclosures.test.ts`, `portal-disclosure-section.test.tsx`).

## Test inventory

| #   | Suite                                                                                      | Tests | Focus                                                                          |
| --- | ------------------------------------------------------------------------------------------ | ----: | ------------------------------------------------------------------------------ |
| 1   | `lib/topics/__tests__/assistant.test.ts`                                                   |    31 | Assistant corpus, retrieval, intents, hubs, chips and exact-topic answers     |
| 2   | `app/api/clients/[id]/portal/assistant/__tests__/route.test.ts`                            |     7 | The assistant's index read: portal gate, advisor scoping, payload, failures    |
| 3   | `components/pages/client-portal/sections/__tests__/portal-chatbot.test.tsx`                |    24 | The sheet: greeting, hub turns, answers, hints, handoff, session, scroll lock  |
| 4   | `components/pages/client-portal/sections/__tests__/how-can-we-help-section.test.tsx`       |    82 | Cards, layout, panels, placements, rollovers and chat deep links               |
| 5   | `lib/__tests__/help-card-layout.test.ts`                                                   |    33 | Primary edge, row packing, hidden cards, ordering rules                        |
| 6   | `lib/topics/__tests__/library-content.test.ts`                                             |     9 | Shipped card lines, answer groups, acronyms and legacy topics                  |
| 7   | `lib/topics/__tests__/group-realign.test.ts`                                               |     9 | Restoring an older plan's Quick Answers groups to the library order            |
| 8   | `lib/__tests__/contact-card-presentation.test.ts`                                          |     9 | The CTA / show-hide settings carried onto a support card                       |
| 9   | `lib/__tests__/support-card-layout.test.ts`                                                |    18 | Row slots + element tier per contact count (1–4), the lone-card half width     |
| 10  | `components/pages/client-portal/sections/__tests__/have-questions.test.tsx`                |    26 | Support cards, `mailto:`/`tel:` links, designations, widths, key contact       |
| 11  | `components/__tests__/faq-section.test.tsx`                                                |    20 | Single-open accordion, incomplete rows, link normalisation                     |
| 12  | `app/api/clients/[id]/benefits/[category]/__tests__/portal-get.test.ts`                    |    24 | The anonymous `forPortal=1` read: slug→advisor scoping, 403/404, video signing |
| 13  | `components/pages/client-portal/sections/__tests__/completeness-auto-trigger.test.tsx`     |     9 | The "Incomplete Benefit Setup" trigger: merged docs, pre-merge pass, refetch   |
| 14  | `components/pages/client-portal/sections/__tests__/benefits-video-section.test.tsx`        |    30 | Journey copy defaults, the no-video image, gating, rail heading, player swap   |
| 15  | `components/pages/client-portal/sections/__tests__/video-carousel.test.tsx`                |    22 | Rail fetch, `includeVideoFiles=0`, skeletons, runtime, heading + count, chevrons |
| 16  | `components/pages/client-portal/sections/__tests__/webinar-replay-card-poster.test.tsx`    |     8 | The poster card: 16:9 frame, white-ring play, gradient, title, runtime badge   |
| 17  | `components/pages/client-portal/sections/__tests__/video-feature-player.test.tsx`          |    11 | The inline player: embed/direct/uploaded sources, errors, X and Escape         |
| 18  | `components/pages/client-portal/sections/__tests__/portal-welcome-banner-portrait.test.tsx` |    10 | The banner portrait: plan override, key-contact headshot default, placeholder  |
| 19  | `components/pages/client-portal/sections/__tests__/portal-welcome-banner-schedule.test.tsx` |     2 | The banner's Schedule CTA: handler vs scheduling URL                            |
| 20  | `components/pages/client-portal/sections/__tests__/portal-welcome-banner-edit-pencils.test.tsx` | 5 | The banner's per-element pencils and the panel anchors they name               |
| 21  | `components/portal-editing/editors/__tests__/portal-benefit-editor-disclosure.test.tsx`     |     3 | The hub Edit Panel's Disclosure section, scoped to this benefit                |
| 22  | `app/(portal)/[id]/employee-resources/__tests__/page-edit-affordances.test.tsx`            |     5 | Employee Resources' three blue buttons and the anchors they name               |
| 23  | `app/(portal)/[id]/retirement/__tests__/page-edit-affordances.test.tsx`                    |     3 | A hub's five blue buttons, one template across four pages                      |
| 24  | `lib/__tests__/benefits-video-fallback.test.ts`                                            |     7 | Per-category clips, plan video precedence, embed/URL fallbacks                 |
| 25  | `lib/text/__tests__/linkify.test.ts`                                                       |     6 | Turning an address in answer copy into a real link                             |

## Remaining coverage

| #     | Target                                                                                                        | Why it is still worth writing                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| H1–H4 | The four page suites (`app/(portal)/[id]/__tests__/benefit-hub-*.test.tsx`)                                   | The page-level pipeline: SWR key, benefit fallback, FAQ/contact wiring, document merge, per-category props |
| H5–H8 | `getBenefitFromPreview`, `mapMergedRowsToBenefitHubItems`, `buildFaqSupportContacts`, `mergePlanDocumentRows` | The helpers behind the pages                                                                               |
| H13   | `benefit-document-section.test.tsx`                                                                           | Language toggle, search, download/preview, empty state                                                     |
| H14   | `portal-welcome-banner.test.tsx`                                                                              | Custom copy over defaults, category art, advisor signature                                                 |
| H15   | `benefits-video-section.test.tsx`                                                                             | Plan video vs fallback image, label/thumbnail, play state                                                  |
| H20   | A table-driven parity guard                                                                                   | Catches copy-paste drift across the four pages                                                             |
| H21   | `e2e/portal-hubs.spec.ts`                                                                                     | A real hub renders, documents load, the wrong custom URL 404s                                              |

### What the landed suites assert

**Portal benefit read (`portal-get.test.ts`)** — the plan is resolved through the advisor its slug yields and scoped with `userId`; `resolvePlanAccess` and the session are never consulted; another advisor's plan is a 403; no advisor and no session is a 401; the dev loopback bypass; `benefit: null` for a missing row; R2 keys signed (raw and proxied), absolute URLs untouched, nothing done when R2 is off; 500 on failure.

**Completeness trigger** — opens with `missingInfo`/`category`/`clientId`, stays closed when complete, computes against the merged documents, computes once on the embedded list before the merge (the flash), no fetch without a plan id, re-fetches when embedded ids change but not on an equal signature, closes on a later complete update, and stops after unmount.

**Videos rail** — `/api/webinars?clientId=…&placement=…&includeVideoFiles=0` with `cache: "no-store"`, the `clientId` prop winning over the route segment; skeletons with `aria-busy` while loading; a heading of "<Category> Essentials" (`essentialsTitleFor` — the Custom hub's `Company / Plan Sponsor` storage key is spelled "Plan", and no category yet means "Benefit Essentials") with the row's count beside it (`3 videos`, `1 video`, absent until the fetch answers); one fixed-width slide per video, newest upload first (ordered on `createdAt`, not the API’s `eventDate` order; ties keep the server’s order), in a `snap-x` / `overflow-x-auto` track; nothing for an empty plan or a failed request; the stored `duration` handed to each card for its badge (blank when the row has none). The chevrons exist only when the row actually overflows (`scrollWidth − clientWidth > 4`): four fixed-width cards fill a 1280px column, so a plan with four or fewer videos gets no paging controls at all — not even disabled ones — and when they are shown ("Scroll videos left/right") the chevron pages the row by 85% of its width. Each slide is `WebinarReplayCard`'s `poster` variant: the card IS the 16:9 frame, with the play control top-right (white ring, white icon), a bottom-to-top black scrim, the title bottom-left (half the card wide, up to three lines) and the runtime bottom-right (black pill, white text); the description is captioned under the card. The runtime is `replay.duration` — a stored column measured at upload — so it appears with the list read; only when a row has none does the card fall back to the video's own metadata.

**Video player (the rail's dynamic video)** — a card click hands the replay to the section (`onSelect`) instead of opening the card's own dialog. The whole two-column intro — heading, copy, Watch Now, the plan video — is taken out of the layout (`hidden`) and `VideoFeaturePlayer` takes its place, full-bleed: the stage's `-mx-4 w-[calc(100%+2rem)]` (and the `sm`/`lg` equivalents) cancels the section's `px-*` and adds it back on both sides, so the video spans the section edge to edge. The rail stays underneath and marks the playing slide (`data-active` / `aria-current`, and the card draws its white border inset on the thumbnail — an outer ring was clipped by the track at the top and wrapped the caption). Sources resolve in the card's order: YouTube/Vimeo embed → direct file URL → the uploaded payload fetched from `/api/webinars/[id]?forPortal=1&clientId=…` (never with the list). The X top-right (`Close video`) or Escape puts the intro back; the plan video is paused when the player takes over so its audio cannot play on from an off-screen element.

**Materials hero** — heading/CTA/default bullets; plan id from prop then context, hidden for `[Not Set]`; administrator from the benefit's provider with a `name · phone` line, the legacy `recordkeeper` only for Retirement; the prop handler over the context login URL (opened with `noopener,noreferrer`); background precedence prop → saved → category stock; overlay opacity.

**Have questions** — nothing without contacts; one card per person; `mailto:` and digits-only `tel:`; missing rows omitted; designation acronyms with blanks filtered; headshot vs glyph; brand/accent colours; only the CTA the advisor configured (none without one); the plan's logo on a plan-level / plan-sponsor card; the cards centred in the row for 1–4 contacts, and the row sized from that count — four contacts share it as quarters, three as thirds, two as halves, and a lone card keeps a **half** so it never spans the band (`lib/support-card-layout`); the same count picks the card's element tier (`sm` 4-up, `md` 3-up, `lg` 2-up / lone); this benefit’s key contact labelled **Key Contact** and ordered first.

**Welcome banner portrait** — the key contact headshot is the default; an image chosen in the Editing Panel (`portraitImage` prop, else the plan's `heroPortraitImage`) replaces it, prop first; with neither, the frame's own placeholder is drawn — the per-category "Inner Header Image" stock photo is gone.

**How can we help** — the three fallback cards and their deliberate empty CTAs; configured cards replacing them; bold intro plus paragraphs; internal CTA prefixed with the plan; external CTA new tab with `https://` added; anchor/mailto kept in place (`target` absent); inert button when there is no href; `onCardEdit` receives the card id.

**FAQ section** — heading and one button per question; open/close via `grid-template-rows`; one open at a time; rows missing a question or an answer dropped; the heading alone when empty; `linkHref` normalisation (`https://` for a bare host, absolute kept, `mailto:`/`tel:`/`#` kept, `javascript:` passed through); no link when either half is missing; the `contacts` prop renders nothing; brand colour on the heading.

## H1 — Retirement, the reference suite

`swr` is mocked so the test controls `data`, and every section is stubbed to a JSON dump of its props — the assertions are about **what the page derived**, not about section markup.

- **Benefit read**
  - requests `/api/clients/plan-1/benefits/Retirement?forPortal=1` with `revalidateOnFocus: false` and `dedupingInterval: 60_000`
  - makes no request when there is no `clientId`
  - uses `data.benefit` when present
  - falls back to `getBenefitFromPreview(employeePortalPreview, "Retirement")` when it is absent
- **FAQs**
  - passes only rows with `enabled !== false`
  - falls back to `DEFAULT_FAQS.Retirement` when every row is disabled
  - falls back to the defaults when the benefit carries no FAQs at all
- **Support contacts**
  - calls `buildFaqSupportContacts` with the plan's `keyContacts` and the benefit's `supportContacts`
  - passes the resolver's result to **both** `FAQSection` and `HaveQuestions`
- **Documents**
  - merges the API rows with the embedded `clientData.documents`, sorts them and maps them to the `Retirement` hub label
  - on a fetch failure, falls back to the embedded documents only and still stops loading
  - does not set state after unmount (`cancelled`)
  - re-runs when the embedded ids change but not when the array is merely re-created
  - sets `loading` while in flight
- **Props**
  - passes the brand colours (with fallbacks) and `clientId` to the sections
  - passes the benefit's `title` / `shortDescription` to the welcome banner
  - passes `helpCards`, `planVideo*`, `journey*` and `providerContact` through
  - passes the retirement materials heading and document titles
  - does **not** pass `accordionHeaderTitle`
  - renders `CompletenessAutoTrigger` with `category="Retirement"`

## H2 / H3 — Health and Life

The same tests, driven by the constants table: SWR path, `category`, document hub label, webinar placement, `DEFAULT_FAQS` key, both headings, the `accordionHeaderTitle` (present on these two), and the fallback journey copy. These are deliberately shallow — the pipeline is H1's job; these prove the wiring per category.

## H4 — The Custom hub

This page is the only one with a URL gate, and the gate is the reason the suite exists:

- **Segment validation**
  - accepts the advisor's name slug (`mindfulness-and-me`)
  - accepts the legacy `wellness-programs` alias
  - calls `notFound()` for any other segment
  - **does not** call `notFound()` before the benefit read has answered (`benefitApiData === undefined`), so a slow request is not mistaken for a bad URL
  - uses the fallback benefit's `title` when the API returns none
- **Constants**: the Company / Plan Sponsor SWR path, category, hub label, `wellness-programs` placement (deliberately not the slug), FAQ defaults key and headings
- **Pipeline**: documents, FAQs and contacts behave exactly as in H1 (a couple of cases each is enough)

## H5 — `getBenefitFromPreview`

The fallback every hub depends on during the dual-write transition:

- reads `employeePortalPreview.benefits` only — it does **not** look at `previewData.benefits`
- matches with a strict `b.category === category` comparison, so the stored label must match the caller's spelling exactly (no case or whitespace normalization)
- returns `undefined` for a missing preview, a non-array `benefits`, or no match
- returns the row as `PortalBenefitData` without mutating it
- `getPlanVideoUrl` returns `planVideo` when set and `undefined` otherwise

## H6 — `mapMergedRowsToBenefitHubItems`

- maps only rows whose persisted hub matches the requested label, resolved through `resolvePersistedDocumentCategory(type, category, storageKey)`
- drops archived rows (`archivedAt`) before matching
- preserves the incoming order (sorting is the caller's job)
- projects `{ id, title, description, href, language, meta }`:
  - `title` = `title` → `fileName` → `name` → `"Document"`
  - `description` = `shortDescription` → `"Complete guide to your retirement plan options"` (the same generic line for every hub)
  - `href` = `/api/documents/{id}/view` only for a 24-char hex id that is not `doc-`/`plan-doc-`/`optional-doc-`/`temp-`; otherwise `fileUrl` or `#`
  - `language` = `normalizePortalDocumentLanguage(doc.language, guess)` where `[es]`, `(es)`, `" español"` or `"spanish"` in the title/file name/description guesses **ES**
  - `meta.source` is the literal `"retirement"` for every hub
- does not drop rows for a missing `storageKey`/`fileUrl` before the hub match (those only affect `href`)
- `benefitCategoryToDocumentHubLabel` delegates to `resolvePersistedDocumentCategory("Document", category)` and defaults a blank category to `Retirement`

## H7 — `buildFaqSupportContacts`

- resolves each `supportContacts[].contactId` against the plan's live `keyContacts`
- drops ids that no longer resolve (no phantom cards)
- keeps the selection's order and de-duplicates
- returns `[]` when the benefit selected nobody or the plan has no contacts
- tolerates the `{ contacts }` envelope for `keyContacts`
- also carries the card-facing fields the Have Questions band needs — `name`, `schedulingUrl`, `companyName`, `companyLogo`, `websiteUrl` — so the band can hand the contact straight to `BenefitContactCard`
- carries the contact's CTA configuration verbatim (`enableContactButton`, `contactButtonType`). A contact with no configured CTA renders no button: the card never infers one, and the plan's `appointmentLink` alone is not a CTA
- carries `benefitsCategories` so a Company / Plan Sponsor card — and any plan-level contact with no category of its own — shows the PLAN's logo, the same rule My Benefits Team applies
- the card's subtitle is the person's role (`customRole`/job title); the old per-benefit blurb is only a fallback

## H8 — `mergePlanDocumentRows`

- API fields win for a shared id, but `storageKey`, `fileUrl` and `category` are backfilled from the embedded row when the API value is blank
- embedded-only rows are appended after the API rows (the not-yet-persisted uploads)
- the result is de-duplicated by document name (lower-cased `title`/`name`/`fileName`/`id`) plus category, which catches the same document under a temporary `doc-` id and its persisted id
- an empty side is a no-op; a non-array side is treated as empty
- rows without an `id` are dropped

(`lib/document-category` and `lib/documents/document-sort` already have suites — do not duplicate them here.)

## Endpoints

```bash
GET /api/clients/:id/benefits/Retirement?forPortal=1                    # benefit read
GET /api/clients/:id/benefits/Group%20Health?forPortal=1
GET /api/clients/:id/benefits/Group%20Life?forPortal=1
GET /api/clients/:id/benefits/Company%20%2F%20Plan%20Sponsor?forPortal=1
GET /api/documents/client?clientId=…                                     # via fetchPlanDocumentsForClient
```

## Manual checklist

### 1. Arrival

- [ ] Each landing-page card opens its own hub, with the correct URL segment.
- [ ] The Custom card opens the advisor's chosen name slug (and the legacy `/wellness-programs` still resolves).
- [ ] An unknown segment under the plan shows the portal's **not-found** page.
- [ ] The header nav highlights the hub you are on.

### 2. Content

- [ ] The welcome banner shows the plan identity and the benefit's title/description.
- [ ] "How can we help" cards render the benefit's own cards, or the defaults.
- [ ] The video section shows the plan video, its label and thumbnail; with no video it shows the category fallback image.
- [ ] Webinars appear only when published to that page's placement.
- [ ] FAQs show the benefit's enabled questions, falling back to the category defaults.
- [ ] Documents list this hub's documents only, in the saved custom order; the section's loading state clears.
- [ ] If the documents request fails, the embedded documents still render.
- [ ] "Have questions?" shows the same people as the FAQ support cards.

### 3. Custom hub

- [ ] Renaming the Custom benefit changes its URL and the old name stops resolving (only `wellness-programs` survives).
- [ ] A plan with an unnamed Custom hub still works at `/wellness-programs`.
- [ ] A slow benefit request shows the page rather than a 404 flash.

## Known gaps

Observations from the implementation, worth pinning or fixing:

1. **Four near-copies.** The pages are ~250 lines each with the same body and different constants; extracting a `useBenefitHubPage(category)` would cut the tests to one suite. The existing duplication is why H2/H3 exist at all.
2. **The Custom gate depends on SWR having answered.** `benefitApiData !== undefined` is the trigger; if the benefit request _errors_, `data` stays `undefined` and the page renders for **any** segment — an unknown URL then shows an empty hub instead of the 404.
3. **Hooks are skipped after `notFound()`.** The early return sits between hook calls, so a valid render calls seven hooks and an invalid one calls three. React tolerates it only because `notFound()` aborts the render; it is a rules-of-hooks hazard rather than a modelled flow.
4. **The document fetch runs twice when embedded docs arrive late.** The effect depends on `documentsSig`, so the initial `""` and the first non-empty signature both fetch.
5. **The "Incomplete Benefit Setup" modal is shown to participants, and can flash.** `CompletenessAutoTrigger` renders the dialog with no session, role or preview check, so an anonymous employee opening an incomplete benefit sees an advisor-facing setup dialog whose CTA ("Finish Setup in Wizard") leads to a sign-in wall. It also computes **before** the document merge resolves, so the first pass can report "Plan documents missing" and open the modal, which then closes once the merged list arrives — both pinned by the suite.
6. **The `main` landmark lives in these pages, not the layout.** The navbar doc noted the portal chrome has no `<main>`; the four hubs each supply one, so hub pages are fine while the landing page is not.
7. **Retirement's FAQ memo can return `undefined`** through a `let list` path while the other three return it explicitly — same behaviour, two shapes.
8. **The preview fallback matches the category exactly.** `getBenefitFromPreview` uses `b.category === category`, so a JSON blob that stored `"group health"` (lower-case, or with different spacing) silently yields no benefit at all — the page then renders its defaults with no custom title, copy, FAQs or contacts. The landing page's contact filter has the same class of problem.
9. **Document metadata is retirement-shaped on every hub.** `mapMergedRowsToBenefitHubItems` sets `meta.source: "retirement"` and defaults the description to **"Complete guide to your retirement plan options"**, which is what a life or wellness document shows when it has no short description.
10. **Only the Custom hub can 404.** The three legacy routes always render, even for a plan with no benefit in that category (they fall back to defaults), so a participant can reach an empty `/retirement` hub from a hand-typed URL.
11. **`FAQSection` accepts `contacts` and renders none.** The hub pages pass the same resolved people to `FAQSection` and to `HaveQuestions`; only the latter shows them, so the FAQ prop is dead weight (pinned by the suite).
12. **A FAQ link keeps a `javascript:` scheme.** `normalizeHref` deliberately passes `#`, `mailto:`, `tel:` and `javascript:` through, and the accordion renders the value as an `href` — so a benefit's stored link can execute script in the participant's session. Worth rejecting `javascript:` at the source.

## Future coverage

- extract the shared body into a hook (or a `<BenefitHubPage>` component) and test it once per category rather than per page;
- component suites for `BenefitDocumentSection` / `PortalWelcomeBanner` once their internals matter;
- E2E: one hub per category, the documents list after an upload, and the Custom URL rename.

## Related documentation

- [`docs/testing/portal-landing-tests.md`](portal-landing-tests.md) — the page whose cards open these hubs.
- [`docs/testing/portal-navbar-tests.md`](portal-navbar-tests.md) — the chrome these pages render inside.
- [`docs/testing/documents-tests.md`](documents-tests.md) — the documents pipeline the hubs reuse.
