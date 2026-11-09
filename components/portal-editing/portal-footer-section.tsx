"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { PortalFooterDialog } from "@/components/portal-editing/portal-footer-dialog";
import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { useClientPortal } from "@/contexts/client-portal-context";
import type { PortalDisclaimersEnvelope } from "@/lib/portal-disclosures";

/**
 * The Disclosure section for the portal panels that do NOT keep a general plan
 * draft — News & Events, My Benefits Team and Employee Resources.
 *
 * Those panels already save their own surfaces (marketing assets, contacts, the
 * Employee Resources hero), so the footer cannot borrow their Save bar. Instead
 * this host gives [`PortalFooterDialog`](portal-footer-dialog.tsx:72) its own
 * commit point:
 *
 * - every edit patches `clientData.disclaimers`, so the footer band on the live
 *   page repaints immediately and no other draft is touched;
 * - **Done** PUTs that envelope to the same plan route the Home panel uses;
 * - **Cancel** puts the last-accepted envelope back.
 *
 * It is gated on `plan_details_branding: edit`, the same function the Home
 * footer needs — opening News & Events (or a contact panel, or the document hub)
 * must not become a second, weaker way to write the plan's branding.
 */
export function PortalFooterSection() {
  const { clientData } = useClientPortal();
  const editing = useOptionalPortalEditing();

  const pendingRef = useRef<PortalDisclaimersEnvelope | null>(null);
  /** The envelope the plan last showed, restored by Cancel or a failed save. */
  const previousRef = useRef<unknown>(undefined);
  /** Synchronous in-flight guard: React state updates a render too late. */
  const savingRef = useRef(false);

  // The provider's direct branding check is page-independent. The fallbacks keep
  // the section usable in older hosts (and test doubles) that only expose the
  // page-scoped check or `canEdit`.
  const canEditBranding =
    editing?.canEditBranding ??
    (editing?.canEditFunction
      ? editing.canEditFunction("plan_details_branding")
      : Boolean(editing?.canEdit));

  const handleChange = useCallback(
    (next: PortalDisclaimersEnvelope) => {
      if (previousRef.current === undefined) {
        previousRef.current = (clientData as Record<string, any> | null)
          ?.disclaimers;
      }
      pendingRef.current = next;
      editing?.patchClientData({ disclaimers: next } as any);
    },
    [clientData, editing],
  );

  const handleSave = useCallback(async () => {
    if (!editing || savingRef.current) return;
    const payload = pendingRef.current;
    if (!payload || !editing.planId) {
      pendingRef.current = null;
      return;
    }

    // One in-flight save, one toast. The dialog's button also disables itself,
    // but its state lands a render later — this ref closes that gap for a fast
    // double-press.
    savingRef.current = true;
    editing.beginSave();
    try {
      const response = await fetch(`/api/clients/${editing.planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disclaimers: payload }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save the footer.");
      }

      previousRef.current = payload;
      pendingRef.current = null;
      editing.finishSave();
      toast.success("Footer saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the footer.";
      editing.failSave(message);
      toast.error(message);
      // Put the live footer back on what the server last accepted; the page's
      // other drafts are left alone.
      editing.patchClientData({
        disclaimers: previousRef.current,
      } as any);
      throw error;
    } finally {
      savingRef.current = false;
    }
  }, [editing]);

  const handleCancel = useCallback(async () => {
    if (!editing) return;
    const previous = previousRef.current;
    previousRef.current = undefined;
    pendingRef.current = null;
    if (previous !== undefined) {
      editing.patchClientData({ disclaimers: previous } as any);
    }
    editing.resetSave();
  }, [editing]);

  if (!editing || !canEditBranding) return null;

  const data = (clientData ?? {}) as Record<string, any>;

  return (
    <PortalFooterDialog
      value={data.disclaimers}
      // What the footer shows while the plan has no disclosure of its own — the
      // advisor's profile disclaimer, exactly as the portal layout falls back to it.
      fallbackText={String(data.advisorDisclaimer || "")}
      organizationName={
        String(data.branding?.organizationName || "") ||
        String(data.companyName || "")
      }
      companyName={String(data.companyName || "")}
      brandColor={String(data.brandColor || "#1F3A60")}
      secondaryColor={String(data.secondaryColor || "#6B7280")}
      onChange={handleChange}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
