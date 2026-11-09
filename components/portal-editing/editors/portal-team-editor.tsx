"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { KeyContactsEditor } from "@/components/contacts/key-contacts-editor";
import { MainContactStyleSection } from "@/components/contacts/main-contact-style-section";
import { PortalFooterSection } from "@/components/portal-editing/portal-footer-section";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  contactIdFromAnchor,
  PORTAL_SECTION_IDS,
} from "@/lib/portal-editor-sections";
import {
  normalizeKeyContactCardStyle,
  type KeyContactCardStyle,
} from "@/lib/key-contact-card-style";
import type { KeyContact } from "@/types/new-client-wizard";

interface KeyContactsBlob {
  contacts: KeyContact[];
  displayStyle?: number | null;
  mobileDisplayStyle?: number | null;
  contactDisplayOrder?: (string | number)[];
  /**
   * How the MAIN contact's card is drawn on this page — `default` or
   * `highlighted`. It rides the same blob as the contacts, so it is saved by the
   * same plan PUT.
   */
  mainContactStyle?: KeyContactCardStyle;
  [key: string]: unknown;
}

function normalizeBlob(raw: unknown): KeyContactsBlob {
  if (Array.isArray(raw)) return { contacts: raw as KeyContact[] };
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    return {
      ...value,
      contacts: Array.isArray(value.contacts)
        ? (value.contacts as KeyContact[])
        : [],
      displayStyle:
        typeof value.displayStyle === "number" ? value.displayStyle : null,
      mobileDisplayStyle:
        typeof value.mobileDisplayStyle === "number"
          ? value.mobileDisplayStyle
          : null,
    };
  }
  return { contacts: [] };
}

/** How long a keystroke waits before the blob is written, in ms. */
const AUTOSAVE_DELAY = 700;

/**
 * My Benefits Team editor — the contacts the plan shows on its cards.
 *
 * The form is
 * [`KeyContactsEditor`](../../contacts/key-contacts-editor.tsx:1), the same
 * component Create Plan's Step 3 Edit Panel renders, so the two surfaces cannot
 * drift: same accordions, same designation pills, same contact details, same CTA
 * picker. This component is only the PORTAL HOST — it feeds the form the plan's
 * `keyContacts` blob and writes every edit back through the plan PUT.
 *
 * Two speeds on purpose:
 *
 *  - typing patches the blob AND the portal's plan data, so the cards beside the
 *    panel repaint on the keystroke, and a debounced PUT persists it;
 *  - "Save Changes" writes at once and says so, which is what the panel's own
 *    button promises.
 */
export function PortalTeamEditor() {
  const { clientData } = useClientPortal();
  const {
    planId,
    beginSave,
    finishSave,
    failSave,
    saveState,
    saveError,
    patchClientData,
    refetchPortal,
    focusRequest,
  } = usePortalEditing();

  /**
   * The contact a page's blue button asked to open.
   *
   * My Benefits Team puts one button on each contact card; pressing it sends
   * `key-contact-<id>` through `focusSection`, which opens this panel. The id is
   * parsed off the same anchor the form renders on its rows, so the button, the
   * scroll and the accordion cannot address different things.
   */
  const focusContactId = contactIdFromAnchor(focusRequest?.id);

  const [blob, setBlob] = useState<KeyContactsBlob>(() =>
    normalizeBlob(clientData?.keyContacts),
  );
  const dirtyRef = useRef(false);
  const hydratedRef = useRef<string | null>(null);

  // The latest blob for handlers that must not close over a stale render (a
  // keystroke and the "Save Changes" press can land in the same tick).
  const blobRef = useRef(blob);
  blobRef.current = blob;

  useEffect(() => {
    const id = clientData?.id ?? null;
    if (!id || hydratedRef.current === id) return;
    hydratedRef.current = id;
    setBlob(normalizeBlob(clientData?.keyContacts));
  }, [clientData]);

  /** Write the blob to the plan. Reports whether the server accepted it. */
  const persist = useCallback(
    async (next: KeyContactsBlob) => {
      if (!planId) return false;
      beginSave();
      try {
        const response = await fetch(`/api/clients/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyContacts: next }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Could not save the team.");
        }
        finishSave();
        return true;
      } catch (error) {
        failSave(
          error instanceof Error ? error.message : "Could not save the team.",
        );
        return false;
      }
    },
    [planId, beginSave, finishSave, failSave],
  );

  /**
   * The debounced write behind typing. A failure re-reads the plan, so the panel
   * cannot keep showing a version of a contact the server rejected.
   */
  const autosave = useCallback(async () => {
    const accepted = await persist(blobRef.current);
    if (!accepted) await refetchPortal();
  }, [persist, refetchPortal]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      void autosave();
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [blob, autosave]);

  /**
   * One changed field: update the draft, push it into the portal's plan data so
   * the cards repaint immediately, and let the debounce write it.
   */
  const patchContact = useCallback(
    (contactId: string | number, updates: Record<string, any>) => {
      dirtyRef.current = true;
      setBlob((previous) => {
        const contacts = previous.contacts.map((contact) =>
          contact.id === contactId ? { ...contact, ...updates } : contact,
        );
        const next = { ...previous, contacts };
        patchClientData({ keyContacts: next });
        return next;
      });
    },
    [patchClientData],
  );

  /**
   * Section 1's two choices. The style is a plan-level field on the same blob, so
   * it previews on the click and is written by the same debounce as a contact
   * edit.
   */
  const setMainContactStyle = useCallback(
    (next: KeyContactCardStyle) => {
      dirtyRef.current = true;
      setBlob((previous) => {
        const updated: KeyContactsBlob = {
          ...previous,
          mainContactStyle: next,
        };
        patchClientData({ keyContacts: updated });
        return updated;
      });
    },
    [patchClientData],
  );

  /**
   * The row's own "Save Changes": the explicit press is the write, so it commits
   * the whole blob at once and cancels the pending debounce.
   */
  const saveContact = useCallback(
    async (contactId: string | number) => {
      void contactId;
      dirtyRef.current = false;
      const accepted = await persist(blobRef.current);
      if (!accepted) {
        toast.error("Could not save this contact. Please try again.");
        return false;
      }
      toast.success("Contact saved");
      return true;
    },
    [persist],
  );

  const deleteContact = useCallback(
    async (contactId: string | number) => {
      dirtyRef.current = false;
      const previous = blobRef.current;
      const contacts = previous.contacts.filter(
        (contact) => contact.id !== contactId,
      );
      const contactDisplayOrder = Array.isArray(previous.contactDisplayOrder)
        ? previous.contactDisplayOrder.filter((id) => id !== contactId)
        : contacts.map((contact) => contact.id);
      const next: KeyContactsBlob = {
        ...previous,
        contacts,
        contactDisplayOrder,
      };

      setBlob(next);
      patchClientData({ keyContacts: next });

      const accepted = await persist(next);
      if (!accepted) {
        toast.error("Could not delete that contact. Please try again.");
        return;
      }
      toast.success("Contact removed");
    },
    [patchClientData, persist],
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        {saveState === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </>
        )}
        {saveState === "saved" && <span>Saved</span>}
        {saveState === "error" && (
          <span className="text-red-500">{saveError || "Save failed"}</span>
        )}
      </div>

      <MainContactStyleSection
        value={normalizeKeyContactCardStyle(blob.mainContactStyle)}
        onChange={setMainContactStyle}
      />

      {/* The wizard's own contact form, numbered as this panel's second section. */}
      <KeyContactsEditor
        sectionNumber={2}
        contacts={blob.contacts}
        onPatch={patchContact}
        onSaveContact={saveContact}
        onDeleteContact={deleteContact}
        // Opened by a card's own edit button; `nonce` re-opens the same row.
        focusContactId={focusContactId}
        focusContactNonce={focusRequest?.nonce}
        emptyMessage={
          <p className="text-sm text-muted-foreground">
            This plan has no contacts yet. Add them from Edit Client → Contacts.
          </p>
        }
      />

      {/* Section 3 — the footer disclosure shared by the four non-hub pages. */}
      <section
        className="space-y-4"
        data-edit-anchor={PORTAL_SECTION_IDS.disclosure}
      >
        <SectionHeader number={3} title="Disclosure" />
        <PortalFooterSection />
      </section>
    </div>
  );
}
