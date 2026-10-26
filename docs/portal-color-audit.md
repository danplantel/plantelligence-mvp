# Portal colour audit — Primary (`brandColor`) vs Secondary (`secondaryColor`)

Scope: every page under [`app/(portal)/[id]`](../app/(portal)/[id]) — the landing page, the four benefit hubs, My Benefits Team, News & Events, the not-found page — plus the portal header (in the layout) and the footer it feeds. Read-only audit: nothing was changed to produce this.

## 1. Where the colours come from

| Source | Primary | Secondary |
| --- | --- | --- |
| Data | `Client.brandColor` | `Client.secondaryColor` |
| Layout ([`layout.tsx:78`](../app/(portal)/[id]/layout.tsx:78)) | `clientData?.brandColor \|\| "#1F3A60"` | `clientData?.secondaryColor \|\| "#6B7280"` |
| Landing page ([`page.tsx:119`](../app/(portal)/[id]/page.tsx:119)) | passes the raw value, **no fallback** | passes the raw value, **no fallback** |
| Landing composition ([`client-portal.tsx:177`](../components/pages/client-portal/client-portal.tsx:177)) | `\|\| "#1F3A60"` | `\|\| "#6B7280"` |
| The four hubs ([retirement](../app/(portal)/[id]/retirement/page.tsx:51), [health](../app/(portal)/[id]/health-insurance/page.tsx:48), [life](../app/(portal)/[id]/life-insurance/page.tsx:48), [custom](../app/(portal)/[id]/[custom-benefit-name]/page.tsx:63)) | `\|\| "#1F3A60"` | `\|\| "#6B7280"` |
| My Benefits Team ([`page.tsx:197`](../app/(portal)/[id]/my-benefits-team/page.tsx:197)) | `\|\| "#0D315F"` | `\|\| "#C89B5B"` |
| News & Events ([`page.tsx:12`](../app/(portal)/[id]/news-events/page.tsx:12)) | `\|\| "#1F3A60"` | `\|\| "#6B7280"` |
| Not found ([`page.tsx:18`](../app/(portal)/[id]/not-found/page.tsx:18)) | `\|\| "#C5A15E"` | — (not read at all) |

The layout also publishes them as CSS variables on the portal root ([`layout.tsx:582`](../app/(portal)/[id]/layout.tsx:582)):

```tsx
"--brand-color": brandColor,
"--secondary-color": secondaryColor,
```

**Nothing consumes either variable.** A repo-wide search for `var(--brand-color)` / `var(--secondary-color)` returns zero hits, so every surface re-receives the colours as props. The variables are decoration today.

## 2. What each surface does with them

### Header — [`portal-header.tsx`](../components/pages/client-portal/sections/portal-header.tsx:99)

| Element | Colour | Contrast handling |
| --- | --- | --- |
| Active nav pill (Home, hubs, My Benefits Team, News & Events), open "Your Benefits" trigger | **primary** fill, `color: "#fff"` (`:441`, `:500`, `:658`, `:725`, `:756`, `:808`) | none — hard-coded white |
| **Login** button (hub pages only) | **secondary** fill | `readableColor(secondaryColor)` (`:599`) |

So the header is the only surface that assigns *secondary* to a call to action, and the only one that checks contrast for it.

### Footer — [`layout.tsx:601`](../app/(portal)/[id]/layout.tsx:601)

Takes neither colour directly: `brandColor={footerBgColor}`, where `footerBgColor` is `resolvePortalFooterColor(disclaimers, brandColor, secondaryColor)` — the plan may pick primary, secondary or a custom colour, so the footer's "brand colour" is not necessarily the primary.

### Landing page — [`client-portal.tsx`](../components/pages/client-portal/client-portal.tsx:153)

| Section | Primary | Secondary |
| --- | --- | --- |
| `PortalHero` | hero heading (`portal-hero.tsx:340`) | primary CTA fill, `text-white` (`:563`) |
| `PortalMission` | via props (`client-portal.tsx:259`) | via props |
| `PortalBenefits` | section heading + benefit-card titles (`portal-benefits.tsx:317`, `:421`, `:457`) | CTA fill, `text-white` (`:501`, `:512`) |
| `SomethingChanged` | heading (`client-portal.tsx:116`) | CTA fill (`:133`) |
| `PortalTeam` | via props | via props |
| News/announcements on landing | heading (`news-events-announcements.tsx:79`) | CTA fill, `color: "white"` (`:133`) |

Inside the hero, over an image the text colours stop following the palette: `#ffffff`, `#b68f40`, `#5c4106`, `#020617` (`portal-hero.tsx:397–510`) and `bg-[#FEFCF7]` (`:187`). The **heading** still uses `brandColor`, so a dark brand over a dark hero photo has no guaranteed legibility — and the gold `#b68f40` is unrelated to the plan's secondary.

### Benefit hubs (retirement / health / life / custom)

Order of sections and the role each plays:

| Section | Primary | Secondary |
| --- | --- | --- |
| `PortalWelcomeBanner` | only the 2px line at the bottom of the banner (`portal-welcome-banner.tsx:718`) | "Schedule…" CTA fill, `text-white` (`:613`, `:624`, `:632`) |
| `BenefitsVideoSection` | passed but **unused** for text: only forwarded to the rail (defaults `#0FB879`/`#C89B5B`, `:111`) | subtitle (`:269`) and Watch Now fill, `text-white` (`:386`) |
| `HowCanWeHelpSection` | headings, card titles, tile outline, selection ring, `${brandColor}14` wash (`:892`, `:923`, `:983`, `:547`) | CTA fill w/ `readableColor` (`:1020`) **and** outline CTA (`:628`) |
| `FAQs` | heading (`faq-section.tsx:207`) | open-item header fill + link colour (`:113`, `:160`) with hard-coded `#ffffff` text (`:121`, `:129`) |
| `BenefitDocumentSection` | headings, borders `${brandColor}26/40/80`, preview caret, download fill (`:479`, `:794`, `:1078`) | arrives as **`accentColor`**: icon chips `${accentColor}1F`, CTA fill that swaps to primary on hover (`:954`, `:1000`) |
| `HaveQuestions` | heading + key-contact pill + card accent (`have-questions.tsx:70`, card) | forwarded to the card only |
| `WebinarsCarousel` (in the video section) | overridden to `headingColor="#ffffff"` (`benefits-video-section.tsx:505`) | unused there |

The banner deserves a note: the page passes `brandColor` **and** `secondaryColor`, but `brandColor` only paints a hairline. The heading, name and signature are `text-white`/`text-gray-*`, i.e. the plan's primary colour is almost absent from the most prominent section of every hub.

### My Benefits Team — [`my-benefits-team/page.tsx`](../app/(portal)/[id]/my-benefits-team/page.tsx:196)

Passes both colours down to five card layouts. Inside the cards the roles invert:

- [`primary-contact-card.tsx:108`](../components/pages/my-benefits-team/primary-contact-card.tsx:108): `backgroundColor = cardBackgroundColor || baselineBackgroundColor || effectiveSecondaryColor` — **secondary is the card's surface**, `readableColor` picks the text, and primary is the accent.
- [`small-vertical-card.tsx:150`](../components/pages/my-benefits-team/small-vertical-card.tsx:150): the same expression **defaults to `"#ffffff"`**, so on the compact cards secondary is not the surface at all.
- Both honour per-contact overrides (`cardPrimaryColor`, `cardSecondaryColor`, `cardBackgroundColor`).

The page also hard-codes `cardBackgroundColor: "#ffffffea"` for the primary card (`:737`), which bypasses whatever the plan's secondary is.

### News & Events — [`news-events/page.tsx`](../app/(portal)/[id]/news-events/page.tsx:11)

Falls back per colour independently; the banner, posts and `WebinarsDashboard` all use the same pair. `WebinarsSection` (the meetings/replays band) renders its own headings in `#002B5B` unless a colour is passed.

### Not found — [`not-found/page.tsx`](../app/(portal)/[id]/not-found/page.tsx:18)

Uses primary only, as a button fill with `color: "#000"` (`:47`), on its own gold fallback `#C5A15E`.

### Chatbot — [`portal-chatbot.tsx`](../components/pages/client-portal/sections/portal-chatbot.tsx:41)

Primary: FAB, sheet header, the visitor's own bubbles. Secondary: the send button, with `readableColor`. This is the cleanest mapping in the portal.

## 3. Component defaults, side by side

Every component carries its own fallback pair, and six different pairs are in play:

| Component | Primary default | Secondary default |
| --- | --- | --- |
| `PortalHeader` | `#1F3A60` | `#6B7280` |
| `PortalWelcomeBanner` | `#1F3A60` | `#C89B5B` |
| `BenefitsVideoSection` | `#0FB879` (green) | `#C89B5B` |
| `HowCanWeHelpSection` | `#002B5B` | `#E6C47A` |
| `BenefitDocumentSection` | `#002B5B` | `#E6C47A` |
| `FAQSection` | `#1F3A60` | `#6B7280` |
| `HaveQuestions` | `#1F3A60` | `#6B7280` |
| `WebinarsCarousel` | `#002B5B` | `#FBBF24` |
| `PortalBenefits` | `#0D315F` | `#C89B5B` |
| `NewsEventsAnnouncements` | `#1F3A60` | `#C9A961` |
| `PortalChatbot` | `#1F3A60` | `#6B7280` |

Five blues (`#1F3A60`, `#0D315F`, `#002B5B`, plus `#111828`/`#0F172A` as fixed surfaces), five accents (`#6B7280`, `#C89B5B`, `#E6C47A`, `#FBBF24`, `#C9A961`). They only matter when a prop is missing — which is exactly what the wizard previews and any new host rely on, so a preview and the published hub can look different for the same plan.

## 4. Findings

| # | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| F1 | `--brand-color` / `--secondary-color` are set on the portal root and consumed nowhere; all styling is prop-driven. | Low (dead code) | `layout.tsx:582`, zero `var(--…)` hits |
| F2 | Roles are inverted between chrome and cards: in the header/sections **secondary** is the CTA fill, but on the primary contact card **secondary is the card's background** (`readableColor` text) while the compact card uses white instead. | High (semantics) | `portal-header.tsx:599`, `primary-contact-card.tsx:108`, `small-vertical-card.tsx:150` |
| F3 | **White text on the accent.** Six CTA/accordion fills hard-code `text-white` with no `readableColor`, and every default accent is light (gold/amber/grey): white on `#C89B5B` ≈ 2.0:1, on `#E6C47A` ≈ 1.6:1, on `#FBBF24` ≈ 1.6:1 — all below the 4.5:1 body / 3:1 UI minimum. | High (a11y) | `faq-section.tsx:113-129`, `portal-welcome-banner.tsx:613`, `portal-benefits.tsx:501`, `news-events-announcements.tsx:133`, `benefits-video-section.tsx:386`, `portal-hero.tsx:563` |
| F4 | **The Health hub's banner ignores the plan's secondary colour** — `secondaryColor` is not passed, so it uses the component default `#C89B5B`. Retirement, Life and Custom pass it. | High (bug) | `health-insurance/page.tsx:173-185` vs `retirement/page.tsx:184-190` |
| F5 | **The hub banner barely uses primary**: heading, name, signature and body are white/grey; `brandColor` paints only a 2px line. | Medium (design) | `portal-welcome-banner.tsx:489`, `:547`, `:569`, `:718` |
| F6 | **Landing hero text bypasses the palette** over images (`#ffffff`, `#b68f40`, `#5c4106`, `#020617`), while the heading still uses primary → no guaranteed contrast, and a gold unrelated to the plan. | High (a11y/design) | `portal-hero.tsx:397-510` |
| F7 | **Fallback drift**: three different primary fallbacks (`#1F3A60`, `#0D315F`, `#002B5B`) and four accents across pages and components, so a plan with an empty palette renders differently per page (and per preview). | Medium | §1 and §3 tables |
| F8 | `BenefitsVideoSection` receives `brandColor` but never uses it for text; it also forces the rail heading to `#ffffff`, so the palette is absent from that whole section. | Medium | `benefits-video-section.tsx:111`, `:505` |
| F9 | Header active states use `color: "#fff"` on a **primary** fill — the same contrast risk as F3 for a pale primary. | Medium (a11y) | `portal-header.tsx:441`, `:500`, `:658`, `:725`, `:756`, `:808` |
| F10 | `BenefitDocumentSection` receives secondary as **`accentColor`** and primary as `brandColor`, then swaps them on hover — a third meaning for the same two tokens. | Medium | `benefit-document-section.tsx:1000-1011`, `:1078-1091` |
| F11 | Hard-coded surfaces/typography that ignore the palette: video band `#111828`, banner `#0F172A`, hero `#FEFCF7`, and **`#002B5B` four times** in the meetings/replays band (meeting card title, band heading, replay card title, modal title — the band never receives the palette), plus the MBM primary card `#ffffffea`. | Low/Medium | `benefits-video-section.tsx:250`, `portal-welcome-banner.tsx:404`, `portal-hero.tsx:187`, `videos-card-section.tsx:303`/`470`/`942`/`989`, `my-benefits-team/page.tsx:737` |
| F12 | Two pages read the palette differently: Landing passes the raw `clientData` values with no fallback (dependent on `ClientPortal`'s), News & Events and the hubs each fall back locally; Not Found ignores secondary entirely and uses its own `#C5A15E`. | Low | `page.tsx:119`, `news-events/page.tsx:12`, `not-found/page.tsx:18` |

## 5. A rule set worth converging on

One sentence per token, then every surface follows it:

- **Primary = identity.** Headings, the plan's name, active nav state, card accents, the FAB. Never a surface behind small text without `readableColor`.
- **Secondary = action/emphasis.** CTA fills, link text, icon chips, progress/selected states. Always paired with `readableColor(secondaryColor)` for its foreground.
- **Surfaces are neutral** (`#ffffff`, `#F8FAFC`, the plan's chosen card background) unless the advisor explicitly set one.

Concretely:

1. One shared resolver — e.g. `resolvePortalPalette(clientData)` — returning `{ primary, secondary, onPrimary, onSecondary }` with a **single** fallback pair, used by the layout, the landing page, the hubs, My Benefits Team and News & Events. That removes F7 and F12, and gives `--brand-color`/`--secondary-color` something to hold (or lets the dead variables go, F1).
2. Replace every hard-coded `text-white` on an accent fill with `readableColor(...)` (F3, F9) — six sites plus four header states.
3. Decide what secondary means on contact cards. Either the primary card's surface follows the shared rule (white/neutral surface, secondary as accent) or the compact card adopts secondary as its surface; today they disagree (F2).
4. Pass the missing `secondaryColor` to the Health hub's banner (F4) — a one-line fix that makes the four hubs consistent.
5. Give the banner and the hero a palette-aware text colour: primary heading on the neutral scrim, and `onPrimary`/white chosen by `readableColor` instead of fixed hexes (F5, F6).
6. Keep `accentColor` as an alias where it already reads well (documents), documented as "secondary" in one place rather than swapped with primary on hover (F10).

## 6. How to re-verify after any fix

- `pnpm test:portal-hubs`, `pnpm test:portal-news`, `pnpm test:portal-team`, `pnpm test:portal-landing`, `pnpm test:portal-navbar` — each runner already asserts the colours each surface receives (e.g. `portal-welcome-banner` brand, `have-questions` label colour, `news-events` per-colour fallbacks).
- Set a plan to a **pale** primary and a **pale** secondary and walk each page: today the FAQ open header, the banner CTA, the benefits CTA, the announcements CTA and the hero CTA all lose their label.
