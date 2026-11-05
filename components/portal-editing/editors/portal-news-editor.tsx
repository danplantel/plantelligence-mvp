"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { marketingAssetStatusClass } from "@/lib/marketing/asset-status";
import { formatTimeAbbrev } from "@/lib/meetings/time-slots";
import {
  PORTAL_ASSET_BODY_MAX,
  PORTAL_ASSET_HEADLINE_MAX,
} from "@/lib/marketing/asset-limits";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MeetingCreateDialog,
  type MeetingDraft,
} from "@/components/meetings/meeting-create-dialog";
import { WebinarCreateDialog } from "@/components/webinars/webinar-create-dialog";
import { notifyPortalMeetingsChanged } from "@/lib/portal-data-events";
import { PortalEditorActionBar } from "@/components/portal-editing/portal-editor-action-bar";
import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import MarketingAssetModal, {
  type AssetType,
  type PortalNoticeElement,
} from "@/components/pages/marketing/marketing-asset-modal";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { brandImagesFromClient } from "@/components/portal-editing/portal-brand-images";
import { useClientPortal } from "@/contexts/client-portal-context";
import type { BrandImagesData } from "@/types/new-client-wizard";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

/** Every cached public-assets key — the portal's own copies of these rows. */
const PUBLIC_ASSETS_PREFIX = "/api/marketing/assets/public";

interface MarketingAssetDraft {
  id: string;
  type: string;
  status: string;
  headline: string;
  body: string;
  ctaText: string;
  /** The window the row is shown on the portal, as stored by the API. */
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * A "YYYY-MM-DD" (or full ISO) value as a local calendar day.
 *
 * Deliberately not `new Date(value)`: a bare date parses as UTC midnight, which
 * lands on the day before in every US timezone — the same trap `lib/date` exists
 * to avoid.
 */
function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Props for a control that lives INSIDE an accordion header.
 *
 * The header is one big `<button>`, so these controls are `role="button"` spans
 * — a real nested button is invalid — and they must stop the click from also
 * toggling the row. Without this, opening the confirmation (or the full editor)
 * would expand the accordion underneath it.
 */
function headerAction(action: () => void) {
  const run = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };
  return {
    onClick: run,
    onKeyDown: (event: {
      key: string;
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      run(event);
    },
  };
}

/** Meeting statuses, in the same chip language the assets use. */
const MEETING_STATUS_CLASSES: Record<string, string> = {
  Upcoming: "border-blue-200 bg-blue-50 text-blue-700",
  Past: "border-gray-200 bg-gray-100 text-gray-700",
  Draft: "border-amber-200 bg-amber-50 text-amber-700",
};

function meetingStatusClass(status?: string | null): string {
  return MEETING_STATUS_CLASSES[status ?? ""] ?? MEETING_STATUS_CLASSES.Upcoming;
}

/** "Tue, Mar 3" — the day a meeting sits on, as a local calendar day. */
function formatMeetingDay(value?: string | null): string {
  const date = parseDay(value);
  return date
    ? date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "No date";
}

/** "Mar 1 – Mar 31", or the single end that is set. */
function formatAssetWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const format = (value: string | null | undefined) => {
    const date = parseDay(value);
    return date
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
  };
  const from = format(start);
  const to = format(end);
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return "No dates";
}

/**
 * The things an advisor can start from this panel.
 *
 * The first three are the page's own content types plus the announcement bar the
 * whole portal shares — not the flyer, which never appears on the portal. Each
 * opens the dashboard's `MarketingAssetModal`, so there is one creator, not two.
 *
 * "Portal Notice" passes `top-banner` as the portal element: that skips the
 * modal's Top Banner / Pop-up / Post picker and goes straight to the banner
 * form, which is what the label promises. The name matches the Marketing tool's
 * own — Portal Notice is the asset type, its Top Banner element is what the bar
 * above every portal page renders.
 *
 * Meetings and webinars are created in place too, through the shared dialogs
 * lifted out of their dashboard pages (`MeetingCreateDialog`,
 * `WebinarCreateDialog`), so the advisor never leaves the portal.
 */
const CREATE_OPTIONS: {
  label: string;
  hint: string;
  /** A marketing asset this panel can create in place. */
  type?: AssetType;
  element?: PortalNoticeElement;
  /** A meeting or webinar, created by its own dialog. */
  inline?: "meeting" | "webinar";
}[] = [
  {
    label: "Portal Notice",
    hint: "The bar above every portal page",
    type: "portal-notice",
    element: "top-banner",
  },
  {
    label: "News post",
    hint: "A card in this page's list",
    type: "news-post",
  },
  {
    label: "Pop-up",
    hint: "Shown when a visitor arrives",
    type: "pop-up",
  },
  {
    label: "Meeting",
    hint: "Schedule a session",
    inline: "meeting",
  },
  {
    label: "Webinar",
    hint: "Publish a video or replay",
    inline: "webinar",
  },
];

/**
 * The three fixed asset sections, in the order the panel shows them.
 *
 * One section per asset TYPE, not per asset: a second pop-up appends a row to
 * "Pop-Ups" instead of inserting another numbered section and renumbering
 * everything below it. `type` is `MarketingAsset.type` as the API spells it.
 */
const ASSET_GROUPS: { type: AssetType; title: string; number: number }[] = [
  { type: "pop-up", title: "Pop-Ups", number: 3 },
  { type: "news-post", title: "News Posts", number: 4 },
  { type: "portal-notice", title: "Portal Notices", number: 5 },
];

/**
 * News & Events editor — the page's hero background, then the published
 * notices, pop-ups and news posts.
 *
 * The whole panel is a DRAFT, like the Home and benefit-hub panels: the page
 * beside it repaints on every change (the hero through `patchClientData`, the
 * rows through the public-assets cache), but nothing is written until Save.
 * Cancel revalidates both sources, which is what puts the saved values back.
 *
 * The hero background is the plan's "Page Image Header" Brand Images slot — the
 * same control Create Client Step 1 shows, so the upload / Choose Default Image /
 * crop flow and the News & Events preview are identical. Saving goes through the
 * same plan PUT the Home editor uses, where the route converts an uploaded data
 * URL to an R2 object and writes the legacy `secondaryBannerImg` column this page
 * reads.
 */
export function PortalNewsEditor() {
  const {
    planId,
    beginSave,
    finishSave,
    failSave,
    resetSave,
    patchClientData,
    refetchPortal,
  } = usePortalEditing();
  const { clientData } = useClientPortal();
  const { mutate } = useSWRConfig();

  // The marketing API resolves a plan by its DATABASE id: `assertOwnership` runs
  // `findUnique({ where: { id } })` and the POST stores that value. The portal
  // route parameter is the plan's slug, so the portal payload's own `id` is used
  // here — it is the same value this page hands `NewsPostList`. The parameter
  // stays as the fallback for previews, which have no payload.
  const portalPlanId = String((clientData as any)?.id || planId || "");
  const planDisplayName = clientData?.companyName || "Your Company";

  const key = portalPlanId
    ? `/api/marketing/assets?clientId=${portalPlanId}`
    : null;
  const { data, mutate: mutateList } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });

  // The plan's meetings, so one scheduled from Section 2 is visible here — and
  // so the advisor can see what the page's schedule already holds. Same key the
  // creator's clash check uses, so the two share one cache.
  const meetingsKey = portalPlanId
    ? `/api/meetings?clientId=${portalPlanId}`
    : null;
  const { data: meetingsData, mutate: mutateMeetings } = useSWR(
    meetingsKey,
    fetcher,
    { revalidateOnFocus: false },
  );
  const meetings: MeetingDraft[] = Array.isArray(meetingsData?.data)
    ? meetingsData.data
    : [];
  const assets: MarketingAssetDraft[] = Array.isArray(data?.data)
    ? data.data
    : [];

  const [drafts, setDrafts] = useState<Record<string, MarketingAssetDraft>>({});
  const [isDirty, setIsDirty] = useState(false);

  /** Which creator is open, and what it creates. `null` renders none at all. */
  const [creator, setCreator] = useState<{
    type: AssetType;
    element?: PortalNoticeElement;
  } | null>(null);

  /** The asset awaiting a delete confirmation, if any. */
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    headline: string;
  } | null>(null);
  /**
   * The asset whose DELETE is in flight.
   *
   * Its own id, not a bare flag: `pendingDelete` is cleared the moment the
   * confirmation closes, so the row could not tell that IT was the one being
   * deleted — which is exactly what left the progress invisible.
   */
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  /**
   * The asset open in the FULL editor.
   *
   * The four inline fields are the fast path; everything else a type owns —
   * button and background colours, the news-post background image, start/end
   * dates, the pop-up's target pages and its "show every visit" flag, the
   * notice's countdown — lives in the Marketing tool's own modal. Mounting it
   * here with `editingAsset` edits every property in place, with the same
   * validation and preview the dashboard shows, instead of a second copy of
   * forty fields that would drift from it.
   */
  const [fullEditor, setFullEditor] = useState<MarketingAssetDraft | null>(null);

  /** The meeting / webinar creator that is open, if any. */
  const [inlineCreator, setInlineCreator] = useState<
    "meeting" | "webinar" | null
  >(null);

  /** The meeting open in the edit dialog, if any. */
  const [editingMeeting, setEditingMeeting] = useState<MeetingDraft | null>(
    null,
  );
  const [meetingPendingDelete, setMeetingPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  /** The meeting whose DELETE is in flight — see `deletingAssetId`. */
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(
    null,
  );

  /**
   * Re-read both copies of the asset list: the panel's own, and the portal's
   * public one.
   *
   * Creating and deleting are the two actions that change the list itself —
   * editing a field only changes a row, which the draft already owns.
   */
  const refreshAssets = useCallback(async () => {
    if (key) await mutateList();
    await mutate((cacheKey: string | null) =>
      typeof cacheKey === "string"
        ? cacheKey.startsWith(PUBLIC_ASSETS_PREFIX)
        : false,
    );
  }, [key, mutateList, mutate]);

  /**
   * Re-read the meetings list, and tell the page a meeting changed.
   *
   * Section 6 owns one copy of that list; the video section further down the
   * page owns another, fetched on mount. Creating a meeting has to move both
   * immediately — before any Save — or the advisor schedules a session and
   * watches nothing happen.
   */
  const refreshMeetings = useCallback(async () => {
    await mutateMeetings();
    notifyPortalMeetingsChanged();
  }, [mutateMeetings]);

  /** Delete the meeting the advisor confirmed. Writes straight through. */
  const deleteMeeting = useCallback(async () => {
    const id = meetingPendingDelete?.id;
    if (!id) return;
    setMeetingPendingDelete(null);
    setDeletingMeetingId(id);
    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Could not delete this meeting.");
      }
      await refreshMeetings();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not delete this meeting.";
      // The panel's bar sits at the bottom, out of sight once the list scrolled;
      // the toast is what the advisor actually sees.
      failSave(message);
      toast.error(message);
    } finally {
      setDeletingMeetingId(null);
    }
  }, [meetingPendingDelete, refreshMeetings, failSave]);

  /**
   * Delete the asset the advisor confirmed.
   *
   * Unlike the fields around it, this cannot be a draft: the row stops existing
   * the moment the API says so. Its draft goes with it, and if it was the only
   * edited row the Save bar returns to idle.
   */
  const deleteAsset = useCallback(async () => {
    const id = pendingDelete?.id;
    if (!id) return;
    setPendingDelete(null);
    setDeletingAssetId(id);
    try {
      const response = await fetch(`/api/marketing/assets/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Could not delete this asset.");
      }

      dirtyAssetsRef.current.delete(id);
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setIsDirty(heroDirtyRef.current || dirtyAssetsRef.current.size > 0);
      await refreshAssets();
    } catch (error) {
      // The panel's own error bar: the row is still there, and so is the reason.
      const message =
        error instanceof Error
          ? error.message
          : "Could not delete this asset.";
      failSave(message);
      toast.error(message);
    } finally {
      setDeletingAssetId(null);
    }
  }, [pendingDelete, refreshAssets, failSave]);

  // The hero draft, and the flags the Save/Cancel handlers read. Refs because
  // the handlers are called from the action bar, outside the render that last
  // changed a field.
  const savedBrandImages = useMemo(
    () => brandImagesFromClient(clientData as Record<string, any> | null),
    [clientData],
  );
  const [brandImages, setBrandImages] = useState<BrandImagesData>(
    savedBrandImages,
  );
  const brandImagesRef = useRef<BrandImagesData>(savedBrandImages);
  const heroDirtyRef = useRef(false);
  const dirtyAssetsRef = useRef<Set<string>>(new Set());
  const draftsRef = useRef<Record<string, MarketingAssetDraft>>({});
  draftsRef.current = drafts;

  // Re-seed the hero from the plan whenever it reloads and nothing is drafted.
  // Guarded by the serialized value: a caller that hands us an equal-but-new
  // object every render (or a context that re-creates it) must not re-render
  // forever.
  const seededHeroRef = useRef<string>("");
  useEffect(() => {
    const json = JSON.stringify(savedBrandImages);
    if (heroDirtyRef.current) {
      seededHeroRef.current = json;
      return;
    }
    if (seededHeroRef.current === json) return;
    seededHeroRef.current = json;
    brandImagesRef.current = savedBrandImages;
    setBrandImages(savedBrandImages);
  }, [savedBrandImages]);

  // Re-seed each row from the server list, keeping rows the advisor has edited.
  useEffect(() => {
    setDrafts((previous) => {
      const next: Record<string, MarketingAssetDraft> = {};
      let changed = Object.keys(previous).length !== assets.length;
      assets.forEach((asset) => {
        const draft = previous[asset.id];
        if (draft && dirtyAssetsRef.current.has(asset.id)) {
          next[asset.id] = draft;
          return;
        }
        next[asset.id] = { ...asset };
        if (
          !draft ||
          draft.headline !== asset.headline ||
          draft.body !== asset.body ||
          draft.ctaText !== asset.ctaText ||
          draft.status !== asset.status
        ) {
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [assets]);

  /** Repaint the portal's copy of one asset from the draft (no save). */
  const patchPublicAssets = useCallback(
    (id: string, patch: Partial<MarketingAssetDraft>) => {
      void mutate(
        (cacheKey: string | null) =>
          typeof cacheKey === "string" &&
          cacheKey.startsWith(PUBLIC_ASSETS_PREFIX),
        (current: any) =>
          Array.isArray(current?.data)
            ? {
                ...current,
                data: current.data.map((asset: any) =>
                  asset?.id === id ? { ...asset, ...patch } : asset,
                ),
              }
            : current,
        { revalidate: false },
      );
    },
    [mutate],
  );

  const update = useCallback(
    (id: string, patch: Partial<MarketingAssetDraft>) => {
      dirtyAssetsRef.current.add(id);
      setIsDirty(true);
      setDrafts((previous) => ({
        ...previous,
        [id]: { ...previous[id], ...patch },
      }));
      patchPublicAssets(id, patch);
    },
    [patchPublicAssets],
  );

  /** Live-preview the Page Image Header while the advisor adjusts it. */
  const changeBrandImages = useCallback(
    async (next: BrandImagesData) => {
      const banner = next.secondaryBanner ?? null;
      brandImagesRef.current = next;
      heroDirtyRef.current = true;
      setIsDirty(true);
      setBrandImages(next);
      patchClientData({
        brandImages: next,
        secondaryBannerImg: banner?.url ?? "",
        secondaryBannerImgName: banner?.fileName ?? "",
      });
    },
    [patchClientData],
  );

  /** Persist the drafted hero + every edited row. Only the bar calls this. */
  const save = useCallback(async () => {
    if (!planId) return;
    const heroDirty = heroDirtyRef.current;
    const assetIds = Array.from(dirtyAssetsRef.current);
    if (!heroDirty && assetIds.length === 0) return;

    beginSave();
    try {
      if (heroDirty) {
        const response = await fetch(`/api/clients/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          // The route turns the uploaded data URL into an R2 object and writes
          // the legacy `secondaryBannerImg` column this page reads.
          body: JSON.stringify({ brandImages: brandImagesRef.current }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Could not save the header image.");
        }
      }

      for (const id of assetIds) {
        const draft = draftsRef.current[id];
        if (!draft) continue;
        const response = await fetch(`/api/marketing/assets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headline: draft.headline,
            body: draft.body,
            ctaText: draft.ctaText,
            status: draft.status,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Could not save this asset.");
        }
      }

      heroDirtyRef.current = false;
      dirtyAssetsRef.current.clear();
      setIsDirty(false);
      finishSave();

      // The saved rows are the source of truth now.
      if (key) await mutateList();
      await mutate((cacheKey: string | null) =>
        typeof cacheKey === "string"
          ? cacheKey.startsWith(PUBLIC_ASSETS_PREFIX)
          : false,
      );
      if (heroDirty) await refetchPortal();
    } catch (error) {
      // Keep the draft and its preview so the advisor can retry.
      failSave(
        error instanceof Error ? error.message : "Could not save these changes.",
      );
    }
  }, [planId, key, mutateList, mutate, beginSave, finishSave, failSave, refetchPortal]);

  /** Throw the draft away: revalidate both sources and re-seed from them. */
  const cancel = useCallback(async () => {
    heroDirtyRef.current = false;
    dirtyAssetsRef.current.clear();
    setIsDirty(false);
    resetSave();

    await refetchPortal();
    if (key) await mutateList();
    await mutate((cacheKey: string | null) =>
      typeof cacheKey === "string"
        ? cacheKey.startsWith(PUBLIC_ASSETS_PREFIX)
        : false,
    );
  }, [key, mutateList, mutate, refetchPortal, resetSave]);

  return (
    <PortalEditorShell
      footer={
        <PortalEditorActionBar
          isDirty={isDirty}
          onSave={() => void save()}
          onCancel={() => void cancel()}
        />
      }
    >
      <div className="space-y-8">
        {/* The page's hero background — the same "Page Image Header" slot Create
            Client Step 1 offers, with the same upload / gallery / crop flow. */}
        <section className="space-y-4">
          <SectionHeader number={1} title="Hero Background" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The image behind this page&rsquo;s &ldquo;News & Events&rdquo;
            title. It fills a band 400&nbsp;px tall on a desktop screen
            (1440&times;400 is the recommended image), so keep the subject
            centred — shorter screens crop the edges. This is the plan&rsquo;s
            Page Image Header, so it is also the default header on the
            portal&rsquo;s other interior pages.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <BrandImagesSection
              brandImages={brandImages}
              visibleSlots={["secondaryBanner"]}
              onBrandImagesChange={changeBrandImages}
              logoUrl={clientData?.companyLogo ?? null}
              companyName={clientData?.companyName}
              // The live page is already beside this panel, so the "Preview in
              // News & Events Header" mock-up (and its dialog) is redundant.
              showNewsEventsPreview={false}
            />
          </div>
        </section>

        {/* Creating is the one thing the rows below cannot do: they edit what
            already exists. This section starts a new one without leaving the
            portal, using the Marketing tool's own creator. */}
        <section className="space-y-4">
          <SectionHeader number={2} title="Create Content" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            A new item is saved the moment its editor saves — the Save bar at the
            bottom of this panel covers the fields below, not what you create
            here. A news post needs a headline, a body and its own background
            image, and a plan can carry up to four.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CREATE_OPTIONS.map((option) => {
              const className =
                // A light lift on hover, so the row reads as five buttons
                // rather than five panels. Kept to a single pixel and a soft
                // shadow — this is chrome beside a live page, not a landing
                // page.
                "group rounded-lg border border-muted bg-white px-3 py-2.5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent-blue/50 hover:bg-accent-blue/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue dark:bg-gray-800";
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    if (option.inline) {
                      setInlineCreator(option.inline);
                      return;
                    }
                    setCreator({
                      type: option.type as AssetType,
                      element: option.element,
                    });
                  }}
                  className={className}
                >
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    + {option.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* One section per asset TYPE. The rows are collapsed accordions: a plan
            can carry several pop-ups, posts and notices, and expanding every one
            at once made the panel a wall of fields. */}
        {ASSET_GROUPS.map((group) => {
          const groupAssets = assets.filter(
            (asset) => asset.type === group.type,
          );
          return (
            <section key={group.type} className="space-y-3">
              <SectionHeader
                number={group.number}
                title={`${group.title} (${groupAssets.length})`}
              />
              {groupAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No {group.title.toLowerCase()} yet — start one above.
                </p>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {groupAssets.map((asset) => {
                    const draft = drafts[asset.id] ?? asset;
                    // While this row's delete is in flight, it says so: the
                    // confirmation has closed and the row is still there until
                    // the API answers, so silence reads as "nothing happened".
                    const isRowDeleting = deletingAssetId === asset.id;
                    return (
                      <AccordionItem
                        key={asset.id}
                        value={asset.id}
                        className={cn(
                          "rounded-lg border border-muted bg-white px-3 dark:bg-gray-800",
                          isRowDeleting && "opacity-60",
                        )}
                      >
                        <AccordionTrigger className="py-2.5 text-left text-sm hover:no-underline">
                          {/* The headline takes the free space, so the status
                              chip is pushed to the end of the row — immediately
                              left of the chevron, where a status reads as a
                              property of the row rather than of its title. */}
                          <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
                            <span className="min-w-0 flex-1 truncate text-left font-medium text-gray-900 dark:text-gray-100">
                              {draft.headline?.trim() || "(no headline)"}
                            </span>
                            {/* The row's window, so a collapsed list still says
                                when each asset is live. */}
                            <span
                              title={`${draft.startDate || "no start"} → ${
                                draft.endDate || "no end"
                              }`}
                              className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground"
                            >
                              {formatAssetWindow(draft.startDate, draft.endDate)}
                            </span>
                            {/* The publishing status, in the Marketing tool's own
                                colours — the same map its asset list uses. */}
                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                marketingAssetStatusClass(draft.status),
                              )}
                            >
                              {draft.status}
                            </span>
                            {/* The delete control, left of the chevron. It is a
                                `role="button"` span, not a <button>: the whole
                                header IS a button, and a real one nested inside
                                it is invalid HTML — the document swallows the
                                inner click and the row cannot be toggled from
                                the arrow any more. The stopPropagation is what
                                keeps opening the confirmation from also opening
                                the row. */}
                            {isRowDeleting ? (
                              <Loader2
                                role="status"
                                aria-label="Deleting…"
                                className="h-3.5 w-3.5 shrink-0 animate-spin text-red-500"
                              />
                            ) : null}
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Edit all fields for ${
                                draft.headline?.trim() || "this asset"
                              }`}
                              title="Edit all fields"
                              {...headerAction(() => setFullEditor(asset))}
                              className="shrink-0 cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-accent-blue/10 hover:text-accent-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                            >
                              <PenLine className="h-3.5 w-3.5" />
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Delete ${
                                draft.headline?.trim() || "this asset"
                              }`}
                              title="Delete"
                              {...headerAction(() =>
                                setPendingDelete({
                                  id: asset.id,
                                  headline: draft.headline || asset.type,
                                }),
                              )}
                              className="shrink-0 cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3">
                          <div className="space-y-3">
                            {/* The inline fields below are the ones worth
                                changing without leaving the page. Everything
                                else opens the full editor. */}
                            <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-700">
                              <p className="text-[11px] leading-snug text-muted-foreground">
                                These fields save with the panel. Colours,
                                images, dates and page targeting open in the
                                full editor.
                              </p>
                              <button
                                type="button"
                                onClick={() => setFullEditor(asset)}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:border-accent-blue/50 hover:bg-accent-blue/5 dark:border-gray-600 dark:text-gray-200"
                              >
                                <PenLine className="h-3 w-3" />
                                Edit all fields
                              </button>
                            </div>
                            {/* The caps are the ones the Marketing tool enforces,
                                so nothing typed here can be rejected on save.
                                The counter is the field's own length, in the
                                same tabular style the tool uses. */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs">Headline</Label>
                                <span
                                  className={cn(
                                    "text-[10px] tabular-nums",
                                    draft.headline.length >=
                                      PORTAL_ASSET_HEADLINE_MAX
                                      ? "font-medium text-red-500"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {draft.headline.length}/
                                  {PORTAL_ASSET_HEADLINE_MAX}
                                </span>
                              </div>
                              <Input
                                maxLength={PORTAL_ASSET_HEADLINE_MAX}
                                value={draft.headline}
                                onChange={(event) =>
                                  update(asset.id, {
                                    headline: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs">Body</Label>
                                <span
                                  className={cn(
                                    "text-[10px] tabular-nums",
                                    draft.body.length >= PORTAL_ASSET_BODY_MAX
                                      ? "font-medium text-red-500"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {draft.body.length}/{PORTAL_ASSET_BODY_MAX}
                                </span>
                              </div>
                              <Textarea
                                maxLength={PORTAL_ASSET_BODY_MAX}
                                value={draft.body}
                                onChange={(event) =>
                                  update(asset.id, { body: event.target.value })
                                }
                                rows={4}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Button text</Label>
                              <Input
                                value={draft.ctaText}
                                onChange={(event) =>
                                  update(asset.id, {
                                    ctaText: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Status</Label>
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  update(asset.id, {
                                    status: event.target.value,
                                  })
                                }
                                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                              >
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                                <option value="Archived">Archived</option>
                              </select>
                            </div>
                            {/* The second way in: at the end of the fields the
                                advisor is already looking at. */}
                            <div className="flex justify-end border-t border-gray-100 pt-3 dark:border-gray-700">
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDelete({
                                    id: asset.id,
                                    headline: draft.headline || asset.type,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete this asset
                              </button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </section>
          );
        })}

        {/* Section 6 — the plan's meetings, as accordions on the same pattern as
            the assets above: the header carries the actions, the body the
            properties. Not rendered by this page directly — they are what the
            video section's upcoming cards and a meeting-based flyer point at, so
            a session scheduled in Section 2 has somewhere to show up. */}
        <section className="space-y-3">
          <SectionHeader number={6} title={`Meetings (${meetings.length})`} />
          {meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No meetings yet — schedule one above.
            </p>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {meetings.map((meeting) => (
                <AccordionItem
                  key={meeting.id}
                  value={meeting.id}
                  className={cn(
                    "rounded-lg border border-muted bg-white px-3 dark:bg-gray-800",
                    deletingMeetingId === meeting.id && "opacity-60",
                  )}
                >
                  <AccordionTrigger className="py-2.5 text-left text-sm hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
                      <span className="min-w-0 flex-1 truncate text-left font-medium text-gray-900 dark:text-gray-100">
                        {meeting.meeting ||
                          meeting.meetingType ||
                          "Meeting"}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                        {formatMeetingDay(meeting.date)}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          meetingStatusClass(meeting.status),
                        )}
                      >
                        {meeting.status || "Upcoming"}
                      </span>
                      {deletingMeetingId === meeting.id ? (
                        <Loader2
                          role="status"
                          aria-label="Deleting…"
                          className="h-3.5 w-3.5 shrink-0 animate-spin text-red-500"
                        />
                      ) : null}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit ${
                          meeting.meeting || meeting.meetingType || "meeting"
                        }`}
                        title="Edit this meeting"
                        {...headerAction(() => setEditingMeeting(meeting))}
                        className="shrink-0 cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-accent-blue/10 hover:text-accent-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Delete ${
                          meeting.meeting || meeting.meetingType || "meeting"
                        }`}
                        title="Delete"
                        {...headerAction(() =>
                          setMeetingPendingDelete({
                            id: meeting.id,
                            title:
                              meeting.meeting ||
                              meeting.meetingType ||
                              "this meeting",
                          }),
                        )}
                        className="shrink-0 cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-2">
                      {(
                        [
                          ["Date", formatMeetingDay(meeting.date)],
                          [
                            "Time",
                            meeting.time
                              ? formatTimeAbbrev(meeting.time)
                              : "—",
                          ],
                          ["Duration", meeting.duration || "—"],
                          ["Format", meeting.format || "—"],
                          ["Platform", meeting.platform || "—"],
                          ["Language", meeting.language || "—"],
                          ["Category", meeting.benefitsCategory || "—"],
                          [
                            "Max attendees",
                            meeting.maxAttendees
                              ? String(meeting.maxAttendees)
                              : "—",
                          ],
                          [
                            "Location",
                            [meeting.address, meeting.city, meeting.state]
                              .filter(Boolean)
                              .join(", ") || "—",
                          ],
                          ["Meeting link", meeting.meetingLink || "—"],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <dt className="uppercase tracking-wide text-muted-foreground">
                            {label}
                          </dt>
                          <dd
                            className="truncate text-gray-800 dark:text-gray-200"
                            title={value}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {meeting.description && (
                      <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-muted-foreground dark:border-gray-700">
                        {meeting.description}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </section>
      </div>

      {/* The creator is the dashboard's own modal, so it brings its own Save,
          validation and per-type rules. `Dialog` portals to the body, which is
          also what keeps it clear of the scaled portal replica beside us. */}
      {creator && (
        <MarketingAssetModal
          open
          onOpenChange={(open) => {
            if (!open) setCreator(null);
          }}
          assetType={creator.type}
          initialPortalElement={creator.element ?? null}
          planId={portalPlanId}
          planName={planDisplayName}
          // The panel is `fixed z-[51]` — above the app's dialog tier — so the
          // creator is raised past it, past the chat pill (`z-[60]`) and past the
          // published pop-up (`z-[100]`): an action the advisor asked for must
          // beat an unsolicited dialog. Overlay included, or the panel stays
          // bright above the scrim.
          dialogZClass="z-[110]"
          onSave={() => void refreshAssets()}
        />
      )}

      {/* The full editor for one existing asset — every property of its type,
          with the Marketing tool's own validation and preview. It writes on its
          own Save, so both caches are re-read when it reports back. */}
      {fullEditor && (
        <MarketingAssetModal
          open
          onOpenChange={(open) => {
            if (!open) setFullEditor(null);
          }}
          assetType={fullEditor.type as AssetType}
          // A portal notice always edits its banner: that is the element the
          // type means, and the picker would only offer the other two types.
          initialPortalElement={
            fullEditor.type === "portal-notice" ? "top-banner" : undefined
          }
          editingAsset={fullEditor}
          planId={portalPlanId}
          planName={planDisplayName}
          dialogZClass="z-[110]"
          onSave={() => void refreshAssets()}
        />
      )}

      {/* Meetings and webinars: their own creators, extracted from the dashboard
          pages so the form is written once and hosted twice. */}
      <MeetingCreateDialog
        open={inlineCreator === "meeting" || !!editingMeeting}
        onOpenChange={(open) => {
          if (open) return;
          setInlineCreator(null);
          setEditingMeeting(null);
        }}
        planId={portalPlanId}
        planName={planDisplayName}
        editing={editingMeeting}
        // The new session lands in Section 6 — and on the page's own meeting
        // cards — without a reload, and before anything is saved in this panel.
        onCreated={() => {
          setEditingMeeting(null);
          void refreshMeetings();
        }}
      />
      <WebinarCreateDialog
        open={inlineCreator === "webinar"}
        onOpenChange={(open) => {
          if (!open) setInlineCreator(null);
        }}
        planId={portalPlanId}
        planName={planDisplayName}
        // The portal's own video rail reads `/api/webinars` on mount, so the new
        // row lands on the next page load. Both asset caches are re-read here so
        // the panel is never stale.
        onCreated={() => void refreshAssets()}
      />

      {/* The meeting delete confirmation. Like the assets, deleting a meeting is
          not a draft: the row is gone the moment the API says so. */}
      <ConfirmDialog
        open={!!meetingPendingDelete}
        onOpenChange={(open) => {
          if (!open) setMeetingPendingDelete(null);
        }}
        onConfirm={() => void deleteMeeting()}
        title="Delete this meeting?"
        description={`"${meetingPendingDelete?.title ?? ""}" will be removed from the plan. This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deletingMeetingId !== null}
      />

      {/* One confirmation for both entry points. Deleting is not a draft: the
          row is gone from the API, so it goes from the list too. */}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => void deleteAsset()}
        title="Delete this asset?"
        description={`"${pendingDelete?.headline ?? ""}" will be removed from the portal. This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deletingAssetId !== null}
      />
    </PortalEditorShell>
  );
}
