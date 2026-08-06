"use client";

import { useContactStyles } from "../hooks/use-contact-styles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, memo } from "react";
import { RotateCcw, ChevronDown, ChevronUp, Globe, Calendar, Mail, Phone, Building2, Trash2, Star } from "lucide-react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { cn } from "@/lib/utils";
import { ContactFormFields } from "../../step-3-key-contacts/components/contact-form-fields";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { useEffect, useRef, useMemo } from "react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";

interface ContactSectionEditorProps {
    errorFields?: string[];
}

const CTA_TYPES = [
  { value: "schedule", label: "Schedule Appt.", icon: Calendar },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "contact", label: "Contact Form", icon: Globe },
] as const;

export const ContactSectionEditor = memo(function ContactSectionEditor({ errorFields = [] }: ContactSectionEditorProps) {
    const { styles, updateStyle } = useContactStyles();
    const { stepData, saveStepDataLocally, saveStepDataToServer, saveAsDraft } = useNewClientWizardStore();

    // Track which contact is expanded in the editor
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

    // Refs for scrolling to specific contact forms
    const contactRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const keyContactsData = stepData.keyContacts || { contacts: [] };
    const savedContacts: KeyContact[] = keyContactsData.contacts || [];

    // Listen for the focus event from the preview cards
    useEffect(() => {
        const handleFocusContact = (event: any) => {
            const contactId = event.detail.contactId;
            setExpandedContactId(contactId);

            // Scroll to the contact element with a slight delay to allow state update
            setTimeout(() => {
                const element = contactRefs.current[contactId];
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 100);
        };

        window.addEventListener("focusContact", handleFocusContact);
        return () => window.removeEventListener("focusContact", handleFocusContact);
    }, []);

    const handleUpdateContactFields = async (contactId: string, updates: Record<string, any>) => {
        const updatedContacts = savedContacts.map(c => {
            if (c.id === contactId) {
                const updated = { ...c, ...updates };
                // Handle complex derived names if necessary
                if (updates.firstName !== undefined || updates.lastName !== undefined) {
                    updated.name = `${updated.firstName || ""} ${updated.lastName || ""}`.trim();
                } else if (updates.displayName !== undefined) {
                    updated.name = updated.displayName || "";
                }
                return updated;
            }
            return c;
        });

        const updatedData = { ...keyContactsData, contacts: updatedContacts };
        saveStepDataLocally("keyContacts", updatedData);

        // Also save to server and draft for persistence
        try {
            await saveStepDataToServer("keyContacts", updatedData);
            await saveAsDraft();
        } catch (error) {
            console.error("Failed to save contact update to server:", error);
        }
    };

    const handleUpdateContactField = (contactId: string, field: string, value: any) => {
        handleUpdateContactFields(contactId, { [field]: value });
    };

    const handleDeleteContactFromEditor = async (
        contactId: string,
        e: React.MouseEvent<HTMLButtonElement>,
    ) => {
        e.preventDefault();
        e.stopPropagation();
        const updatedContacts = savedContacts.filter((c) => c.id !== contactId);
        const prevOrder = (keyContactsData as { contactDisplayOrder?: string[] })
            .contactDisplayOrder;
        const nextOrder = Array.isArray(prevOrder)
            ? prevOrder.filter((id) => id !== contactId)
            : updatedContacts.map((c) => c.id);
        const updatedData = {
            ...keyContactsData,
            contacts: updatedContacts,
            contactDisplayOrder: nextOrder,
        };
        saveStepDataLocally("keyContacts", updatedData);
        if (expandedContactId === contactId) {
            setExpandedContactId(null);
        }
        try {
            await saveStepDataToServer("keyContacts", updatedData);
            await saveAsDraft();
        } catch (error) {
            console.error("Failed to save after deleting contact:", error);
        }
    };

    const resolveCategory = (contact: any): string => {
        return contact.benefitsCategories?.[0] || contact.benefitsCategory || "";
    };

    return (
        <div className="space-y-8 pb-20">

            {/* Section 2: Individual Contacts */}
            <div data-section-id="contacts-list" className="space-y-6">
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide dark:text-gray-400">
                        Contact Details
                    </h3>
                    <div className="h-px w-12 bg-border dark:bg-gray-600 mt-2" />
                </div>

                <div className="space-y-4">
                    {savedContacts.map((contact, index) => {
                        const isExpanded = expandedContactId === contact.id;
                        const contactName = contact.name || (contact.contactType === "individual" ? "New Individual" : "New Team");
                        const category = resolveCategory(contact);
                        const isPlanSponsor = category === "Company / Plan Sponsor";
                        const ctaType = (contact.contactButtonType === "calendar" ? "schedule"
                            : contact.contactButtonType === "phone" ? "call"
                            : contact.contactButtonType === "email" ? "email"
                            : contact.contactButtonType === "url" ? "contact"
                            : "schedule") as "schedule" | "call" | "email" | "contact";
                        const hasCtaEnabled = !!(contact as any).enableContactButton;

                        return (
                            <Card
                                key={contact.id}
                                ref={(el) => (contactRefs.current[contact.id] = el)}
                                className={cn(
                                    "transition-all duration-200 border",
                                    isExpanded ? "ring-2 ring-accent-blue shadow-md" : "hover:border-gray-300"
                                )}
                            >
                                <div
                                    className="p-4 cursor-pointer flex items-center justify-between bg-white dark:bg-gray-800"
                                    onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-accent-blue/5 dark:bg-accent-blue/10 flex items-center justify-center text-accent-blue font-semibold text-xs">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{contactName}</h4>
                                            <p className="text-xs text-muted-foreground dark:text-gray-400">{contact.benefitsCategory}</p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/50 space-y-4">
                                        {/* Primary Contact Toggle — hidden for Company / Plan Sponsor */}
                                        {!isPlanSponsor && (
                                            <div className="pb-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`is-primary-${contact.id}`}
                                                        checked={contact.isPrimaryOverall || contact.isPrimary || false}
                                                        onCheckedChange={(checked) => {
                                                            const isPrimary = checked === true;
                                                            if (isPrimary) {
                                                                const updatedContacts = savedContacts.map((c: any) => {
                                                                    if (c.id === contact.id) {
                                                                        return { ...c, isPrimary: true, isPrimaryOverall: true };
                                                                    }
                                                                    const cCat = c.benefitsCategories?.[0] || c.benefitsCategory || "";
                                                                    if (cCat === category && (c.isPrimary || c.isPrimaryOverall)) {
                                                                        return { ...c, isPrimary: false, isPrimaryOverall: false };
                                                                    }
                                                                    return c;
                                                                });
                                                                const updatedData = { ...keyContactsData, contacts: updatedContacts };
                                                                saveStepDataLocally("keyContacts", updatedData);
                                                            } else {
                                                                handleUpdateContactFields(contact.id, { isPrimary: false, isPrimaryOverall: false });
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
                                                        handleUpdateContactField(contact.id, "contactType", "individual");
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all",
                                                        (contact.contactType || "individual") === "individual"
                                                            ? "border-accent-blue bg-accent-blue/5 dark:bg-accent-blue/10 shadow-sm"
                                                            : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500",
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                                        (contact.contactType || "individual") === "individual" ? "border-accent-blue" : "border-gray-300 dark:border-gray-600",
                                                    )}>
                                                        {(contact.contactType || "individual") === "individual" && (
                                                            <div className="w-2 h-2 rounded-full bg-accent-blue" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">Individual</span>
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">A specific person</span>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateContactField(contact.id, "contactType", "team_support");
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all",
                                                        contact.contactType === "team_support"
                                                            ? "border-accent-blue bg-accent-blue/5 dark:bg-accent-blue/10 shadow-sm"
                                                            : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500",
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                                        contact.contactType === "team_support" ? "border-accent-blue" : "border-gray-300 dark:border-gray-600",
                                                    )}>
                                                        {contact.contactType === "team_support" && (
                                                            <div className="w-2 h-2 rounded-full bg-accent-blue" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">Team / Support</span>
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">A department or group</span>
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
                                            onFirstNameChange={(v) => handleUpdateContactField(contact.id, "firstName", v)}
                                            onLastNameChange={(v) => handleUpdateContactField(contact.id, "lastName", v)}
                                            onTitleChange={(v) => handleUpdateContactField(contact.id, "title", v)}
                                            onDisplayNameChange={(v) => handleUpdateContactField(contact.id, "displayName", v)}
                                            onDepartmentLabelChange={(v) => handleUpdateContactField(contact.id, "departmentLabel", v)}
                                            onSupportHoursChange={(v) => handleUpdateContactField(contact.id, "supportHours", v)}
                                            onHeadshotChange={(v, fn) => {
                                                handleUpdateContactFields(contact.id, { headshot: v, headshotFileName: fn });
                                            }}
                                            onHeadshotRemove={() => {
                                                handleUpdateContactFields(contact.id, { headshot: "", headshotFileName: "" });
                                            }}
                                            headshot={contact.headshot || ""}
                                            headshotFileName={contact.headshotFileName || ""}
                                            hideHeadshotPreview
                                        />

                                        {/* Company / Organization — for non-Plan-Sponsor */}
                                        {!isPlanSponsor && (
                                            <div className="space-y-1.5 pt-2 border-t">
                                                <Label className="text-xs font-medium">
                                                    Company / Organization <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    value={contact.companyName || ""}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateContactField(contact.id, "companyName", e.target.value)}
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
                                                    Upload a logo to display on this contact&rsquo;s portal card.
                                                </p>
                                                <div className="pt-1">
                                                    <UniversalImageEditorModal
                                                        value={(contact as any).companyLogo || ""}
                                                        fileName={(contact as any).companyLogoFileName || ""}
                                                        onChange={(value, fileName) => {
                                                            handleUpdateContactFields(contact.id, { companyLogo: value, companyLogoFileName: fileName });
                                                        }}
                                                        onRemove={() => {
                                                            handleUpdateContactFields(contact.id, { companyLogo: "", companyLogoFileName: "" });
                                                        }}
                                                        placeholder="Upload Contact Company Logo"
                                                        modalTitle="Edit Contact Company Logo"
                                                        modalDescription="Upload a logo for this contact's portal card."
                                                        saveButtonText="Save Logo"
                                                        type="logo"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2 pt-2 border-t dark:border-gray-700 mt-4">
                                            <Label className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Contact Info</Label>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Email</Label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                                        <Input
                                                            className="pl-9 h-9 text-sm"
                                                            value={contact.email || ""}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateContactField(contact.id, "email", e.target.value)}
                                                            placeholder="email@example.com"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Phone</Label>
                                                        <div className="relative">
                                                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                                            <Input
                                                                className="pl-9 h-9 text-sm"
                                                                value={contact.phone || ""}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateContactField(contact.id, "phone", e.target.value)}
                                                                placeholder="(555) 000-0000"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Extension</Label>
                                                        <Input
                                                            className="h-9 text-sm"
                                                            value={contact.phoneExtension || ""}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateContactField(contact.id, "phoneExtension", e.target.value)}
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
                                                        handleUpdateContactFields(contact.id, {
                                                            enableContactButton: enabled,
                                                            displayScheduleAppointment: enabled ? (ctaType === "schedule") : false,
                                                            displayUrl: enabled ? (ctaType === "contact") : false,
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
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {CTA_TYPES.map((opt) => {
                                                            const isActive = ctaType === opt.value;
                                                            const Icon = opt.icon;
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newContactButtonType =
                                                                            opt.value === "schedule" ? "calendar"
                                                                            : opt.value === "call" ? "phone"
                                                                            : opt.value === "email" ? "email"
                                                                            : "url";
                                                                        handleUpdateContactFields(contact.id, {
                                                                            contactButtonType: newContactButtonType,
                                                                            displayScheduleAppointment: opt.value === "schedule",
                                                                            displayUrl: opt.value === "contact",
                                                                        });
                                                                    }}
                                                                    className={cn(
                                                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-all",
                                                                        isActive
                                                                            ? "border-accent-blue bg-accent-blue/5 dark:bg-accent-blue/10 shadow-sm"
                                                                            : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500",
                                                                    )}
                                                                >
                                                                    <Icon
                                                                        className={cn(
                                                                            "w-3.5 h-3.5 flex-shrink-0",
                                                                            isActive ? "text-accent-blue" : "text-gray-400 dark:text-gray-500",
                                                                        )}
                                                                    />
                                                                    <span className="text-[11px] font-medium">{opt.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {ctaType === "schedule" && (
                                                        <div className="space-y-1">
                                                            <Label className="text-xs font-medium">Scheduling URL</Label>
                                                            <Input
                                                                value={(contact as any).schedulingUrl || ""}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateContactField(contact.id, "schedulingUrl", e.target.value)}
                                                                placeholder="https://calendly.com/..."
                                                                className="h-9 text-sm"
                                                            />
                                                        </div>
                                                    )}

                                                    {ctaType === "contact" && (
                                                        <div className="space-y-1">
                                                            <Label className="text-xs font-medium">Contact Form URL</Label>
                                                            <Input
                                                                value={(contact as any).websiteUrl || ""}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateContactField(contact.id, "websiteUrl", e.target.value)}
                                                                placeholder="https://forms.company.com/..."
                                                                className="h-9 text-sm"
                                                            />
                                                        </div>
                                                    )}

                                                    {ctaType === "call" && (
                                                        <div className="space-y-1">
                                                            <Label className="text-xs font-medium">Phone Number</Label>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2.5 py-1.5">
                                                                {contact.phone || "Complete the Phone field above first"}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {ctaType === "email" && (
                                                        <div className="space-y-1">
                                                            <Label className="text-xs font-medium">Email</Label>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2.5 py-1.5">
                                                                {contact.email || "Complete the Email field above first"}
                                                            </p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t mt-2 flex justify-end">
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
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
