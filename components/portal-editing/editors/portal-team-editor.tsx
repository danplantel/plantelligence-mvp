"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { ContactCtaPicker } from "@/components/ui/contact-cta-picker";
import { useClientPortal } from "@/contexts/client-portal-context";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import {
  toContactCtaOptions,
  toStoredCtaTypes,
  type ContactCtaOption,
} from "@/lib/contact-cta";
import type { KeyContact } from "@/types/new-client-wizard";

interface KeyContactsBlob {
  contacts: KeyContact[];
  displayStyle?: number | null;
  mobileDisplayStyle?: number | null;
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

function contactName(contact: KeyContact): string {
  const composed = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  return composed || contact.displayName || contact.name || "Contact";
}

/**
 * My Benefits Team editor — the contacts the plan shows on its cards.
 *
 * Card presentation (visibility and CTAs) is edited here as well, so the portal
 * repaints the same cards the participants see. Saves the plan's `keyContacts`
 * blob through the plan PUT.
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
  } = usePortalEditing();

  const [blob, setBlob] = useState<KeyContactsBlob>(() =>
    normalizeBlob(clientData?.keyContacts),
  );
  const dirtyRef = useRef(false);
  const hydratedRef = useRef<string | null>(null);

  useEffect(() => {
    const id = clientData?.id ?? null;
    if (!id || hydratedRef.current === id) return;
    hydratedRef.current = id;
    setBlob(normalizeBlob(clientData?.keyContacts));
  }, [clientData]);

  const updateContacts = useCallback(
    (updater: (contacts: KeyContact[]) => KeyContact[]) => {
      dirtyRef.current = true;
      setBlob((previous) => {
        const contacts = updater(previous.contacts);
        const next = { ...previous, contacts };
        patchClientData({ keyContacts: next });
        return next;
      });
    },
    [patchClientData],
  );

  const updateContact = useCallback(
    (id: string, patch: Partial<KeyContact>) => {
      updateContacts((contacts) =>
        contacts.map((contact) =>
          contact.id === id ? { ...contact, ...patch } : contact,
        ),
      );
    },
    [updateContacts],
  );

  const save = useCallback(async () => {
    if (!planId) return;
    beginSave();
    try {
      const response = await fetch(`/api/clients/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyContacts: blob }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Could not save the team.");
      }
      finishSave();
    } catch (error) {
      failSave(
        error instanceof Error ? error.message : "Could not save the team.",
      );
      await refetchPortal();
    }
  }, [planId, blob, beginSave, finishSave, failSave, refetchPortal]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      void save();
    }, 700);
    return () => clearTimeout(timer);
  }, [blob, save]);

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

      {blob.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This plan has no contacts yet. Add them from Edit Client → Contacts.
        </p>
      ) : (
        blob.contacts.map((contact, index) => {
          const ctaOptions = toContactCtaOptions(contact);
          return (
            <section key={contact.id || index}>
              <SectionHeader number={index + 1} title={contactName(contact)} />
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={contact.title || ""}
                    onChange={(event) =>
                      updateContact(contact.id, { title: event.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={contact.email || ""}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          email: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={contact.phone || ""}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          phone: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={contact.displayEmail === true}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          displayEmail: event.target.checked,
                        })
                      }
                    />
                    Show email
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={contact.displayPhone === true}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          displayPhone: event.target.checked,
                        })
                      }
                    />
                    Show phone
                  </label>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Card actions</Label>
                  <ContactCtaPicker
                    value={ctaOptions}
                    compact
                    onChange={(next: ContactCtaOption[]) => {
                      const stored = toStoredCtaTypes(next);
                      updateContact(contact.id, {
                        enableContactButton: next.length > 0,
                        contactButtonTypes: stored,
                        contactButtonType: stored[0],
                        displayScheduleAppointment:
                          stored.includes("calendar"),
                        displayUrl: stored.includes("url"),
                      });
                    }}
                  />
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
