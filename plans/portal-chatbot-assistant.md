# Portal chatbot — grounded benefits assistant

**Status:** implemented (M1–M5; deterministic retrieval, no LLM)
**Scope:** [`components/pages/client-portal/sections/portal-chatbot.tsx`](../components/pages/client-portal/sections/portal-chatbot.tsx)

## 1. Goal

Turn the floating "Ask a question" sheet from a local message list into a **grounded
benefits assistant** that:

1. **Covers the whole shipped library** — every topic in
   [`lib/topics/library/index.ts`](../lib/topics/library/index.ts) (Retirement, Group
   Health, Group Life, Custom starter sets, Employee Resources), whether or not this
   plan has placed it.
2. **Answers only from plan content** — the topic's own quick answer, steps, tags and
   CTA; nothing generated, nothing invented.
3. **Gives navigational agency** — deep links to the exact answer on the participant's
   hub (`/{plan}/retirement#401k-loans`), to the hub itself, to Employee Resources,
   News & Events and My Benefits Team, plus login, advisor and HR handoffs.

No network LLM. The index is built from the shipped library plus the plan's
placements; scoring and intent routing run locally, instantly, and are unit-testable.

## 2. Non-goals

- Free-form generation, summarisation or paraphrase (no OpenAI call).
- Live document search (plan documents are linked, not indexed).
- Persistent conversation history across page loads.
- Replacing the "Have Questions?" band or the advisor booking flow.

## 3. Experience

```
┌─ Benefits assistant ─────────────────────┐
│ Hi! Ask me anything about your plan.     │  ← assistant bubble (greeting)
│ [Retirement] [Health] [Life] [HR]        │  ← hub chips (published hubs only)
│                                          │
│                              How do I    │  ← user bubble
│                              take a loan?│
│ Can I take a loan?                       │  ← answer bubble
│ If your plan allows loans, you can       │
│ generally borrow up to 50% …             │
│ 1. Log in to your recordkeeper account.  │  ← first 3 steps, numbered
│ 2. Review your available loan amount.    │
│ [Request a loan] [Open on your plan page]│  ← CTA + deep link
│ Related: How is a loan repaid?           │  ← 1–2 related topics (if placed)
└──────────────────────────────────────────┘
```

- **Loading:** the first open starts one request for the plan's placements. While it
  is in flight the assistant shows a typing indicator; hub chips still work because
  they come from `clientData` alone.
- **Confidence:** a confident match answers directly. A close call shows "Did you mean…"
  chips (top 3). No match shows the suggestion chips plus the handoff links.
- **Navigation:** every answer carries at least one link, and each link spells out its
  destination ("Goes to your Retirement page and opens this answer", "Opens
  recordkeeper.example in a new tab"). Following one never closes the sheet.
- **Accessibility:** `aria-live="polite"` on the transcript, chips and links are real
  buttons/anchors, Escape still closes the sheet.

## 4. Data sources

| Source | What it gives | Where it lives |
| --- | --- | --- |
| `lib/topics/library` | All ~140 shipped seeds: title, summary, body blocks, tags, group, locations, CTA | Already in the client bundle (the hub renders it) |
| `GET /api/clients/[id]/portal/assistant` **(new)** | This plan's placements per location: resolved title/summary/body/tags, display mode, group, plus hidden slugs and the org-authored topics the library does not have | New route + `lib/topics/assistant.server.ts` |
| `clientData` (portal context) | `benefitHubs`, `categoryPortalVisibility`, `employeeResourcesEnabled`, custom hub title, `companyName`, `insuranceLoginUrl`, `appointmentLink`, `keyContacts` | Already fetched by `ClientPortalProvider` |
| `lib/topics/deep-link` | `topicHashSlug`, `topicMatchesHash` | Existing |
| `lib/marketing/hub-url` + `lib/benefit-custom-name` | Hub route segments, custom hub slug | Existing |

### New API contract

```http
GET /api/clients/{id}/portal/assistant?forPortal=1
200 {
  "topics": [
    {
      "slug": "sys.401k-loans",          // stored slug, namespaced
      "location": "retirement",
      "title": "Can I take a loan?",
      "summary": null,
      "bodyBlocks": [ … TopicBodyBlock[] … ],
      "tags": ["loan", "borrow"],
      "group": "Loans & Withdrawals",
      "displayMode": "quick_answers",
      "isActionHub": false,
      "cta": { "label": "Request a Loan", "actionType": "external_url" }
    }
  ],
  "hiddenSlugs": ["sys.employer-match"]   // placed but hidden: never answered
}
```

- One route, two Prisma reads (all placements for the client + all groups), then
  `resolveLocationTopics` per location. No N+1, no per-hub round trip.
- Auth mirrors `GET /api/clients/[id]/benefits/[category]?forPortal=1`: resolve the
  plan by id or slug, scope portal requests to the owning advisor.
- Only locations whose Benefit row is published and visible are returned, plus
  `employee_resources` when the plan's flag is on. Hidden placements are reported as
  slugs, not content, so the client can keep them out of the library-wide fill.

## 5. Corpus construction (pure)

New [`lib/topics/assistant.ts`](../lib/topics/assistant.ts):

```ts
buildAssistantCorpus({
  placed,              // AssistantPlacement[] from the API (resolveEffectiveTopic output)
  hiddenSlugs,         // excluded from the library fill, even if shipped
  customHubTitle,      // labels the Custom hub's topics
}): AssistantTopic[]
```

Rules:

1. **Start with the library.** For every location
   (`retirement`, `group_health`, `group_life`, `custom`, `employee_resources`), take
   `libraryTopicsForLocation(location)`.
2. **Overlay the plan's placements by slug.** A placement wins for title, summary,
   body blocks, tags and CTA — it is already `resolveEffectiveTopic` output, so a plan
   override and the shipped fallback are both correct.
3. **Add org-authored topics** the library does not have (placements whose slug is not
   in `libraryTopicBySlug`).
4. **Drop hidden slugs** from the union. An advisor hid the topic on purpose; the
   assistant stays silent about it.
5. **Mark `isPlaced`.** Only placed topics get a deep link; the rest are answerable but
   link to their hub with "this isn't on your plan's page yet" copy.
6. **Dedupe by published slug** (`sys.` stripped) so a topic placed in Retirement and
   Group Life is one entry per location, each with its own hub link.

`AssistantTopic`:

```ts
interface AssistantTopic {
  slug: string;                      // published (no sys.)
  storedSlug: string;                // for hrefs / matching
  location: TopicLocation;
  title: string;
  summary?: string;
  quickAnswer: string;               // topicQuickAnswer()
  steps: string[];
  tags: string[];
  group?: string;
  cta?: TopicCta;
  displayMode: "featured" | "quick_answers";
  isPlaced: boolean;
  isActionHub: boolean;
  /** Precomputed token sets per field, built once. */
  fieldTokens: Record<"title" | "tags" | "group" | "summary" | "answer" | "steps" | "location", Set<string>>;
  phraseText: { title: string; tags: string; answer: string; all: string };
}
```

## 6. Retrieval (deterministic, ranked)

`searchAssistantTopics(corpus, question, limit = 3)`.

**Normalise:** lowercase → non-alphanumerics to spaces → split on whitespace → drop
stop words (`how`, `do`, `i`, `the`, `my`, `can`, `what`, `is`, `a`, `to`, `for`, `of`,
`and`, `if`, `when`, `should`, `does`, `it`, `on`, `in`, `with`, `about`, `am`, `are`,
`was`, `will`, `would`, `please`, `tell`, `me`, `where`, `get`, `an`, `or`, `be`,
`have`, `has`, `this`, `that`).

**Stem** lightly: trailing `'s`, then `s` (len > 3), then `ing` / `ed` (len > 5).

**Expand** through a small synonym map (module constant, tested):

| User says | Canonical tokens added |
| --- | --- |
| `401k`, `403b`, `457`, `pension`, `ira` | `retirement` |
| `medical`, `doctor`, `copay`, `deductible`, `claim`, `prescription`, `pharmacy`, `network`, `telehealth` | `health` |
| `dental`, `vision` | `health` |
| `death benefit`, `ad&d`, `disability`, `std`, `ltd`, `supplemental` | `life` |
| `pto`, `vacation`, `sick`, `fmla`, `leave`, `holiday` | `time`, `off` |
| `payroll`, `paycheck`, `w2`, `w-2`, `pay stub` | `pay` |
| `hr`, `human resources`, `handbook`, `policy` | `employee`, `resources` |
| `sign in`, `signin`, `log in`, `login`, `account access` | `login` |
| `human`, `person`, `someone`, `representative`, `advisor` | `contact` |

**Field weights** (sum of the best field per query token):

| Field | Weight | Phrase bonus (whole query appears) |
| --- | --- | --- |
| Title | 10 | +25 |
| Tags | 8 | +18 |
| Group name | 6 | — |
| Summary | 4 | — |
| Quick answer | 3 | +8 |
| Steps | 2 | — |
| Location label | 2 | — |

**Score:**

```
raw      = Σ tokenWeight(token) + phraseBonuses
coverage = matchedQueryTokens / totalQueryTokens
score    = round(raw * coverage^1.5)
```

- **Confident** when `top.score >= 40` **and** `top.score >= 1.25 × second.score`.
- **Suggest** when `top.score >= 14` but confidence fails, or when the second is close —
  return the top 3 as chips.
- **No answer** below 14 — return suggestion chips (best of the low scorers, else the
  plan's featured topics) plus the handoff.

Tie-breakers: placed before unplaced → featured before quick answers → title
alphabetical. Fully deterministic.

Worked acceptance examples:

| Question | Expected winner |
| --- | --- |
| "how do I take a loan from my 401k" | `401k-loans` (Retirement) |
| "how is my 401k loan repaid" | `loan-repayment` |
| "what does COBRA stand for" | `cobra` (Group Health) |
| "where do I see my pay stub" | `pay-stubs-direct-deposit` (Employee Resources) |
| "how much PTO do I get" | `pto-policy` |
| "who updates my beneficiary" | Update My Beneficiaries (Retirement + Group Life) |
| "asdfgh" | suggestions, not an answer |

## 7. Intent routing

`respondToQuestion({ question, corpus, plan })` runs intents in order and returns one
`AssistantReply`:

1. **Small talk** — `hi/hello/hey/thanks/thank you/bye`. Canned reply plus hub chips.
2. **Navigation** — explicit nav verbs/nouns: `where`, `find`, `open`, `take me`,
   `go to`, `link`, `page`, `hub`, `portal`, `login`, `sign in`, `account`,
   `documents`, `news`, `events`, `team`, `advisor`. Resolves:
   - a named hub → that hub link (only published hubs);
   - a named topic → its deep link when placed, else its hub;
   - `login/account` → `insuranceLoginUrl` when set, else the hub's Account Access copy;
   - `documents` → the hub page (documents rail).
3. **Contact / handoff** — `talk`, `call`, `email`, `contact`, `advisor`, `hr`,
   `someone`, `human`, `help me` → `appointmentLink` (external) plus the
   Have Questions band anchor and the key contact's `mailto:`/`tel:` when present.
4. **Topic answer** — the ranked search from §6.
5. **Fallback** — suggestions plus handoff; never a dead end.

An answer reply also carries navigation: its deep link, its CTA, and its hub. Answers
are therefore never "here's text, good luck".

## 8. Reply shape

```ts
type AssistantLink = { label: string; href: string; external?: boolean };

type AssistantReply =
  | { kind: "answer"; text: string; steps: string[]; links: AssistantLink[];
      related: { label: string; href?: string }[] }
  | { kind: "navigate"; text: string; links: AssistantLink[] }
  | { kind: "suggest"; text: string; options: { label: string; query: string }[];
      links?: AssistantLink[] }
  | { kind: "handoff"; text: string; links: AssistantLink[] }
  | { kind: "smalltalk"; text: string; links?: AssistantLink[] };
```

- `text` is the topic's quick answer (or summary), with `[Benefit Category]` filled via
  `fillHelpCardTokens` and `[Company Name]` / `[Advisor Name]` filled from
  `clientData`/`profile`.
- `steps` is the first **3** steps of the `steps` block, verbatim.
- `links` order: CTA (login / request / contact) → "Open on your plan page" (deep
  link) → "See all questions" (hub).
- Related topics come from the same group or location with overlapping tokens; they
  only render when placed (a dead deep link is worse than silence).

## 9. Navigation link rules

`buildAssistantPlan({ clientId, clientData })` returns:

| Link | Rule |
| --- | --- |
| Hub | `/{clientId}/retirement`, `/health-insurance`, `/life-insurance`; Custom uses `customBenefitNameToSlug(customHubTitle)` with `/wellness-programs` fallback; only when `benefitHubs` marks it enabled and `categoryPortalVisibility` is not false |
| Employee Resources | `/{clientId}/employee-resources` only when `employeeResourcesEnabled` |
| News & Events | `/{clientId}/news-events` |
| My Benefits Team | `/{clientId}/my-benefits-team` |
| Home | `/{clientId}` |
| Topic | `${hubHref}#${topicHashSlug(storedSlug)}` — only when `isPlaced` and the hub is published |
| Login | `insuranceLoginUrl` (external, new tab) |
| Advisor | `appointmentLink` (external) else `#have-questions` |
| HR contact | first key contact's `mailto:` / `tel:` else the Have Questions band |

Deep links must **open the answer**, not just scroll: the section only reads the hash
when the grid changes (see `how-can-we-help-section.tsx:1416`). Milestone 4 adds a
`hashchange` listener so an in-page chat link opens that card immediately (and scrolls
to it) without a reload.

## 10. UI work in `portal-chatbot.tsx`

- `ChatMessage` becomes `{ id, role, reply?: AssistantReply, text?: string }`; the
  renderer switches on `reply.kind`.
- Index loading: `useSWR('/api/clients/{id}/portal/assistant?forPortal=1', fetcher, { revalidateOnFocus: false })`
  with the key `null` until the sheet first opens (no DB hit for visitors who never
  chat). Warm the request on FAB `pointerenter` / `focus`.
- Reply pipeline: `send()` appends the user message, then
  `respondToQuestion({ question, corpus, plan })` on the next tick (a ~200 ms typing
  indicator, so the bubble does not snap in), and appends the assistant reply.
- The greeting carries one button per published hub. Pressing one asks the assistant
  about that benefit; the reply offers its topics as chips (`respondToHub`), so the
  conversation stays in the sheet. A chip answers the exact topic it stands for
  (`respondToTopic`), even when two hubs share a title.
- Controls are white pills with the plan-coloured border. Links use `next/link` for
  in-portal paths and `<a target="_blank" rel="noreferrer">` for external ones; each
  shows a destination caption, and following one leaves the sheet open.
- The transcript scrolls to the visitor's question, not the end of the answer: the
  newest user message is pinned near the top (its `offsetTop` on the `relative`
  transcript, minus a small gap), so a long reply is read from its first line. The
  landing page's Ask bar opens the sheet on the same anchor.
- The transcript is kept in `sessionStorage` under
  `portal-chatbot-session:v1:{clientId}` together with the time the session began. A
  stored conversation younger than `CHAT_SESSION_MS` (one hour) is restored after
  mount; at the hour mark a timer resets the sheet to the greeting and clears the entry.
- Keep the visual shell (FAB, sheet, colours, `edgeStyle`, Escape) untouched.
- Add `employeeResourcesEnabled?: boolean` to `ClientData` (already returned by the
  portal payload; the layout currently reads it through an `any` cast).

## 11. Files

**New**

| File | Purpose |
| --- | --- |
| `lib/topics/assistant.ts` | Pure corpus builder, scorer, intent router, link builders, reply types |
| `lib/topics/assistant.server.ts` | `loadPlanAssistantTopics(clientId)` — placements + groups → resolved topics/hidden slugs |
| `app/api/clients/[id]/portal/assistant/route.ts` | Portal-scoped GET returning the contract in §4 |
| `lib/topics/__tests__/assistant.test.ts` | Retrieval, synonyms, confidence, intents, links, corpus rules |
| `lib/topics/__tests__/assistant-server.test.ts` | Mocked Prisma: per-location resolution, hidden slugs, org topics |

**Modified**

| File | Change |
| --- | --- |
| `components/pages/client-portal/sections/portal-chatbot.tsx` | Structured replies, index fetch, chips, links, typing state |
| `components/pages/client-portal/sections/__tests__/portal-chatbot.test.tsx` | Cover answers, suggestions, handoff, navigation, close-on-link |
| `components/pages/client-portal/sections/how-can-we-help-section.tsx` | `hashchange` listener so chat deep links open the card |
| `components/pages/client-portal/sections/__tests__/how-can-we-help-section.test.tsx` | One test for opening on a hash change |
| `contexts/client-portal-context.tsx` | Type `employeeResourcesEnabled` |
| `config/vitest/vitest.portal-hubs.config.mts` | Register `lib/topics/__tests__/assistant.test.ts`, the section hash test, and the assistant route test |
| `config/vitest/vitest.edit-benefit.config.mts` | Register `assistant-server.test.ts` alongside `board-server.test.ts` |
| `docs/testing/portal-benefit-hub-tests.md` | Document the assistant's coverage and test counts |

No new dependencies.

## 12. Performance & resilience

- **One request, lazy.** The index is fetched on first open (or FAB hover), never on
  page load. Two DB reads total.
- **Local scoring.** ~200 topics with precomputed token sets; search is sub-millisecond.
- **No LLM latency or cost.** Replies are synchronous once the corpus is loaded.
- **Failure is graceful.** If the index fails, answers fall back to the library-only
  corpus (still covers every shipped topic) with hub links from `clientData`; the sheet
  shows "I can't load your plan's custom answers right now" rather than an empty chat.
- **No hidden leakage.** Hidden slugs are excluded from corpus and links.
- **Access control.** The route uses the same portal scoping as the benefit hub GET;
  no plan can read another plan's placements.

## 13. Acceptance criteria

1. "How do I take a loan?" returns `401k-loans`, its quick answer, its first steps, the
   "Request a loan" CTA and a `/{plan}/retirement#401k-loans` deep link when placed.
2. "What does COBRA stand for?" returns the COBRA answer on Group Health.
3. "Where do I find my pay stub?" returns the Employee Resources topic (when the
   feature is on) and links `/{plan}/employee-resources#pay-stubs-direct-deposit`.
4. "How do I log in?" returns the login link (or the Account Access guidance when no
   login URL is set).
5. "I want to talk to someone" returns the advisor booking link and the Have Questions
   band, with the HR `mailto:`/`tel:` when a key contact carries one.
6. A question matching nothing returns suggestion chips, not an invented answer.
7. A topic hidden by the advisor is never answered and never linked.
8. A library topic the plan never placed is answered, carries no dead deep link, and
   says it is not on the plan page yet.
9. Following a chat link to `#<slug>` opens that card immediately, even on the page the
   participant is already on.
10. The shell tests (FAB, greeting, Escape, colours) keep passing unchanged.
11. `npx tsc --noEmit` and `npx eslint` are clean; `npm run test:portal-hubs`,
    `npm run test:edit-benefit` and the new assistant suites are green.

## 14. Milestones

| # | Deliverable | Verification |
| --- | --- | --- |
| M1 | `lib/topics/assistant.ts`: corpus, scorer, intents, links, reply types | New `assistant.test.ts` (pure) |
| M2 | `assistant.server.ts` + `app/api/.../portal/assistant/route.ts` | `assistant-server.test.ts` + route test with mocked Prisma |
| M3 | `portal-chatbot.tsx`: structured replies, index fetch, chips, typing, links; `ClientData` field | Extended `portal-chatbot.test.tsx` |
| M4 | `hashchange` deep-link handling in `how-can-we-help-section.tsx` | One new section test |
| M5 | Register suites, docs, full verification | `test:portal-hubs`, `test:edit-benefit`, `tsc`, `eslint` |

## 15. Decisions to confirm

- **Library-wide answers.** Topics the plan never placed are still answered (the
  user's explicit requirement), with no deep link and a "not on your plan page yet"
  line. Hiding a topic by hand removes it entirely.
- **Published hubs only for links.** Disabled or invisible hubs are never linked, even
  though their library answers still exist.
- **No streaming, no LLM.** Replies render in one bubble after a short typing state.
