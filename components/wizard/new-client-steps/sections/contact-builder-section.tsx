"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { KeyContactsModal } from "@/components/ui/keyContactsModal";
import { BenefitsTeamPreview } from "./benefits-team-preview";
import { KeyContact } from "@/types/new-client-wizard";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";

export interface Contact {
  id?: string;
  fullName: string;
  title: string;
  companyName: string;
  orgType: "Advisor Firm" | "Client" | "Recordkeeper" | "Partner/Custom" | "";
  customRole: "advisor" | "hr" | "recordkeeper" | "other" | "";
  recordkeeper?: string;
  description: string;
  headshot?: string;
  showOnPortal: boolean;
  enableContactButton: boolean;
  email?: string;
  phone?: string;
  meetingLink?: string;
}

const ALLOWED_ORG_TYPES: Contact["orgType"][] = [
  "Advisor Firm",
  "Client",
  "Recordkeeper",
  "Partner/Custom",
  "",
];

const ALLOWED_CUSTOM_ROLES: Contact["customRole"][] = [
  "advisor",
  "hr",
  "recordkeeper",
  "other",
  "",
];

const DEFAULT_CONTACT: Contact = {
  id: "",
  fullName: "Jane Smith",
  title: "Benefits Manager",
  companyName: "Acme Corporation",
  orgType: "Client",
  customRole: "hr",
  recordkeeper: "",
  description: "",
  headshot: "",
  showOnPortal: true,
  enableContactButton: false,
  email: "",
  phone: "",
  meetingLink: "",
};

const normalizeOrgType = (value: unknown): Contact["orgType"] => {
  if (
    typeof value === "string" &&
    ALLOWED_ORG_TYPES.includes(value as Contact["orgType"])
  ) {
    return value as Contact["orgType"];
  }
  return "";
};

const normalizeCustomRole = (value: unknown): Contact["customRole"] => {
  if (
    typeof value === "string" &&
    ALLOWED_CUSTOM_ROLES.includes(value as Contact["customRole"])
  ) {
    return value as Contact["customRole"];
  }
  return "";
};

const buildContact = (
  raw?: Partial<Contact> | Record<string, any> | null,
): Contact => {
  if (!raw) {
    return { ...DEFAULT_CONTACT };
  }

  return {
    ...DEFAULT_CONTACT,
    ...raw,
    orgType: normalizeOrgType(raw.orgType),
    customRole: normalizeCustomRole(raw.customRole),
    showOnPortal:
      typeof raw.showOnPortal === "boolean"
        ? raw.showOnPortal
        : DEFAULT_CONTACT.showOnPortal,
    enableContactButton:
      typeof raw.enableContactButton === "boolean"
        ? raw.enableContactButton
        : DEFAULT_CONTACT.enableContactButton,
    email: typeof raw.email === "string" ? raw.email : DEFAULT_CONTACT.email,
    phone: typeof raw.phone === "string" ? raw.phone : DEFAULT_CONTACT.phone,
    meetingLink:
      typeof raw.meetingLink === "string"
        ? raw.meetingLink
        : DEFAULT_CONTACT.meetingLink,
  };
};

// === Default Description Generator ===
const getDefaultDescription = (contact: Contact): string => {
  switch (contact.orgType) {
    case "Advisor Firm":
      return "Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.";
    case "Client":
      return "Your primary contact for enrollment questions, plan changes, and general benefits support.";
    case "Recordkeeper":
      return `For account access, contributions, or transaction assistance, please contact ${
        contact.recordkeeper || "[Recordkeeper Name]"
      } directly.`;
    case "Partner/Custom":
      return `For questions about additional benefits such as insurance, wellness, or supplemental programs, please contact ${
        contact.companyName || "[Company Name]"
      }.`;
    default:
      return "";
  }
};

export function ContactBuilderStyled() {
  const { stepData, saveStepDataLocally, saveStepData } =
    useNewClientWizardStore();

  // === Initial state ===
  const [contact, setContact] = useState<Contact>(
    buildContact(stepData.contactBuilder),
  );

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [useDefaultBody, setUseDefaultBody] = useState(true);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [hasEditedDescription, setHasEditedDescription] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const hasSyncedToServerRef = useRef(false);

  // === Load existing contact builder data from server if store is empty ===
  useEffect(() => {
    let isActive = true;

    const loadContactBuilder = async () => {
      if (stepData.contactBuilder) {
        return;
      }

      try {
        const response = await fetch("/api/new-client-wizard/contact-builder");
        if (!response.ok) {
          return;
        }

        const result = await response.json();
        if (!isActive || !result?.contactBuilder) {
          return;
        }

        const normalized = buildContact(result.contactBuilder);
        setContact(normalized);
        await saveStepDataLocally("contactBuilder", normalized);
      } catch (error) {}
    };

    loadContactBuilder();

    return () => {
      isActive = false;
    };
  }, [stepData.contactBuilder, saveStepDataLocally]);

  // === Persist contact locally ===
  useEffect(() => {
    saveStepDataLocally("contactBuilder", contact);
  }, [contact, saveStepDataLocally]);

  // === Sync contact with server (debounced) ===
  useEffect(() => {
    if (!hasSyncedToServerRef.current) {
      hasSyncedToServerRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveStepData("contactBuilder", contact, true).catch((error) => {});
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [contact, saveStepData]);

  // === Auto description generation ===
  useEffect(() => {
    if (!hasEditedDescription && useDefaultBody) {
      setContact((prev) => ({
        ...prev,
        description: getDefaultDescription(prev),
      }));
    }
  }, [
    contact.orgType,
    contact.recordkeeper,
    contact.companyName,
    hasEditedDescription,
    useDefaultBody,
  ]);

  // === Contact <-> KeyContact conversion ===
  const contactToKeyContact = (contact: Contact): KeyContact => {
    // Map old customRole values to new role values
    const roleMap: Record<Contact["customRole"], KeyContact["role"]> = {
      advisor: "Advisor / Specialist",
      hr: "HR Generalist",
      recordkeeper: "Vendor / Provider",
      other: "Other",
      "": "Other", // Default fallback
    };

    const role = roleMap[contact.customRole] || "Other";

    return {
      id: contact.id || "",
      // New required fields
      contactType: "individual",
      benefitsCategories: ["Retirement"],
      role,
      companyName: contact.companyName || "",
      firstName: contact.fullName.split(" ")[0] || "",
      lastName: contact.fullName.split(" ").slice(1).join(" ") || "",
      title: contact.title || "",
      // Legacy fields for backward compatibility
      name: contact.fullName,
      customRole: contact.customRole === "other" ? contact.title : undefined,
      headshot: contact.headshot,
      email: contact.email || "",
      phone: contact.phone || "",
      showOnPortal: contact.showOnPortal,
      enableContactButton: contact.enableContactButton,
      contactUrl: contact.meetingLink,
      isPrimary: contact.showOnPortal,
      // Legacy support
      benefitsCategory: "Retirement",
      isPrimaryForCategory: false,
    };
  };

  const keyContactToContact = (key: KeyContact, base: Contact): Contact => {
    // Reverse map new role values to old customRole values
    const reverseRoleMap: Partial<
      Record<NonNullable<KeyContact["role"]>, Contact["customRole"]>
    > = {
      "Advisor / Specialist": "advisor",
      "HR Generalist": "hr",
      "Vendor / Provider": "recordkeeper",
      Recordkeeper: "recordkeeper",
      "Support Team": "recordkeeper",
      Other: "other",
    };

    const customRole = reverseRoleMap[key.role ?? "Other"] || "other";

    return {
      ...base,
      id: key.id,
      fullName: key.name || `${key.firstName} ${key.lastName}`.trim() || "",
      title: key.customRole || key.title || "",
      customRole,
      email: key.email || "",
      phone: key.phone || "",
      meetingLink: key.contactUrl || "",
      showOnPortal: key.showOnPortal ?? base.showOnPortal,
      enableContactButton: key.enableContactButton ?? base.enableContactButton,
      headshot: key.headshot || base.headshot,
    };
  };

  const updateContact = <K extends keyof Contact>(
    field: K,
    value: Contact[K],
  ) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="space-y-6 border-gray-200">
      <CardHeader className="flex flex-row justify-between items-center">
        <div className="w-2/3">
          <CardTitle>Contact Builder</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Create a contact for your portal. Fields auto-generate descriptions
            based on Organization Type and Role.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="flex items-center gap-2 px-3"
        >
          {isCollapsed ? "Show contact builder" : "Hide contact builder"}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isCollapsed ? "" : "rotate-180"
            }`}
          />
        </Button>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Full Name */}
            <div>
              <Label>Full Name *</Label>
              <Input
                value={contact.fullName}
                onChange={(e) => updateContact("fullName", e.target.value)}
              />
            </div>

            {/* Title */}
            <div>
              <Label>Title / Position *</Label>
              <Input
                value={contact.title}
                onChange={(e) => updateContact("title", e.target.value)}
              />
            </div>

            {/* Company Name */}
            <div>
              <Label>
                {["Recordkeeper", "Partner/Custom"].includes(contact.orgType)
                  ? "Company Name"
                  : "Organization Name"}{" "}
                *
              </Label>
              <Input
                value={contact.companyName}
                onChange={(e) => updateContact("companyName", e.target.value)}
                disabled={
                  contact.orgType === "Advisor Firm" ||
                  contact.orgType === "Client"
                }
                placeholder={
                  ["Advisor Firm", "Client"].includes(contact.orgType)
                    ? "Prefilled by system"
                    : "Enter company name"
                }
              />
            </div>

            {/* Organization Type */}
            <div>
              <Label>Organization Type</Label>
              <Select
                value={contact.orgType}
                onValueChange={(value) =>
                  updateContact("orgType", value as Contact["orgType"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization type" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Advisor Firm",
                    "Client",
                    "Recordkeeper",
                    "Partner/Custom",
                  ].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div>
              <Label>Role *</Label>
              <Select
                value={contact.customRole}
                onValueChange={(value) => {
                  updateContact("customRole", value as Contact["customRole"]);
                  if (value !== "other") setCustomRoleInput("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="recordkeeper">Recordkeeper</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {contact.customRole === "other" && (
                <Input
                  className="mt-2"
                  value={customRoleInput}
                  onChange={(e) => setCustomRoleInput(e.target.value)}
                  placeholder="Enter custom role"
                />
              )}
            </div>

            {/* Description */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <Label>Description</Label>
                <Checkbox
                  checked={useDefaultBody}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true;
                    setUseDefaultBody(isChecked);
                    setHasEditedDescription(false);
                    if (isChecked)
                      updateContact(
                        "description",
                        getDefaultDescription(contact),
                      );
                  }}
                />
                <Label className="text-sm cursor-pointer">Use default</Label>
              </div>
              <Textarea
                value={contact.description}
                onChange={(e) => {
                  updateContact("description", e.target.value);
                  setHasEditedDescription(true);
                  setUseDefaultBody(false);
                }}
                rows={6}
                placeholder="Write a welcoming message..."
              />
            </div>
          </div>

          {/* === Headshot Upload === */}
          <div className="space-y-2 lg:col-span-2">
            <Label>Headshot</Label>
            <div className="flex items-center gap-4">
              <UniversalImageEditorModal
                type="headshot"
                value={contact.headshot || ""}
                fileName=""
                onChange={async (value) => {
                  setContact((prev) => ({ ...prev, headshot: value }));

                  try {
                    await saveStepData("contactBuilder", {
                      ...contact,
                      headshot: value,
                    });
                  } catch (error) {}
                }}
                onRemove={async () => {
                  setContact((prev) => ({ ...prev, headshot: undefined }));
                  try {
                    await saveStepData("contactBuilder", {
                      ...contact,
                      headshot: undefined,
                    });
                  } catch (error) {}
                }}
                placeholder="Upload Headshot"
              />
              {contact.headshot && (
                <div className="w-12 h-12 rounded-full border overflow-hidden">
                  <Headshot src={contact.headshot} alt="headshot" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show on employee portal</Label>
                <p className="text-sm text-muted-foreground">
                  Display this contact in the employee benefits hub
                </p>
              </div>
              <Switch
                checked={contact.showOnPortal || false}
                onCheckedChange={(checked) =>
                  updateContact("showOnPortal", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Contact Button</Label>
                <p className="text-sm text-muted-foreground">
                  Allow employees to schedule meetings or send emails
                </p>
              </div>
              <div>
                {contact.enableContactButton && (
                  <Button
                    variant="outline"
                    className="mr-4"
                    onClick={() => setModalOpen(true)}
                  >
                    Configure
                  </Button>
                )}
                <Switch
                  checked={contact.enableContactButton || false}
                  onCheckedChange={(checked) =>
                    updateContact("enableContactButton", checked)
                  }
                />
              </div>
            </div>
          </div>

          <KeyContactsModal
            open={modalOpen}
            contact={contactToKeyContact(contact)}
            onOpenChange={setModalOpen}
            onSave={(updatedKeyContact) => {
              setContact((prev) =>
                keyContactToContact(updatedKeyContact, prev),
              );
              setModalOpen(false);
            }}
          />

          <BenefitsTeamPreview
            url={stepData.companyBasics?.companyLogo?.url}
            secondaryColor={stepData.companyBasics?.secondaryColor}
            contact={contact}
            brandColor={stepData.companyBasics?.primaryColor}
          />
        </CardContent>
      )}
    </Card>
  );
}
