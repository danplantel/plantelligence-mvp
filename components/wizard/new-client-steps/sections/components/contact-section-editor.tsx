"use client";

import { memo, useCallback } from "react";
import { toast } from "sonner";

import { KeyContactsEditor } from "@/components/contacts/key-contacts-editor";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import type { KeyContact } from "@/types/new-client-wizard";
import { useContactStyles } from "../hooks/use-contact-styles";

interface ContactSectionEditorProps {
  errorFields?: string[];
}

interface KeyContactsBlob {
  contacts: KeyContact[];
  contactDisplayOrder?: (string | number)[];
  [key: string]: unknown;
}

/**
 * Create Plan's Step 3 Edit Panel.
 *
 * The form itself lives in [`KeyContactsEditor`](../../../../contacts/key-contacts-editor.tsx:1),
 * because the portal's My Benefits Team panel draws the very same panel — the
 * accordions, the designation pills, the contact details and the CTA picker. This
 * component is only the WIZARD HOST: it feeds that form the draft store's
 * `keyContacts` and writes every edit back to the local store, the step endpoint
 * and the draft, which is what this panel has always done.
 */
export const ContactSectionEditor = memo(function ContactSectionEditor({
  errorFields = [],
}: ContactSectionEditorProps) {
  // The card colours live in the same blob, and this hook keeps them in step with
  // the store's brand colours as the panel renders — as it did when the form lived
  // in this file.
  useContactStyles();

  const { stepData, saveStepDataLocally, saveStepDataToServer, saveAsDraft } =
    useNewClientWizardStore();

  const keyContactsData = (stepData.keyContacts as KeyContactsBlob) || {
    contacts: [],
  };
  const savedContacts: KeyContact[] = keyContactsData.contacts || [];

  /**
   * Persist the blob: the local store first — the preview beside the panel reads
   * it — then the step endpoint and the draft.
   */
  const persist = useCallback(
    async (contacts: KeyContact[], extra?: Record<string, unknown>) => {
      const updatedData = { ...keyContactsData, contacts, ...extra };
      saveStepDataLocally("keyContacts", updatedData);
      try {
        await saveStepDataToServer("keyContacts", updatedData);
        await saveAsDraft();
        return true;
      } catch (error) {
        console.error("Failed to save key contacts:", error);
        return false;
      }
    },
    [keyContactsData, saveStepDataLocally, saveStepDataToServer, saveAsDraft],
  );

  // Every field writes through here as it changes. The save is fire-and-forget on
  // purpose: the "Save Changes" button below is what reports the outcome.
  const handlePatch = useCallback(
    (contactId: string | number, updates: Record<string, any>) => {
      const contacts = savedContacts.map((contact) =>
        contact.id === contactId ? { ...contact, ...updates } : contact,
      );
      void persist(contacts);
    },
    [savedContacts, persist],
  );

  /**
   * Commit one contact and report the outcome.
   *
   * The edits are already in the store, so this pins them locally, on the server
   * and in the draft in one go, and says whether the server accepted them. The
   * per-keystroke saves are fire-and-forget, so a failure would otherwise be
   * invisible.
   */
  const handleSaveContact = useCallback(
    async (contactId: string | number) => {
      void contactId;
      const accepted = await persist(savedContacts);
      if (!accepted) {
        toast.error(
          "Could not save this contact to the server. Your changes are kept locally.",
        );
        return false;
      }
      toast.success("Contact saved");
      return true;
    },
    [savedContacts, persist],
  );

  const handleDeleteContact = useCallback(
    async (contactId: string | number) => {
      const contacts = savedContacts.filter(
        (contact) => contact.id !== contactId,
      );
      const previousOrder = keyContactsData.contactDisplayOrder;
      const contactDisplayOrder = Array.isArray(previousOrder)
        ? previousOrder.filter((id) => id !== contactId)
        : contacts.map((contact) => contact.id);
      await persist(contacts, { contactDisplayOrder });
    },
    [savedContacts, keyContactsData, persist],
  );

  return (
    <KeyContactsEditor
      contacts={savedContacts}
      onPatch={handlePatch}
      onSaveContact={handleSaveContact}
      onDeleteContact={handleDeleteContact}
      errorFields={errorFields}
    />
  );
});
