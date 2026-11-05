"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Phone,
  Save,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactCtaPicker } from "@/components/ui/contact-cta-picker";
import { ContactEmailConflictHint } from "@/components/ui/contact-email-conflict-notice";
import { ContactFormFields } from "@/components/ui/contact-form-fields";
import { ChipTypeahead } from "@/components/ui/chip-typeahead";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import {
  designationAcronym,
  designationLabel,
  getDesignationOptions,
} from "@/config/onboarding/designations";
import { toContactCtaOptions, toStoredCtaTypes } from "@/lib/contact-cta";
import { cn } from "@/lib/utils";
import type { KeyContact } from "@/types/new-client-wizard";

/** The most designations one contact may carry — the same cap the contact form enforces. */
const MAX_DESIGNATIONS = 5;

/**
 * The dictionary the picker offers — the same list, and the same acronym-first row
 * labels, the contact form and the advisor's own profile use. Values are ids;
 * `designationLabel` renders them and free text passes through untouched.
 */
const DESIGNATION_OPTIONS = getDesignationOptions().map((option) => ({
  value: option.value,
  label: `${option.acronym} – ${option.label}`,
  keywords: [option.acronym, option.value, option.label],
}));

/**
 * Trim, drop blanks and cap the list — the same cleaning the contact form applies,
 * so the editor can never store more entries (or longer ones) than the form can.
 */
const cleanDesignations = (values: string[]): string[] =>
  values
    .map((value) => value.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, MAX_DESIGNATIONS);

/** One contact's categories, oldest field first. */
function contactCategories(contact: KeyContact): string[] {
  const list = (contact as any).benefitsCategories;
  if (Array.isArray(list) && list.length > 0) return list;
  const single = (contact as any).benefitsCategory;
  return single ? [single] : [];
}

/** The category a contact leads with — the one the primary flag applies to. */
function resolveCategory(contact: KeyContact): string {
  return contactCategories(contact)[0] || "";
}

export interface KeyContactsEditorProps {
  /** The contacts to list, in display order. */
  contacts: KeyContact[];
  /**
   * Apply one contact's changed fields. Called on every keystroke, so the host can
   * repaint its live preview before anything is persisted.
   */
  onPatch: (
    contactId: string | number,
    updates: Record<string, any>,
  ) => void;
  /**
   * Commit one contact. Resolves `true` when the host accepted the write, so the
   * row can stop spinning and say nothing went wrong.
   */
  onSaveContact: (contactId: string | number) => Promise<boolean>;
  /** Remove one contact. */
  onDeleteContact: (contactId: string | number) => Promise<void>;
  /** Highlights the listed fields when the host has validation to report. */
  errorFields?: string[];
  /** Shown instead of the list when the plan has no contacts. */
  emptyMessage?: React.ReactNode;
  /** Section heading above the list. */
  heading?: string;
  /**
   * Number this block as a section of its host panel ("Section 2: Contact
   * Details"). Omitted in the wizard, whose panel lists this form on its own.
   */
  sectionNumber?: number;
}

/**
 * The key-contacts form, exactly as the Create Plan wizard's Step 3 Edit Panel
 * draws it: one collapsible card per contact, carrying the contact fields, the
 * designation pills, the company logo, the contact details and the call-to-action
 * picker.
 *
 * It owns no storage. The wizard binds it to the draft store; the portal binds it
 * to the plan's `keyContacts` blob — so the two hosts cannot drift, which is the
 * whole reason the wizard's form lives here rather than being copied.
 */
export const KeyContactsEditor = memo(function KeyContactsEditor({
  contacts,
  onPatch,
  onSaveContact,
  onDeleteContact,
  errorFields = [],
  emptyMessage,
  heading = "Contact Details",
  sectionNumber,
}: KeyContactsEditorProps) {
  // Which contact's card is open. Only one at a time, as the wizard has it.
  const [expandedContactId, setExpandedContactId] = useState<
    string | number | null
  >(null);

  // The contact whose "Save Changes" is in flight, so only its own button shows
  // the spinner / disables — the cards are independent.
  const [savingContactId, setSavingContactId] = useState<
    string | number | null
  >(null);

  // Refs for scrolling to a specific contact's card
  const contactRefs = useRef<
    Record<string | number, HTMLDivElement | null>
  >({});

  // The preview's Edit button opens the card that was clicked. The wizard
  // dispatches this on `window`; a host that has nothing to dispatch simply
  // never fires it.
  useEffect(() => {
    const handleFocusContact = (event: any) => {
      const contactId = event?.detail?.contactId;
      if (contactId === undefined) return;
      setExpandedContactId(contactId);
      setTimeout(() => {
        contactRefs.current[contactId]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    };

    window.addEventListener("focusContact", handleFocusContact);
    return () => window.removeEventListener("focusContact", handleFocusContact);
  }, []);

  /**
   * Patch one contact.
   *
   * A name is derived here rather than in each host: editing a first or last name
   * rewrites the stored `name`, and a team / support line's `displayName` is the
   * name. Both hosts store that field, so both need the same rule.
   */
  const patchContact = useCallback(
    (contactId: string | number, updates: Record<string, any>) => {
      const next = { ...updates };
      if (
        updates.firstName !== undefined ||
        updates.lastName !== undefined
      ) {
        const current = contacts.find((entry) => entry.id === contactId);
        const firstName =
          updates.firstName !== undefined
            ? updates.firstName
            : (current as any)?.firstName || "";
        const lastName =
          updates.lastName !== undefined
            ? updates.lastName
            : (current as any)?.lastName || "";
        next.name = `${firstName || ""} ${lastName || ""}`.trim();
      } else if (updates.displayName !== undefined) {
        next.name = updates.displayName || "";
      }
      onPatch(contactId, next);
    },
    [contacts, onPatch],
  );

  /**
   * Make one contact the primary for its category.
   *
   * The flag is per category, so promoting one demotes whichever contact led that
   * category before — written as two patches so every host persists it the same
   * way it persists any other field.
   */
  const setPrimary = useCallback(
    (contactId: string | number, category: string) => {
      contacts.forEach((entry) => {
        if (entry.id === contactId) {
          onPatch(entry.id, { isPrimary: true, isPrimaryOverall: true });
          return;
        }
        const isPreviousPrimary =
          (entry as any).isPrimary || (entry as any).isPrimaryOverall;
        if (isPreviousPrimary && resolveCategory(entry) === category) {
          onPatch(entry.id, { isPrimary: false, isPrimaryOverall: false });
        }
      });
    },
    [contacts, onPatch],
  );

  const handleSaveContactChanges = async (
    contactId: string | number,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSavingContactId(contactId);
    try {
      await onSaveContact(contactId);
    } finally {
      setSavingContactId(null);
    }
  };

  const handleDeleteContactFromEditor = async (
    contactId: string | number,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (expandedContactId === contactId) setExpandedContactId(null);
    await onDeleteContact(contactId);
  };

  if (contacts.length === 0 && emptyMessage) {
    return <>{emptyMessage}</>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div data-section-id="contacts-list" className="space-y-6">
        {sectionNumber == null ? (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide dark:text-gray-400">
              {heading}
            </h3>
            <div className="h-px w-12 bg-border dark:bg-gray-600 mt-2" />
          </div>
        ) : (
          <SectionHeader number={sectionNumber} title={heading} />
        )}

        <div className="space-y-4">
          {contacts.map((contact, index) => {
            const isExpanded = expandedContactId === contact.id;
            const contactName =
              contact.name ||
              (contact.contactType === "individual"
                ? "New Individual"
                : "New Team");
            const category = resolveCategory(contact);
            const isPlanSponsor = category === "Company / Plan Sponsor";
            // EVERY CTA this contact carries, in the advisor's order. A row saved
            // before the array existed falls back to its single value, so an old
            // contact still shows the button it always had.
            const ctaTypes = toContactCtaOptions(contact);
            const hasCtaEnabled = !!(contact as any).enableContactButton;

            return (
              // ONE border, square-edged. `<Card>` would draw its own rounded
              // `rounded-xl` frame underneath this one, and the expanded state added
              // a `ring` on top of it — which read as two borders, one rounded and
              // one sharp. A plain div keeps the single sharp frame every row shares.
              <div
                key={contact.id}
                data-testid="key-contact-row"
                ref={(el) => {
                  contactRefs.current[contact.id] = el;
                }}
                className={cn(
                  "rounded-none border bg-card text-card-foreground transition-all duration-200",
                  isExpanded
                    ? "border-accent-blue shadow-md"
                    : "border-[#efefef] hover:border-gray-300 dark:border-[#1c1c1c]",
                )}
              >
                <div
                  className="p-4 cursor-pointer flex items-center justify-between bg-white dark:bg-gray-800"
                  onClick={() =>
                    setExpandedContactId(isExpanded ? null : contact.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-blue/5 dark:bg-accent-blue/10 flex items-center justify-center text-accent-blue font-semibold text-xs">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {contactName}
                      </h4>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        {contact.benefitsCategory}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  )}
                </div>

                {isExpanded && (
                  <div className="p-4 border-t dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/50 space-y-4">
                    {/* Primary Contact Toggle — hidden for Company / Plan Sponsor */}
                    {!isPlanSponsor && (
                      <div className="pb-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`is-primary-${contact.id}`}
                            checked={
                              contact.isPrimaryOverall ||
                              contact.isPrimary ||
                              false
                            }
                            onCheckedChange={(checked) => {
                              if (checked === true) {
                                setPrimary(contact.id, category);
                              } else {
                                patchContact(contact.id, {
                                  isPrimary: false,
                                  isPrimaryOverall: false,
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`is-primary-${contact.id}`}
                            className="text-xs font-medium cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                            Mark as primary contact for this category
                          </Label>
                        </div>
                      </div>
                    )}

                    {/* Contact Type Toggle */}
                    <div className="space-y-1.5">
                      <Label className="font-medium text-xs">Contact Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            patchContact(contact.id, {
                              contactType: "individual",
                            });
                          }}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all",
                            (contact.contactType || "individual") ===
                              "individual"
                              ? "border-accent-blue bg-accent-blue/5 dark:bg-accent-blue/10 shadow-sm"
                              : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                              (contact.contactType || "individual") ===
                                "individual"
                                ? "border-accent-blue"
                                : "border-gray-300 dark:border-gray-600",
                            )}
                          >
                            {(contact.contactType || "individual") ===
                              "individual" && (
                              <div className="w-2 h-2 rounded-full bg-accent-blue" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                              Individual
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              A specific person
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            patchContact(contact.id, {
                              contactType: "team_support",
                            });
                          }}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all",
                            contact.contactType === "team_support"
                              ? "border-accent-blue bg-accent-blue/5 dark:bg-accent-blue/10 shadow-sm"
                              : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                              contact.contactType === "team_support"
                                ? "border-accent-blue"
                                : "border-gray-300 dark:border-gray-600",
                            )}
                          >
                            {contact.contactType === "team_support" && (
                              <div className="w-2 h-2 rounded-full bg-accent-blue" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                              Team / Support
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              A department or group
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>

                    <ContactFormFields
                      contactType={contact.contactType || "individual"}
                      firstName={contact.firstName || ""}
                      lastName={contact.lastName || ""}
                      title={contact.title || ""}
                      displayName={contact.displayName || ""}
                      departmentLabel={contact.departmentLabel || ""}
                      supportHours={contact.supportHours || ""}
                      onFirstNameChange={(v) =>
                        patchContact(contact.id, { firstName: v })
                      }
                      onLastNameChange={(v) =>
                        patchContact(contact.id, { lastName: v })
                      }
                      onTitleChange={(v) =>
                        patchContact(contact.id, { title: v })
                      }
                      onDisplayNameChange={(v) =>
                        patchContact(contact.id, { displayName: v })
                      }
                      onDepartmentLabelChange={(v) =>
                        patchContact(contact.id, { departmentLabel: v })
                      }
                      onSupportHoursChange={(v) =>
                        patchContact(contact.id, { supportHours: v })
                      }
                      onHeadshotChange={(v, fn) => {
                        patchContact(contact.id, {
                          headshot: v,
                          headshotFileName: fn,
                        });
                      }}
                      onHeadshotRemove={() => {
                        patchContact(contact.id, {
                          headshot: "",
                          headshotFileName: "",
                        });
                      }}
                      headshot={contact.headshot || ""}
                      headshotFileName={contact.headshotFileName || ""}
                      hideHeadshotPreview
                    />

                    {/* Designations — the pill picker the contact form and the
                        advisor's own profile use: a typeahead over the shared
                        dictionary, chips you can drag to reorder, and a custom entry
                        for anything the dictionary does not list. Individual contacts
                        only, because a Team / Support Line's cards suppress the row
                        and the contact form does not offer it for them either. */}
                    {contact.contactType !== "team_support" && (
                      <div className="space-y-1.5 pt-2 border-t dark:border-gray-700">
                        <Label className="text-xs font-medium">
                          Designations (optional)
                        </Label>
                        <ChipTypeahead
                          options={DESIGNATION_OPTIONS}
                          selectedValues={
                            Array.isArray(contact.designations)
                              ? contact.designations
                              : []
                          }
                          valueLabel={designationLabel}
                          chipLabel={designationAcronym}
                          onChange={(values) =>
                            patchContact(contact.id, {
                              designations: cleanDesignations(values),
                            })
                          }
                          placeholder="Type a designation, e.g. CFP®…"
                          allowCustom
                          customOptionLabel={(query) =>
                            `Add as custom designation: “${query}”`
                          }
                          maxSelections={MAX_DESIGNATIONS}
                          dataField={`designations-${contact.id}`}
                        />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Up to {MAX_DESIGNATIONS}. They display in this order.
                          Drag to reorder.
                        </p>
                      </div>
                    )}

                    {/* Company / Organization — for non-Plan-Sponsor */}
                    {!isPlanSponsor && (
                      <div className="space-y-1.5 pt-2 border-t">
                        <Label className="text-xs font-medium">
                          Company / Organization{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={contact.companyName || ""}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            patchContact(contact.id, {
                              companyName: e.target.value,
                            })
                          }
                          placeholder="e.g. Benefits Provider Inc."
                          className="h-9 text-sm"
                        />
                      </div>
                    )}

                    {/* Contact Company Logo — for non-Plan-Sponsor */}
                    {!isPlanSponsor && (
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2.5">
                        <Label className="text-xs font-medium">
                          Contact Company Logo
                        </Label>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Upload a logo to display on this contact&rsquo;s portal
                          card.
                        </p>
                        <div className="pt-1">
                          <UniversalImageEditorModal
                            value={(contact as any).companyLogo || ""}
                            fileName={
                              (contact as any).companyLogoFileName || ""
                            }
                            onChange={(value, fileName) => {
                              patchContact(contact.id, {
                                companyLogo: value,
                                companyLogoFileName: fileName,
                              });
                            }}
                            onRemove={() => {
                              patchContact(contact.id, {
                                companyLogo: "",
                                companyLogoFileName: "",
                              });
                            }}
                            placeholder="Upload Contact Company Logo"
                            modalTitle="Contact Company Logo"
                            modalDescription="Upload a logo for this contact's portal card."
                            saveButtonText="Save Logo"
                            type="logo"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t dark:border-gray-700 mt-4">
                      <Label className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Contact Info
                      </Label>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <Input
                              className="pl-9 h-9 text-sm"
                              value={contact.email || ""}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                patchContact(contact.id, {
                                  email: e.target.value,
                                })
                              }
                              placeholder="email@example.com"
                            />
                          </div>
                          {/* Duplicate-address check only: this row auto-saves on
                              every keystroke, so there is no save to block, and
                              skipping the seat lookup avoids flagging a contact that
                              legitimately is the owner / a teammate. */}
                          <ContactEmailConflictHint
                            planId={null}
                            email={contact.email}
                            excludeContactId={contact.id}
                            genericMessage
                            contacts={contacts}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Phone</Label>
                            <div className="relative">
                              <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                              <Input
                                className="pl-9 h-9 text-sm"
                                value={contact.phone || ""}
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) =>
                                  patchContact(contact.id, {
                                    phone: e.target.value,
                                  })
                                }
                                placeholder="(555) 000-0000"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Extension</Label>
                            <Input
                              className="h-9 text-sm"
                              value={contact.phoneExtension || ""}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                patchContact(contact.id, {
                                  phoneExtension: e.target.value,
                                })
                              }
                              placeholder="Ext."
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CTA Button Section */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2.5">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`enable-cta-${contact.id}`}
                          checked={hasCtaEnabled}
                          onCheckedChange={(checked) => {
                            const enabled = checked === true;
                            // Enabling with nothing chosen starts from the familiar
                            // "Schedule Appt." so the card is never left with a
                            // checked box and no button; the picker then caps the
                            // list at two.
                            const next = enabled
                              ? ctaTypes.length > 0
                                ? ctaTypes
                                : (["schedule"] as typeof ctaTypes)
                              : [];
                            const stored = toStoredCtaTypes(next);
                            patchContact(contact.id, {
                              enableContactButton: enabled,
                              contactButtonType: stored[0],
                              contactButtonTypes: stored,
                              displayScheduleAppointment:
                                stored.includes("calendar"),
                              displayUrl: stored.includes("url"),
                            });
                          }}
                        />
                        <Label
                          htmlFor={`enable-cta-${contact.id}`}
                          className="text-xs font-medium cursor-pointer"
                        >
                          Add a call to action button
                        </Label>
                      </div>

                      {hasCtaEnabled && (
                        <>
                          {/* The same two-CTA control every other contact editor
                              renders. Selection is written through the shared
                              helpers, so the array and the legacy single field can
                              never disagree. */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <ContactCtaPicker
                              value={ctaTypes}
                              onChange={(next) => {
                                const stored = toStoredCtaTypes(next);
                                patchContact(contact.id, {
                                  contactButtonTypes: stored,
                                  contactButtonType: stored[0],
                                  displayScheduleAppointment:
                                    stored.includes("calendar"),
                                  displayUrl: stored.includes("url"),
                                });
                              }}
                            />
                          </div>

                          {ctaTypes.includes("schedule") && (
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">
                                Scheduling URL
                              </Label>
                              <Input
                                value={(contact as any).schedulingUrl || ""}
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) =>
                                  patchContact(contact.id, {
                                    schedulingUrl: e.target.value,
                                  })
                                }
                                placeholder="https://calendly.com/..."
                                className="h-9 text-sm"
                              />
                            </div>
                          )}

                          {ctaTypes.includes("contact") && (
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">
                                Contact Form URL
                              </Label>
                              <Input
                                value={(contact as any).websiteUrl || ""}
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) =>
                                  patchContact(contact.id, {
                                    websiteUrl: e.target.value,
                                  })
                                }
                                placeholder="https://forms.company.com/..."
                                className="h-9 text-sm"
                              />
                            </div>
                          )}

                          {ctaTypes.includes("call") && (
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">
                                Phone Number
                              </Label>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2.5 py-1.5">
                                {contact.phone ||
                                  "Complete the Phone field above first"}
                              </p>
                            </div>
                          )}

                          {ctaTypes.includes("email") && (
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">
                                Email
                              </Label>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2.5 py-1.5">
                                {contact.email ||
                                  "Complete the Email field above first"}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="pt-4 border-t mt-2 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-9"
                        disabled={savingContactId === contact.id}
                        onClick={(e) =>
                          void handleSaveContactChanges(contact.id, e)
                        }
                      >
                        {savingContactId === contact.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {savingContactId === contact.id
                          ? "Saving…"
                          : "Save Changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) =>
                          void handleDeleteContactFromEditor(contact.id, e)
                        }
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete contact
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
