"use client";

import { useContactStyles } from "../hooks/use-contact-styles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { useState, memo } from "react";
import { RotateCcw, Palette, Users, ChevronDown, ChevronUp, User, Globe, Calendar, Mail, Phone, Building2, Trash2 } from "lucide-react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Maximize2 } from "lucide-react";
import { ContactFormFields } from "../../step-3-key-contacts/components/contact-form-fields";
import { CompanyNameSelector } from "../../step-3-key-contacts/components/company-name-selector";
import { ContactCardActions } from "../../step-3-key-contacts/components/contact-card-actions";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import { Badge } from "@/components/ui/badge";

interface ContactSectionEditorProps {
    errorFields?: string[];
}

/**
 * Memoized slider for logo scale. Extracted so that the `value` array is
 * stable across re-renders — without this, `[contact.logoScale || 1]` creates
 * a new array every render, which can cause Radix Slider's internal
 * `useComposedRefs` to enter an infinite loop during rapid re-renders.
 */
const LogoScaleSlider = memo(function LogoScaleSlider({
  logoScale,
  onLogoScaleChange,
}: {
  logoScale: number;
  onLogoScaleChange: (value: number) => void;
}) {
  // Stabilise the value array so Radix Slider only sees changes when the
  // actual number changes, not when the parent creates a fresh array literal.
  const sliderValue = useMemo(() => [logoScale], [logoScale]);

  return (
    <>
      <Slider
        value={sliderValue}
        onValueChange={([value]) => onLogoScaleChange(value)}
        min={0.5}
        max={2}
        step={0.05}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
        <span>0.5x</span>
        <span>{logoScale.toFixed(2)}x</span>
        <span>2.0x</span>
      </div>
    </>
  );
});

export const ContactSectionEditor = memo(function ContactSectionEditor({ errorFields = [] }: ContactSectionEditorProps) {
    const { styles, updateStyle } = useContactStyles();
    const { stepData, saveStepDataLocally, saveStepDataToServer, saveAsDraft } = useNewClientWizardStore();

    // Track which picker is open for which contact
    const [activePicker, setActivePicker] = useState<{ id: string, type: 'background' } | null>(null);

    // Track which contact is expanded in the editor
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

    // Refs for scrolling to specific contact forms
    const contactRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const keyContactsData = stepData.keyContacts || { contacts: [] };
    const savedContacts: KeyContact[] = keyContactsData.contacts || [];

    const handleReset = (contactId?: string) => {
        if (contactId) {
            handleUpdateContactFields(contactId, {
                cardBackgroundColor: undefined,
                logoScale: undefined
            });
        } else {
            updateStyle("cardBackgroundColor", "#ffffff");
            updateStyle("logoScale", 1);
        }
    };

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

    return (
        <div className="space-y-8 pb-20">

            {/* Section 2: Individual Contacts */}
            <div data-section-id="contacts-list" className="space-y-6">
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Contact Details & Styling
                    </h3>
                    <div className="h-px w-12 bg-border mt-2" />
                </div>

                <div className="space-y-4">
                    {savedContacts.map((contact, index) => {
                        const isExpanded = expandedContactId === contact.id;
                        const contactName = contact.name || (contact.contactType === "individual" ? "New Individual" : "New Team");

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
                                    className="p-4 cursor-pointer flex items-center justify-between bg-white"
                                    onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-accent-blue/5 flex items-center justify-center text-accent-blue font-semibold text-xs">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900">{contactName}</h4>
                                            <p className="text-xs text-muted-foreground">{contact.benefitsCategory}</p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t bg-gray-50/30 space-y-4">
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
                                        />

                                        <div className="space-y-2 pt-2 border-t mt-4">
                                            <Label className="text-xs font-medium uppercase text-gray-500">Contact Info</Label>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Email</Label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
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
                                                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
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

                                        <div className="space-y-2 pt-4 border-t">
                                            <Label className="text-xs font-medium uppercase text-gray-500">Actions & Links</Label>
                                            <ContactCardActions
                                                displayEmail={contact.displayEmail ?? true}
                                                displayPhone={contact.displayPhone ?? true}
                                                displayScheduleAppointment={contact.displayScheduleAppointment ?? false}
                                                displayWebsite={contact.displayUrl ?? false}
                                                onEmailChange={(v) => handleUpdateContactField(contact.id, "displayEmail", v)}
                                                onPhoneChange={(v) => handleUpdateContactField(contact.id, "displayPhone", v)}
                                                onScheduleAppointmentChange={(v) => handleUpdateContactField(contact.id, "displayScheduleAppointment", v)}
                                                onWebsiteChange={(v) => handleUpdateContactField(contact.id, "displayUrl", v)}
                                                contactInfoOrder={contact.contactInfoOrder as any || ["phone", "email"]}
                                                onContactInfoOrderChange={(v) => handleUpdateContactField(contact.id, "contactInfoOrder", v)}
                                                actionButtonOrder={contact.actionButtonOrder as any || ["schedule", "website"]}
                                                onActionButtonOrderChange={(v) => handleUpdateContactField(contact.id, "actionButtonOrder", v)}
                                            />
                                        </div>

                                        {/* Card Styling: same colors panel as main contact for all category cards */}
                                        <div className="space-y-2 pt-4 border-t">
                                            <div className="flex items-center justify-between mb-3">
                                                <Label className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Card Styling</Label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-[11px] text-muted-foreground hover:text-accent-blue hover:bg-accent-blue/5 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateContactFields(contact.id, { cardBackgroundColor: undefined, logoScale: undefined });
                                                    }}
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                                    Reset to Brand
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                <div className="space-y-2 relative">
                                                    <Label className="text-sm font-medium text-gray-700">Card Background</Label>
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            variant="outline"
                                                            className="h-9 w-full rounded-md border border-gray-200 cursor-pointer flex items-center px-3 gap-3 justify-start font-normal hover:bg-white hover:border-gray-300 transition-all shadow-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActivePicker(activePicker?.id === contact.id && activePicker?.type === 'background' ? null : { id: contact.id, type: 'background' });
                                                            }}
                                                        >
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 shadow-sm" style={{ background: contact.cardBackgroundColor || "#ffffff" }} />
                                                            <span className="text-sm text-gray-600">{contact.cardBackgroundColor || "Default"}</span>
                                                        </Button>
                                                        <div className="flex gap-1.5">
                                                            {[
                                                                { name: "White", value: "#ffffff" },
                                                                { name: "Navy", value: "#1F3A60" },
                                                                { name: "Dark Gray", value: "#374151" },
                                                                { name: "Black", value: "#000000" },
                                                            ].map((preset) => (
                                                                <button
                                                                    key={preset.value}
                                                                    type="button"
                                                                    className={cn(
                                                                        "w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm transition-transform hover:scale-110",
                                                                        contact.cardBackgroundColor === preset.value && "ring-2 ring-accent-blue ring-offset-1"
                                                                    )}
                                                                    style={{ backgroundColor: preset.value }}
                                                                    title={preset.name}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUpdateContactField(contact.id, "cardBackgroundColor", preset.value);
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {activePicker?.id === contact.id && activePicker?.type === 'background' && (
                                                        <div className="absolute z-50 top-full left-0 mt-2">
                                                            <ColorPicker
                                                                value={contact.cardBackgroundColor || "#ffffff"}
                                                                onChange={(color) => handleUpdateContactField(contact.id, "cardBackgroundColor", color)}
                                                                isOpen={true}
                                                                onOpenChange={(open) => !open && setActivePicker(null)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Maximize2 className="w-3.5 h-3.5 text-gray-500" />
                                                        <Label className="text-sm font-medium text-gray-700">Logo Scale</Label>
                                                    </div>
                                                    <div className="pt-2 px-1">
                                                        <LogoScaleSlider
                                                            logoScale={contact.logoScale || 1}
                                                            onLogoScaleChange={(value) => handleUpdateContactField(contact.id, "logoScale", value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
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
