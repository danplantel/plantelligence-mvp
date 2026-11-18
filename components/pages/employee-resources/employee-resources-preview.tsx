"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Pencil,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Footer } from "@/components/layout/footer";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import {
  ClientPortalProvider,
  useClientPortal,
} from "@/contexts/client-portal-context";
import {
  PortalEditingProvider,
  usePortalEditing,
} from "@/components/portal-editing/portal-editing-provider";
import { PortalEditingPanel } from "@/components/portal-editing/portal-editing-panel";
import { EmployeeResourcesPortalPage } from "@/components/pages/employee-resources/employee-resources-portal-page";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useViewerAccess } from "@/hooks/useViewerAccess";
import {
  COMMENTS_RAIL_PARAM,
  COMMENTS_RAIL_VALUE,
} from "@/lib/comments/portal-surface";
import { resolveOrgOnlyDisclaimerText } from "@/lib/disclaimer-constants";
import { portalLegalHref } from "@/lib/legal/legal-config";
import { readLandingDisclosureText } from "@/lib/portal-disclosures";
import { resolvePortalFooterColor } from "@/lib/portal-footer-color";
import { getPortalShapeCssVars } from "@/lib/typography-themes";
import { usePreviewEditorLayout } from "@/lib/preview-editor-layout";
import { cn } from "@/lib/utils";

/**
 * Employee Resources — the plan's admin surface, as an in-dashboard editor (TF-6).
 *
 * The hub has no Create/Edit Benefit page, and it must not grow a second editor: the
 * portal already owns a complete Editing Panel for it
 * ([`PortalEmployeeResourcesEditor`](../../portal-editing/editors/portal-employee-resources-editor.tsx:24)),
 * with the hero slot, the two question boards and the shared footer disclosure.
 *
 * So the page is mounted here DIRECTLY — not in a frame — with that panel beside it,
 * exactly the arrangement Edit Plan and Edit Benefit use:
 *
 *   · [`ClientPortalProvider`](contexts/client-portal-context.tsx:123) loads the plan's
 *     portal data; the page and the panel's live preview both read it.
 *   · [`PortalEditingProvider`](components/portal-editing/portal-editing-provider.tsx:129)
 *     is told the plan and the portal pathname, because this route is not the portal's
 *     own — its panel target must still resolve to "Employee Resources". It is also told
 *     where to draw the panel, so it clears the sidebar instead of covering it.
 *   · `usePreviewEditorLayout` reserves the panel's column (`--editor-inset`) and
 *     rail-collapses the sidebar while it is open, so the header and the page shift
 *     right as they do on Edit Plan / Edit Benefit.
 *
 * Because the page and the panel share ONE React tree, every keystroke in the panel
 * patches the portal context and the page beside it repaints immediately — the live
 * preview the portal's own `?edit=true` view gives, without an iframe.
 *
 * PUBLISHING DOES NOT GATE EDITING: the switch decides what PARTICIPANTS see. The page
 * renders its sections for an editor even while the hub is unpublished (see
 * `isEditorPreview` in the page component), and participants still get the notice.
 */

interface HubState {
  enabled: boolean;
  /** The plan's portal slug — the hub is addressed by it, never by the plan id. */
  slug?: string | null;
}

interface PlanSummary {
  id: string;
  companyName?: string;
}

/** What the toolbar needs from the panel provider, lifted out of its subtree. */
interface PanelControl {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

/**
 * The plan picker's read, reused only for the plan's NAME: the hub response carries the
 * slug and the flag, not the company. `summary=1` keeps this to id/name/status.
 */
const PLAN_LIST_KEY =
  "/api/clients?summary=1&status=all&limit=500&sortColumn=companyName&sortDirection=asc";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** The hub read must distinguish "hidden" from "the read failed". */
const hubFetcher = async (url: string): Promise<HubState> => {
  const response = await fetch(url, { credentials: "same-origin" });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Could not load Employee Resources.");
  }
  return body as HubState;
};

/**
 * Publishes the panel's open state to the toolbar.
 *
 * The toolbar sits ABOVE the providers (it must survive the plan read, which draws its
 * own skeleton in place of the children), so it cannot call `usePortalEditing` itself.
 * This bridge is the smallest way to keep ONE source of truth: it reports the provider's
 * `isOpen` and its two actions upward, so the button still follows a close made with the
 * panel's own X.
 */
function PanelControlBridge({
  onChange,
}: {
  onChange: (control: PanelControl) => void;
}) {
  const { isOpen, openPanel, closePanel } = usePortalEditing();

  useEffect(() => {
    onChange({ isOpen, openPanel, closePanel });
  }, [isOpen, openPanel, closePanel, onChange]);

  return null;
}

/**
 * The portal's own header band.
 *
 * A hub is not just its sections — the participant arrives through this header (hub
 * links, the plan's Login or booking CTA), so a preview without it read as a different
 * product. It is rendered OUTSIDE the scaled replica, as a sticky row: a `position:
 * fixed` bar inside a transformed ancestor scrolls away with the transform, and the
 * live portal keeps its header outside its own zoom for exactly that reason.
 */
function PreviewPortalHeader({ planId }: { planId: string }) {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  return (
    <PortalHeader
      companyData={{ companyLogo: clientData?.companyLogo }}
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      clientId={planId}
      categoryPortalVisibility={(clientData as any)?.categoryPortalVisibility}
      benefitHubs={(clientData as any)?.benefitHubs}
      employeeResourcesEnabled={
        (clientData as any)?.employeeResourcesEnabled === true
      }
      headerCta={(clientData as any)?.employeePortalPreview?.headerCta}
      typographyTheme={clientData?.typographyTheme}
    />
  );
}

/** The page and the portal's footer, together forming the scaled replica. */
function PreviewPortalPageChrome({
  planId,
  reloadKey,
}: {
  planId: string;
  reloadKey: number;
}) {
  const { clientData, profile } = useClientPortal();

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";
  // Same helper and same input as the portal layout, so the footer colour can never
  // differ between the preview and the live page.
  const footerBgColor = resolvePortalFooterColor(
    (clientData as any)?.disclaimers,
    brandColor,
    secondaryColor,
  );
  const organizationName =
    (clientData as any)?.branding?.organizationName ||
    profile?.organizationName ||
    clientData?.companyName ||
    "";

  /**
   * The plan's disclosure, resolved the way the portal layout resolves it for a NON-hub
   * page — which is what this is:
   *
   *  1. The "Home Page" / "Global" / all-categories row of the `disclaimers` envelope,
   *     i.e. exactly what the Open Footer Editor and the panel's Disclosure section
   *     write (`readLandingDisclosureText` is that rule).
   *  2. The advisor's own disclosure (`advisorDisclaimer`, resolved server-side onto the
   *     plan) — the same fallback the footer editor itself shows when the plan has no
   *     envelope row yet.
   *
   * Only when neither exists is `null` passed, which lets `Footer` draw its stock copy
   * instead of the preview inventing text of its own.
   */
  const storedDisclosure = readLandingDisclosureText(
    (clientData as any)?.disclaimers,
  );
  const advisorDisclosure = String(
    (clientData as any)?.advisorDisclaimer ?? "",
  ).trim();
  const disclosuresText =
    storedDisclosure ??
    (advisorDisclosure
      ? resolveOrgOnlyDisclaimerText(
          advisorDisclosure,
          organizationName || "[Organization Name]",
        )
      : null);

  return (
    // The plan's typography tokens (`--portal-radius` and friends) are scoped here, the
    // way the portal layout scopes them. Without this the editor's Typography section
    // would change the header and nothing else in the preview.
    <div
      style={
        getPortalShapeCssVars(
          clientData?.typographyTheme,
        ) as unknown as React.CSSProperties
      }
    >
      <EmployeeResourcesPortalPage key={reloadKey} clientId={planId} />

      <Footer
        brandColor={footerBgColor}
        disclosuresText={disclosuresText}
        organizationName={organizationName}
        companyName={clientData?.companyName || ""}
        privacyHref={portalLegalHref(planId, "privacy")}
        termsHref={portalLegalHref(planId, "terms")}
      />
    </div>
  );
}

export function EmployeeResourcesPreview({ planId }: { planId: string }) {
  const router = useRouter();
  const { setTitle, setSubtitle } = usePageTitleContext();
  const { isCollaborator, can } = useViewerAccess();

  /**
   * Publishing is the same `create_benefits: edit` decision the hub's API enforces, and
   * a Collaborator never publishes — that block is stated, not offered as a control.
   */
  const mayPublish = can("create_benefits", "edit") && !isCollaborator;

  // The dashboard header carries the page's identity, not the toolbar: the title names
  // the surface and the plan is the subtitle. `setTitle` clears any stale subtitle, so
  // the plan lands in its own effect once the name read settles.
  useEffect(() => {
    setTitle("Employee Resources Preview");
  }, [setTitle]);

  const hubKey = planId
    ? `/api/clients/${encodeURIComponent(planId)}/employee-resources`
    : null;

  const {
    data: hubData,
    error: hubError,
    isLoading: isHubLoading,
    mutate: mutateHub,
  } = useSWR<HubState>(hubKey, hubFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
  });

  // The plan's name is chrome only — the preview works without it, so a failed read
  // here simply leaves it out rather than blocking the page.
  const { data: planListData } = useSWR(PLAN_LIST_KEY, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const planName = useMemo(() => {
    const rows = (planListData?.data as PlanSummary[] | undefined) ?? [];
    return rows.find((row) => row.id === planId)?.companyName?.trim() || "";
  }, [planListData, planId]);

  useEffect(() => {
    if (planName) setSubtitle(planName);
  }, [planName, setSubtitle]);

  const [saving, setSaving] = useState(false);
  /** Bumped to remount the page after a publish, so its read picks the seeded boards up. */
  const [reloadKey, setReloadKey] = useState(0);
  /** The panel provider's state, lifted so the toolbar can toggle it. */
  const [panelControl, setPanelControl] = useState<PanelControl | null>(null);

  // Reserves the panel's column and rail-collapses the sidebar while it is open — the
  // same contract Edit Plan / Edit Benefit use, so the header shifts instead of being
  // covered.
  usePreviewEditorLayout(panelControl?.isOpen ?? false);

  const enabled = hubData?.enabled === true;
  const panelOpen = panelControl?.isOpen ?? false;

  /* ── Replica geometry ──
     This page is an employee-facing layout: it is laid out at a desktop width and then
     photographed smaller, exactly as the portal does while its Comments rail is open.
     The space it has shrinks whenever the dashboard reserves a column — `--editor-inset`
     for the Edit Panel, `--comments-inset` / `--messages-inset` for a rail — so the box
     is observed and the replica re-scaled to whatever is left. */
  const boxRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const pageObserverRef = useRef<ResizeObserver | null>(null);
  /**
   * The page's layout width while NOTHING is reserved for it.
   *
   * A rail or the Edit Panel takes a column out of the box. Re-laying the page out at the
   * smaller width would re-wrap every headline and re-break every grid — the participant
   * never sees that layout. So the width is frozen at its last unconstrained value and the
   * page is scaled down proportionally instead, which is what the portal's own Comments
   * zoom does.
   */
  const baseWidthRef = useRef(0);
  const [replica, setReplica] = useState({
    width: 0,
    height: 0,
    headerHeight: 0,
    scale: 1,
  });

  const measureReplica = useCallback(() => {
    const box = boxRef.current;
    const page = pageRef.current;
    if (!box || !page) return;
    const available = box.clientWidth;
    if (!available) return;

    // Are the dashboard's reserved columns in play? `--editor-inset` is the Edit Panel's
    // column, `--comments-inset` / `--messages-inset` the rail's (only one rail at a time).
    const rootStyle = getComputedStyle(document.documentElement);
    const px = (name: string) =>
      Number.parseFloat(rootStyle.getPropertyValue(name)) || 0;
    const constrained =
      px("--editor-inset") + Math.max(px("--comments-inset"), px("--messages-inset")) >
      0;

    // Unconstrained: the base follows the box, so resizing the window reflows normally.
    // Constrained: it stays where it was and the page scales into the smaller box.
    if (!constrained) baseWidthRef.current = available;
    const width = Math.max(1024, baseWidthRef.current || available);
    const scale = Math.min(1, available / width);
    // `offsetHeight` is the UNSCALED layout height, so the wrappers have to be told the
    // scaled ones — a transform does not change layout height. The header is measured
    // too: its content is drawn at the same scale, so its sticky wrapper must be exactly
    // as tall as the scaled band.
    const height = page.offsetHeight;
    const headerHeight = headerRef.current?.offsetHeight ?? 0;

    setReplica((previous) =>
      previous.width === width &&
      previous.height === height &&
      previous.headerHeight === headerHeight &&
      previous.scale === scale
        ? previous
        : { width, height, headerHeight, scale },
    );
  }, []);

  /**
   * The scaled page's node, watched as it comes and goes.
   *
   * `ClientPortalProvider` draws its own skeleton instead of its children while the plan
   * loads, so the page element does not exist on first paint. A callback ref re-observes
   * whichever node is current, and measures as soon as one arrives.
   */
  const attachPage = useCallback(
    (node: HTMLDivElement | null) => {
      const observer = pageObserverRef.current;
      if (observer && pageRef.current) observer.unobserve(pageRef.current);
      pageRef.current = node;
      if (observer && node) observer.observe(node);
      measureReplica();
    },
    [measureReplica],
  );

  /** The header band, watched so its scaled height and width stay correct. */
  const attachHeader = useCallback(
    (node: HTMLDivElement | null) => {
      const observer = pageObserverRef.current;
      if (observer && headerRef.current) observer.unobserve(headerRef.current);
      headerRef.current = node;
      if (observer && node) observer.observe(node);
      measureReplica();
    },
    [measureReplica],
  );

  useEffect(() => {
    const observer = new ResizeObserver(measureReplica);
    pageObserverRef.current = observer;
    // The box drives the SCALE (it is what the rails and the Edit Panel shrink); the
    // page drives the HEIGHT (its content, images and accordions included).
    if (boxRef.current) observer.observe(boxRef.current);
    if (pageRef.current) observer.observe(pageRef.current);
    if (headerRef.current) observer.observe(headerRef.current);
    window.addEventListener("resize", measureReplica);
    measureReplica();
    return () => {
      observer.disconnect();
      pageObserverRef.current = null;
      window.removeEventListener("resize", measureReplica);
    };
  }, [measureReplica]);

  const togglePanel = () => {
    if (!panelControl) return;
    if (panelControl.isOpen) panelControl.closePanel();
    else panelControl.openPanel();
  };

  /**
   * The public page, in the portal's editing view — what "Open Portal" opens. The inline
   * preview renders the page component directly; this is the same page as a real tab.
   */
  const portalUrl = useMemo(() => {
    // Slug, never the id: `/{slug}/employee-resources` is the address the hub is served
    // at. The id only stands in while the hub read is still in flight.
    const slug = hubData?.slug || planId;
    const params = new URLSearchParams({
      [COMMENTS_RAIL_PARAM]: COMMENTS_RAIL_VALUE,
    });
    return `/${encodeURIComponent(slug)}/employee-resources?${params.toString()}`;
  }, [hubData?.slug, planId]);

  const handleToggle = async (checked: boolean) => {
    if (!hubKey) return;
    setSaving(true);
    // Optimistic: the switch responds immediately; a failure re-reads the truth. The
    // previous payload is spread so `slug` survives the optimistic write.
    void mutateHub(
      { ...(hubData ?? { enabled }), enabled: checked },
      { revalidate: false },
    );

    try {
      const response = await fetch(hubKey, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Could not save this setting.");
      }

      toast.success(
        checked ? "Employee Resources published" : "Employee Resources hidden",
        {
          description: checked
            ? "Participants reach it from this plan's portal header."
            : "The page is hidden. Nothing has been deleted.",
        },
      );
      await mutateHub();
      // Publishing is what seeds the hub's starter questions, so the page beside the
      // panel has to be re-read for the newly created boards to appear.
      setReloadKey((key) => key + 1);
    } catch (toggleError: any) {
      toast.error("Failed to save visibility", {
        description: toggleError?.message,
      });
      await mutateHub();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* The control strip. It is deliberately OUTSIDE the portal providers: the plan
          read draws its own skeleton in place of the children, and the toolbar must not
          disappear while that happens. */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-background">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => router.push("/employee-resources")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {/* The page's name and the plan live in the dashboard header (see the
            `setTitle`/`setSubtitle` effects), so this bar stays a control strip. */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!panelControl}
          onClick={togglePanel}
        >
          {panelOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Pencil className="h-4 w-4" />
          )}
          {panelOpen ? "Close Edit Panel" : "Open Edit Panel"}
        </Button>

        <div className="ml-auto flex items-center gap-3">
          {mayPublish ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  enabled ? "text-green-600" : "text-gray-400",
                )}
              >
                {enabled ? "Published" : "Hidden"}
              </span>
              {saving || isHubLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
              <Switch
                checked={enabled}
                disabled={isHubLoading || saving}
                aria-label="Publish Employee Resources in the portal"
                onCheckedChange={(checked) =>
                  void handleToggle(checked === true)
                }
              />
            </div>
          ) : (
            /* Publishing is a Collaborator's hard block, stated rather than offered. */
            <span
              className={cn(
                "text-[11px] font-semibold",
                enabled ? "text-green-600" : "text-gray-400",
              )}
            >
              {enabled ? "Published" : "Hidden"}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              window.open(portalUrl, "_blank", "noopener,noreferrer")
            }
          >
            <ExternalLink className="h-4 w-4" />
            Open Portal
          </Button>
        </div>
      </header>

      {/* This is the box the replica is measured against — without the ref the scale
          never updated and the page stayed at its 1024px fallback, leaving the right
          side of the preview empty. */}
      <div
        ref={boxRef}
        className="relative min-h-0 flex-1 overflow-y-auto bg-white"
      >
        {hubError && !hubData ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              <TriangleAlert className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                {"Couldn't load Employee Resources."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The plan loaded, but this hub&rsquo;s state did not. Check your
                connection and try again.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => void mutateHub()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <ClientPortalProvider clientId={planId}>
            <PortalEditingProvider
              planId={planId}
              // The panel resolves its target from a PORTAL pathname; this route's own
              // is `/employee-resources/[planId]`, which is not one.
              pathname={`/${planId}/employee-resources`}
              // Clear the sidebar: the panel occupies the column `--editor-inset`
              // reserves, exactly as the Edit Plan / Edit Benefit panels do.
              panelLeftOffset="var(--sidebar-width, 16rem)"
              panelTopOffset={0}
              // The BUILDER read, not `?forPortal=1`: the public payload answers
              // `topics: null` for an unpublished hub, which left the page's Quick
              // Answers empty beside a panel full of questions. The page and the panel
              // now share this key, so an edit repaints both.
              employeeResourcesReadKey={hubKey ?? undefined}
            >
              <PanelControlBridge onChange={setPanelControl} />

              {/* The portal header stays OUT of the page's transform so it can stay
                  genuinely pinned, but its CONTENT is drawn at the same scale — a
                  pinned bar at 100% beside a shrunken page would hide the fact that
                  the whole portal shrank. The wrapper takes the scaled height. */}
              <div
                className="sticky top-0 z-30 bg-white"
                style={{
                  height: replica.headerHeight
                    ? `${Math.round(replica.headerHeight * replica.scale)}px`
                    : undefined,
                }}
              >
                <div
                  ref={attachHeader}
                  // Inert: the header is here to be LOOKED at. Its links would navigate
                  // the dashboard away (or drop the advisor out of the preview), so the
                  // band takes no pointer events.
                  className="pointer-events-none select-none"
                  style={{
                    width: `${replica.width || 1024}px`,
                    transform: `scale(${replica.scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <PreviewPortalHeader planId={planId} />
                </div>
              </div>

              {/* The replica: the page is laid out at a desktop width and scaled into
                  the space the dashboard has left (the box is narrower whenever a rail
                  or the Edit Panel takes its column). The spacer takes the SCALED
                  height, so the transformed page never leaves a band of empty surface
                  under itself. */}
              <div
                className="relative mx-auto"
                style={{
                  width: replica.width
                    ? `${Math.round(replica.width * replica.scale)}px`
                    : "100%",
                  height: replica.height
                    ? `${Math.round(replica.height * replica.scale)}px`
                    : undefined,
                }}
              >
                <div
                  ref={attachPage}
                  className="origin-top-left bg-white"
                  style={{
                    width: `${replica.width || 1024}px`,
                    transform: `scale(${replica.scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {/* The page and its footer — the panel beside them patches the shared
                      portal context, so this repaints as the advisor types. */}
                  <PreviewPortalPageChrome
                    planId={planId}
                    reloadKey={reloadKey}
                  />
                </div>
              </div>

              {/* The portal's own panel, fixed at full viewport height and OUTSIDE the
                  transform — a transformed ancestor would capture `position: fixed`. */}
              <PortalEditingPanel />
            </PortalEditingProvider>
          </ClientPortalProvider>
        )}
      </div>
    </div>
  );
}
