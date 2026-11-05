# News & Events Edit Panel — create content from the panel

**Status:** Phase A delivered — Portal Notice, News post and Pop-up are created
from the panel through the dashboard's own `MarketingAssetModal`.

Phases B and C are **partly** delivered: `WebinarCreateDialog` and
`MeetingCreateDialog` exist as standalone components and the panel hosts both, so
a meeting or webinar can be created without leaving the portal. What remains is
the other half of "one form, two hosts" — pointing the Communications pages at
these dialogs instead of their own inline copies — plus the meeting → flyer
hand-off.

> **Revision.** The first version of this plan proposed *linking out* to Communications. Discarded: the panel should let the advisor CREATE a meeting, a webinar or an announcement there and then, the way the Communications pages do. This document replaces it.

## What the page shows, and what creates it

| Page block | Data | Creator today |
| --- | --- | --- |
| Hero band | plan's Page Image Header | this panel, Section 1 |
| News posts | marketing assets `type: "news-post"` | `MarketingAssetModal` from Marketing |
| Webinars | `GET /api/webinars?placement=news-events` | a `<Dialog>` inside `webinars/page.tsx` |
| Announcement bar | marketing assets `type: "portal-notice"` (top-banner) | `MarketingAssetModal` from Marketing |
| Pop-ups | marketing assets `type: "pop-up"` | same modal |
| Meetings | **not rendered on this page** | a `<Dialog>` inside `meetings/page.tsx` |

## The three creators are three different sizes of work

### 1. Announcement / News post / Pop-up — already reusable ✅

[`marketing-asset-modal.tsx`](../../components/pages/marketing/marketing-asset-modal.tsx:1) is a standalone ~2,900-line component. It takes everything it needs as props:

```
open, onOpenChange, assetType: "flyer" | "portal-notice" | "pop-up" | "news-post",
planId, planName, planLogo, initialPortalElement, initialFlyerStep,
editingAsset, previewOnly, onSave, onEditFromPreview
```

It owns the news-post background gallery, the four-post cap, the top-banner vs pop-up vs news-post picker, and the flyer wizard. **The panel can mount it as-is.** No extraction.

### 2. Webinar — inline form, extractable ⚠️

The creator is a dialog buried in [`webinars/page.tsx`](../../app/(dashboard)/communications/webinars/page.tsx:1082): a form over `WebinarFormData` (title, description, category, placements, event date, source type, file→base64, URL, thumbnail from upload or captured frame, runtime measurement). Its plan comes from the *page's* `selectedPlan`.

Work: move that dialog into `components/webinars/webinar-form-dialog.tsx` with props
`{ open, onOpenChange, planId, planName, editingWebinar, onSaved }`, and have the dashboard page render it. The API is a plain `POST /api/webinars` / `PUT /api/webinars/:id`.

⚠️ **`POST /api/webinars` identifies the plan by `client` — the company NAME, not the id** ([`webinars/page.tsx`](../../app/(dashboard)/communications/webinars/page.tsx:799)). The panel must pass the plan's company name, which it has on `clientData`.

### 3. Meeting — inline form, heaviest extraction ⚠️⚠️

[`meetings/page.tsx`](../../app/(dashboard)/communications/meetings/page.tsx:1259) holds a dialog with meeting type, date, start/end time (with a custom parser and 15-minute slots), derived duration, format, platform, address search, RSVP link, description, max attendees, language, benefit category, timezone, **time-conflict detection against the plan's other meetings**, save-as-draft, and a post-save "duplicate?" dialog. It also depends on `useMeetingStore` for custom meeting types.

Work: `components/meetings/meeting-form-dialog.tsx` with
`{ open, onOpenChange, planId, planName, editingMeeting?, initialDate?, onSaved }`, the conflict list fetched inside it (`GET /api/meetings`), and the page rendering it. This is the same "one form, two hosts" pattern as the webinar.

**Product caveat:** a meeting is not rendered on News & Events. Creating one from this panel only makes sense if the panel then offers the follow-on that needs it — **"Create a flyer / invite from this meeting"**, which is exactly what the marketing modal's flyer mode already does (pick a meeting → flyer). So the meeting flow should end with that hand-off, not just "saved".

## Panel design

A **Create** row at the top of the panel, above the asset list:

```
[ + Portal Notice ]   [ + News post ]   [ + Webinar ]   [ + Meeting ]
```

Each opens its creator in a dialog **over the panel**, at panel width — the advisor never leaves the portal. On save:

- the public-assets cache is revalidated (`/api/marketing/assets/public*`), so `NewsPostList` / the banner / pop-ups repaint immediately;
- webinars revalidate the panel's webinar count (the portal page fetches `/api/webinars` itself, so a full `router.refresh()` is not needed — but the count in the panel must move);
- the new row appears in the panel's existing list and is editable there.

Meetings open the same creator, then prompt: *"Create a flyer for this meeting?"* → the marketing modal in flyer mode with that meeting preselected.

## Check before building

1. **Endpoint guards.** Do `POST /api/meetings`, `POST /api/webinars` and `POST /api/marketing/assets` accept a request from a portal-origin screen, or do they expect a dashboard-only permission (e.g. `meetings`, `webinars` rather than `marketing`)? The portal panel is gated by `marketing`, so a collaborator with `marketing` but not `meetings` would see a creator the API refuses. Either the panel hides per-function creators via `canEditFunction`, and/or the APIs accept `marketing`.
2. **`client` by name** for webinars — confirm the route resolves a company name unambiguously (two plans with the same name would be a bug) or add id support.
3. **Dialog inside the scaled replica.** The panel is inside `PortalCommentsZoom`; a `Dialog` portals to `document.body`, so it is not scaled — good — but it must sit above the panel's own z-tier and the floating cluster (`z-[60]` chatbot, `z-50` controls).
4. **Draft/unsaved state.** The panel is a draft with Save/Cancel. A creator that writes straight to the API (all three do) conflicts with that model: the panel must either warn that a new item is saved immediately, or the creator's save must first flush the panel's draft.

## Phases

**Phase A — Portal Notices, News posts, Pop-ups.** Mount `MarketingAssetModal` from the panel. Smallest change, highest value: these are the two blocks actually visible on the page, and the component is already reusable.

**Phase B — Webinars.** Extract `WebinarFormDialog`, host it in both places, add the panel entry.

**Phase C — Meetings.** Extract `MeetingFormDialog` (with the conflict check and the duplicate follow-up), host it in both places, and add the "create a flyer from this meeting" hand-off.

**Phase D — the panel's own polish.** A per-type *created* count/status, and replacing the bare `Draft/Published/Archived` select with the six real statuses the marketing page uses.

## Open questions

1. Phase A alone first, or all three in one pass?
2. For meetings — is the flyer hand-off the point, or do you expect the meeting itself to appear somewhere on the portal?
3. Should a per-function permission hide a creator (a collaborator with `marketing` but not `webinars` sees no "+ Webinar"), or should all four always render and the API decide?
4. Does creating from the panel write immediately (the creators' behaviour today), or should the panel's Save bar gate it too?
