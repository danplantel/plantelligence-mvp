"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams, usePathname } from "next/navigation";

import { useClientPortal } from "@/contexts/client-portal-context";
import { useViewerAccess } from "@/hooks/useViewerAccess";
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
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  saveState: SaveState;
  saveError: string | null;
  beginSave: () => void;
  finishSave: () => void;
  failSave: (message: string) => void;
  /** Merge a draft into the live portal data for immediate repaint. */
  patchClientData: (patch: Record<string, unknown>) => void;
  /** Pull the saved truth back after a failed save. */
  refetchPortal: () => Promise<void>;
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

  const value = useMemo<PortalEditingContextValue>(
    () => ({
      target,
      planId,
      canEdit,
      canEditFunction,
      isOpen,
      openPanel,
      closePanel,
      togglePanel,
      saveState,
      saveError,
      beginSave,
      finishSave,
      failSave,
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
      isOpen,
      openPanel,
      closePanel,
      togglePanel,
      saveState,
      saveError,
      beginSave,
      finishSave,
      failSave,
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
