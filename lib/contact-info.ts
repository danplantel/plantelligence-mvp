"use client";

import type { KeyContact } from "@/types/new-client-wizard";

export type ContactType = "Email" | "Phone" | "Custom" | "None";

export interface ContactInformation {
  primaryType: ContactType;
  primaryTypeCustom: string;
  primaryName: string;
  primaryEmail: string;
  primaryPhone: string;
  secondaryType: ContactType;
  secondaryTypeCustom: string;
  secondaryName: string;
  secondaryEmail: string;
  secondaryPhone: string;
  tertiaryType: ContactType;
  tertiaryTypeCustom: string;
  tertiaryName: string;
  tertiaryEmail: string;
  tertiaryPhone: string;
  planId: string;
}

const getContactType = (contact?: KeyContact): ContactType => {
  if (!contact) return "None";
  if (contact.contactButtonType === "email") return "Email";
  if (contact.contactButtonType === "phone") return "Phone";
  if (contact.customRole || contact.role === "Other") return "Custom";
  return "Email";
};

export function mapKeyContactsToContactInfo(
  keyContacts?: KeyContact[] | null,
): ContactInformation | null {
  // Ensure keyContacts is an array before processing
  if (!keyContacts || !Array.isArray(keyContacts) || keyContacts.length === 0) {
    return null;
  }

  const visibleContacts = keyContacts.filter(
    (contact) => contact.showOnPortal !== false,
  );
  if (visibleContacts.length === 0) {
    return null;
  }

  const primary =
    visibleContacts.find((contact) => contact.isPrimary) || visibleContacts[0];
  const remainingContacts = visibleContacts.filter(
    (contact) => contact.id !== primary?.id,
  );
  const secondary = remainingContacts[0];
  const tertiary = remainingContacts[1];

  return {
    primaryType: getContactType(primary),
    primaryTypeCustom: primary?.customRole || primary?.title || "",
    primaryName: primary?.name || "",
    primaryEmail: primary?.email || "",
    primaryPhone: primary?.phone || "",
    secondaryType: getContactType(secondary),
    secondaryTypeCustom: secondary?.customRole || secondary?.title || "",
    secondaryName: secondary?.name || "",
    secondaryEmail: secondary?.email || "",
    secondaryPhone: secondary?.phone || "",
    tertiaryType: getContactType(tertiary),
    tertiaryTypeCustom: tertiary?.customRole || tertiary?.title || "",
    tertiaryName: tertiary?.name || "",
    tertiaryEmail: tertiary?.email || "",
    tertiaryPhone: tertiary?.phone || "",
    planId: "",
  };
}

