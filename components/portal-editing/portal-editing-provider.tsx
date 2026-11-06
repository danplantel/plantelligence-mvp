"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams, usePathname } from "next/navigation";

import {
  useClientPortal,
  type ClientData,
} from "@/contexts/client-portal-context";
import { useViewerAccess } from "@/hooks/useViewerAccess";
import { useOptionalCommentMode } from "@/components/comments/comment-mode-provider";
import {
  PORTAL_EDIT_FROM_PARAM,
  PORTAL_EDIT_SECTION_PARAM,
} from "@/lib/portal-editor-intent";
import { toast } from "sonner";
import { benefitCategoryToVisibilityKey } from "@/lib/portal-category-visibility";
import {
  customBenefitNameToSlug,
  isPlaceholderBenefitName,
} from "@/lib/benefit-custom-name";
import {
  canEditPortalFunction,
  canEditPortalTarget,
  resolvePortalEditTarget,
  type PortalEditTarget,
} from "@/lib/portal-editing";
import type { PermissionFunction } from "@/types/teammate";

/** How wide the inline panel reserves itself on the left of the portal. */
export const PORTAL_EDITOR_WIDTH = "36rem";

type SaveState = "idle" | "saving" | "saved" | "error";

interface PortalEditingContextValue {
  /** The page the panel edits, or null when this path is not an editing surface. */
  target: PortalEditTarget | null;
  /** The plan/benefit id used by save endpoints. */
  planId: string;
  /** May this viewer edit ANY section of this page? */
  canEdit: boolean;
  /** May this viewer edit one specific function on this page? */
  canEditFunction: (permission: PermissionFunction) => boolean;
  /**
   * The access summary is still in flight.
   *
   * The floating Edit control renders a SKELETON while this is true instead of a
   * disabled button: "not answered yet" and "not allowed" are different things,
   * and showing the second while the first is true read as a broken control.
   */
  isAccessLoading: boolean;
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  /**
   * The section the panel should scroll to, as
   * [`portalSectionId`](../../lib/portal-editor-sections.ts:14) writes it.
   *
   * `nonce` exists so clicking the same region twice scrolls again — without it
   * the id would not change and the effect would not re-run.
   */
  focusRequest: { id: string; nonce: number } | null;
  /**
   * Open the panel at one of its sections.
   *
   * This is the portal's version of the blue edit affordances in Create/Edit
   * Client and Benefits Step 2: click the part of the page you want to change and
   * the panel comes up already scrolled to it.
   */
  focusSection: (sectionId: string) => void;
  saveState: SaveState;
  saveError: string | null;
  beginSave: () => void;
  finishSave: () => void;
  failSave: (message: string) => void;
  /** Return the bar to idle — a cancelled draft has nothing left to report. */
  resetSave: () => void;
  /** Merge a draft into the live portal data for immediate repaint. */
  patchClientData: (patch: Record<string, unknown>) => void;
  /**
   * Pull the saved truth back after a cancelled draft or failed save, resolving
   * with the fresh payload so the editor can re-seed itself from it.
   */
  refetchPortal: () => Promise<ClientData | null>;
}

const PortalEditingContext = createContext<PortalEditingContextValue | null>(
  null,
);

/** The provider when one is mounted; null on the dashboard and unarmed portals. */
export function useOptionalPortalEditing(): PortalEditingContextValue | null {
  return useContext(PortalEditingContext);
}

export function usePortalEditing(): PortalEditingContextValue {
  const context = useContext(PortalEditingContext);
  if (!context) {
    throw new Error(
      "usePortalEditing must be used inside PortalEditingProvider",
    );
  }
  return context;
}

export function PortalEditingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const planId = typeof params?.id === "string" ? params.id : "";
  const { clientData, patchClientData, refetch } = useClientPortal();
  const { can, isLoading: isAccessLoading } = useViewerAccess();

  const customHubSlug = useMemo(() => {
    const hubs = (clientData as any)?.benefitHubs;
    if (!Array.isArray(hubs)) return null;
    const hub = hubs.find(
      (entry: any) =>
        benefitCategoryToVisibilityKey(String(entry?.category || "")) ===
        "Other",
    );
    const title = String(hub?.title || "").trim();
    return title && !isPlaceholderBenefitName(title)
      ? customBenefitNameToSlug(title)
      : null;
  }, [clientData]);

  const target = useMemo(
    () =>
      resolvePortalEditTarget({
        pathname: pathname ?? "",
        planSlug: planId,
        customHubSlug,
      }),
    [pathname, planId, customHubSlug],
  );

  const viewer = useMemo(
    () => ({ isCollaborator: false, can }),
    [can],
  );
  // Wait for the access summary before showing an edit affordance. The hook is
  // fail-open while loading, so rendering from it would flash the editor for a
  // viewer whose real grid is view-only.
  const canEdit = useMemo(
    () => !isAccessLoading && canEditPortalTarget(target, viewer),
    [isAccessLoading, target, viewer],
  );
  const canEditFunction = useCallback(
    (permission: PermissionFunction) =>
      !isAccessLoading &&
      canEditPortalFunction(target, viewer, permission),
    [isAccessLoading, target, viewer],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // A viewer who loses edit access (or navigates to a page they cannot edit)
  // must not keep a panel open over read-only content.
  useEffect(() => {
    if (!canEdit && isOpen) setIsOpen(false);
  }, [canEdit, isOpen]);

  // Reserve the panel's column on the portal root. `app/(portal)/[id]/layout.tsx`
  // reads this for the page padding and the fixed header's left edge.
  useEffect(() => {
    const root = document.documentElement;
    if (isOpen && canEdit) {
      root.style.setProperty("--portal-editor-inset", PORTAL_EDITOR_WIDTH);
    } else {
      root.style.removeProperty("--portal-editor-inset");
    }
    return () => {
      root.style.removeProperty("--portal-editor-inset");
    };
  }, [isOpen, canEdit]);

  const openPanel = useCallback(() => {
    if (!canEdit) return;
    setSaveState("idle");
    setSaveError(null);
    setIsOpen(true);
  }, [canEdit]);

  /**
   * The last section the page asked for. `nonce` is what makes clicking the same
   * region twice scroll again — the id alone would not change.
   */
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);

  const focusSection = useCallback(
    (sectionId: string) => {
      if (!canEdit) return;
      setSaveState("idle");
      setSaveError(null);
      setFocusRequest({ id: sectionId, nonce: Date.now() });
      setIsOpen(true);
    },
    [canEdit],
  );

  /**
   * An intent left by another page's blue Edit button.
   *
   * The footer disclosure lives on the Landing Page's panel, so its button on My
   * Benefits Team / News & Events / Employee Resources navigates here and asks for
   * the Disclosure section. Consumed only once the access check has ANSWERED: an
   * unanswered read must not swallow the request (`canEdit` is still false then).
   */
  const comments = useOptionalCommentMode();
  /**
   * The section named by `?editSection=…`, applied once.
   *
   * Read from `window.location.search` rather than a hook: the rail arms itself
   * the same way, and this must work without wrapping the portal in Suspense.
   * The ref keeps a re-render (or a remount of this provider) from re-opening the
   * panel after the advisor has closed it.
   */
  const appliedEditSectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAccessLoading || !canEdit) return;
    const params = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    );
    const sectionId = params.get(PORTAL_EDIT_SECTION_PARAM);
    if (!sectionId) return;
    const appliedKey = `${pathname}:${sectionId}`;
    if (appliedEditSectionRef.current === appliedKey) return;
    appliedEditSectionRef.current = appliedKey;

    // The advisor came here to edit the footer, not to read comments. (The link
    // they followed has `comments` removed for the same reason; this covers a
    // link that still carries it.)
    comments?.setMode("off");

    focusSection(sectionId);

    // Say WHY the page changed under them: the footer is one record shared by
    // four pages, and the Landing Page is the one whose panel edits it.
    const from = params.get(PORTAL_EDIT_FROM_PARAM);
    if (from) {
      toast.info("The footer is edited on the Landing Page", {
        description: `${from} has no footer of its own. Its disclosure is the Landing Page footer, which is now open at the Disclosure section.`,
        duration: 8000,
      });
    }
  }, [canEdit, comments, focusSection, isAccessLoading, pathname]);

  const closePanel = useCallback(() => setIsOpen(false), []);
  const togglePanel = useCallback(() => {
    if (!canEdit) return;
    setIsOpen((previous) => !previous);
  }, [canEdit]);

  const beginSave = useCallback(() => {
    setSaveState("saving");
    setSaveError(null);
  }, []);
  const finishSave = useCallback(() => setSaveState("saved"), []);
  const failSave = useCallback((message: string) => {
    setSaveState("error");
    setSaveError(message);
  }, []);
  const resetSave = useCallback(() => {
    setSaveState("idle");
    setSaveError(null);
  }, []);

  const value = useMemo<PortalEditingContextValue>(
    () => ({
      target,
      planId,
      canEdit,
      canEditFunction,
      isAccessLoading,
      isOpen,
      openPanel,
      closePanel,
      togglePanel,
      focusRequest,
      focusSection,
      saveState,
      saveError,
      beginSave,
      finishSave,
      failSave,
      resetSave,
      patchClientData: patchClientData as (
        patch: Record<string, unknown>,
      ) => void,
      refetchPortal: refetch,
    }),
    [
      target,
      planId,
      canEdit,
      canEditFunction,
      isAccessLoading,
      isOpen,
      openPanel,
      closePanel,
      togglePanel,
      focusRequest,
      focusSection,
      saveState,
      saveError,
      beginSave,
      finishSave,
      failSave,
      resetSave,
      patchClientData,
      refetch,
    ],
  );

  return (
    <PortalEditingContext.Provider value={value}>
      {children}
    </PortalEditingContext.Provider>
  );
}
