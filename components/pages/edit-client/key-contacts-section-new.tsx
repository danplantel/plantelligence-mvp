"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  User,
  Mail,
  Phone,
  UserCircle,
  Trash2,
  AlertCircle,
  Building2,
  GripVertical,
} from "lucide-react";
import { KeyContact } from "@/types/new-client-wizard";

const getDefaultDescription = (
  orgType: "Advisor Firm" | "Client" | "Recordkeeper" | "Partner/Custom",
  options: { organization?: string; recordkeeper?: string } = {},
) => {
  switch (orgType) {
    case "Client":
      return "Your primary contact for enrollment questions, plan changes, and general benefits support.";
    case "Recordkeeper":
      return `For account access, contributions, or transaction assistance, please contact ${
        options.recordkeeper || "[Recordkeeper Name]"
      } directly.`;
    case "Partner/Custom":
      return `For questions about additional benefits such as insurance, wellness, or supplemental programs, please contact ${
        options.organization || "[Company Name]"
      }.`;
    default:
      return "Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.";
  }
};

const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, "");
  if (phoneNumber.length <= 3) return phoneNumber;
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  if (phoneNumber.length <= 10)
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
      3,
      6,
    )}-${phoneNumber.slice(6)}`;
  return `+${phoneNumber.slice(0, 1)} (${phoneNumber.slice(
    1,
    4,
  )}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 11)}`;
};

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, "");

function getInitials(contact: KeyContact): string {
  if (contact.contactType === "individual") {
    const first = contact.firstName?.charAt(0).toUpperCase() || "";
    const last = contact.lastName?.charAt(0).toUpperCase() || "";
    return first + last || "?";
  }
  return contact.displayName?.slice(0, 2).toUpperCase() || "?";
}

function getDisplayName(contact: KeyContact): string {
  if (contact.contactType === "individual") {
    return `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "New Contact";
  }
  return contact.displayName || "New Contact";
}

const INITIAL_COLORS = [
  "bg-accent-blue",
  "bg-green-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-yellow-500",
];

function getAvatarColor(name: string): string {
  const index = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % INITIAL_COLORS.length;
  return INITIAL_COLORS[index];
}

// ── Single Contact Accordion Card ──

interface ContactAccordionProps {
  contact: KeyContact;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (updatedFields: Partial<KeyContact>) => void;
  onRemove: () => void;
  onSetPrimary: () => void;
  contactsCount: number;
  errorFields?: string[];
}

function ContactAccordion({
  contact,
  index,
  isOpen,
  onToggle,
  onUpdate,
  onRemove,
  onSetPrimary,
  contactsCount,
  errorFields = [],
}: ContactAccordionProps) {
  const initials = getInitials(contact);
  const displayName = getDisplayName(contact);
  const avatarColor = getAvatarColor(displayName);
  const categoryColors: Record<string, string> = {
    Retirement: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "Group Health": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "Group Life": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "Company / Plan Sponsor": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    "Other Benefits": "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };

  const hasError = (fieldKey: string) => {
    const key = `contact_${contact.id}_${fieldKey}`;
    return errorFields.includes(key);
  };

  return (
    <Card className="shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Accordion Header */}
      <CardHeader
        className="cursor-pointer py-3 px-4 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500">
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Headshot / Avatar in the accordion header */}
          <div className="flex-shrink-0 relative">
            {contact.headshot ? (
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                <Headshot
                  src={contact.headshot}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold ${avatarColor}`}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Contact summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">
                {displayName}
              </span>
              {contact.isPrimary && (
                <Badge className="bg-accent-blue/10 text-accent-blue border-accent-blue/20 text-[10px] px-1.5 py-0">
                  Primary
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {contact.email && (
                <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                  {contact.email}
                </span>
              )}
              {contact.benefitsCategory && (
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                    categoryColors[contact.benefitsCategory] ||
                    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {contact.benefitsCategory === "Other Benefits" && contact.benefitsCategoryOther
                    ? contact.benefitsCategoryOther
                    : contact.benefitsCategory}
                </span>
              )}
            </div>
          </div>

          {/* Expand/collapse */}
          <div className="flex-shrink-0">
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Accordion Content */}
      {isOpen && (
        <CardContent className="px-4 pb-5 pt-2 space-y-5 border-t border-gray-100 dark:border-gray-700">
          {/* Headshot upload (inline within content) */}
          <div className="flex items-center gap-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Headshot</Label>
              <UniversalImageEditorModal
                type="headshot"
                icon={<UserCircle className="w-6 h-6 text-muted-foreground" />}
                value={contact.headshot || ""}
                fileName=""
                onChange={(value: any) =>
                  onUpdate({ headshot: typeof value === "string" ? value : value?.original_url || "" })
                }
                onRemove={() => onUpdate({ headshot: "" })}
                placeholder="Upload Headshot"
              />
            </div>
            {contact.headshot && (
              <div className="flex items-center gap-2">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                  <Headshot
                    src={contact.headshot}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{contact.title || "No title"}</p>
                </div>
              </div>
            )}
          </div>

          {/* Name + Title row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`fn-${contact.id}`} className="text-xs font-medium">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                icon={<User className="h-3.5 w-3.5" />}
                id={`fn-${contact.id}`}
                value={contact.firstName || ""}
                onChange={(e) =>
                  onUpdate({
                    firstName: e.target.value,
                    name: `${e.target.value} ${contact.lastName || ""}`.trim(),
                  })
                }
                placeholder="First"
                className={`h-9 text-sm ${hasError("firstName") ? "border-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ln-${contact.id}`} className="text-xs font-medium">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                icon={<User className="h-3.5 w-3.5" />}
                id={`ln-${contact.id}`}
                value={contact.lastName || ""}
                onChange={(e) =>
                  onUpdate({
                    lastName: e.target.value,
                    name: `${contact.firstName || ""} ${e.target.value}`.trim(),
                  })
                }
                placeholder="Last"
                className={`h-9 text-sm ${hasError("lastName") ? "border-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`title-${contact.id}`} className="text-xs font-medium">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id={`title-${contact.id}`}
                value={contact.title || ""}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Job title"
                className={`h-9 text-sm ${hasError("title") ? "border-red-500" : ""}`}
              />
            </div>
          </div>

          {/* Contact info row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`email-${contact.id}`} className="text-xs font-medium">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                icon={<Mail className="h-3.5 w-3.5" />}
                id={`email-${contact.id}`}
                type="email"
                value={contact.email || ""}
                onChange={(e) => onUpdate({ email: e.target.value })}
                placeholder="email@example.com"
                className={`h-9 text-sm ${hasError("email") ? "border-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`phone-${contact.id}`} className="text-xs font-medium">
                Phone <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  icon={<Phone className="h-3.5 w-3.5" />}
                  id={`phone-${contact.id}`}
                  type="tel"
                  value={contact.phone ? formatPhoneNumber(contact.phone) : ""}
                  onChange={(e) => {
                    const normalized = normalizePhoneNumber(e.target.value);
                    if (normalized.length > 11) return;
                    onUpdate({ phone: normalized });
                  }}
                  placeholder="(555) 123-4567"
                  className={`h-9 text-sm flex-1 ${hasError("phone") ? "border-red-500" : ""}`}
                />
                <Input
                  id={`ext-${contact.id}`}
                  value={contact.phoneExtension || ""}
                  onChange={(e) => onUpdate({ phoneExtension: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  placeholder="Ext."
                  className="h-9 text-sm w-20"
                />
              </div>
            </div>
          </div>

          {/* Assignment row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`cat-${contact.id}`} className="text-xs font-medium">
                Benefits Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={contact.benefitsCategory || "Retirement"}
                onValueChange={(value) =>
                  onUpdate({
                    benefitsCategory: value as KeyContact["benefitsCategory"],
                    benefitsCategories: [value as "Retirement" | "Group Health" | "Group Life" | "Company / Plan Sponsor" | "Other Benefits"],
                    benefitsCategoryOther: value !== "Other Benefits" ? undefined : "",
                  })
                }
              >
                <SelectTrigger
                  className={`h-9 text-sm ${hasError("benefitsCategory") ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retirement">Retirement</SelectItem>
                  <SelectItem value="Group Health">Group Health</SelectItem>
                  <SelectItem value="Group Life">Group Life</SelectItem>
                  <SelectItem value="Company / Plan Sponsor">Company / Plan Sponsor</SelectItem>
                  <SelectItem value="Other Benefits">Other Benefits</SelectItem>
                </SelectContent>
              </Select>
              {contact.benefitsCategory === "Other Benefits" && (
                <Input
                  value={contact.benefitsCategoryOther || ""}
                  onChange={(e) => onUpdate({ benefitsCategoryOther: e.target.value.slice(0, 32) })}
                  placeholder="Custom category (max 32 chars)"
                  maxLength={32}
                  className="h-8 text-xs mt-1"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`role-${contact.id}`} className="text-xs font-medium">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={contact.role || "Advisor / Specialist"}
                onValueChange={(value) =>
                  onUpdate({
                    role: value as KeyContact["role"],
                    roleOther: value !== "Other" ? undefined : "",
                  })
                }
              >
                <SelectTrigger
                  className={`h-9 text-sm ${hasError("role") ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Advisor / Specialist">Advisor / Specialist</SelectItem>
                  <SelectItem value="HR Generalist">HR Generalist</SelectItem>
                  <SelectItem value="Vendor / Provider">Vendor / Provider</SelectItem>
                  <SelectItem value="Support Team">Support Team</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {contact.role === "Other" && (
                <Input
                  value={contact.roleOther || ""}
                  onChange={(e) => onUpdate({ roleOther: e.target.value.slice(0, 32) })}
                  placeholder="Custom role (max 32 chars)"
                  maxLength={32}
                  className="h-8 text-xs mt-1"
                />
              )}
            </div>
          </div>

          {/* Company & Primary toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`company-${contact.id}`} className="text-xs font-medium">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                icon={<Building2 className="h-3.5 w-3.5" />}
                id={`company-${contact.id}`}
                value={contact.companyName || ""}
                onChange={(e) => onUpdate({ companyName: e.target.value })}
                placeholder="Company name"
                className={`h-9 text-sm ${hasError("companyName") ? "border-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Primary Contact</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  id={`primary-${contact.id}`}
                  checked={contact.isPrimary || false}
                  onCheckedChange={(checked) => {
                    onUpdate({ isPrimary: checked, isPrimaryForCategory: checked });
                    if (checked) onSetPrimary();
                  }}
                />
                <Label
                  htmlFor={`primary-${contact.id}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {contact.isPrimary ? "Yes" : "No"}
                </Label>
              </div>
            </div>
          </div>

          {/* Website (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor={`web-${contact.id}`} className="text-xs font-medium">
              Website <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id={`web-${contact.id}`}
              type="url"
              value={contact.website || ""}
              onChange={(e) => onUpdate({ website: e.target.value })}
              placeholder="https://example.com"
              className="h-9 text-sm"
            />
          </div>

          {/* Actions bar */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove Contact
            </Button>
            {errorFields.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                {errorFields.filter((f) => f.includes(contact.id)).length} error(s)
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Component ──

interface KeyContactsSectionNewProps {
  contacts: KeyContact[];
  onContactsChange: (contacts: KeyContact[]) => void;
  onHeadshotUpload: (index: number, file: File) => void;
  onHeadshotRemove: (index: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  validationErrors?: Record<string, string[]>;
}

export function KeyContactsSectionNew({
  contacts,
  onContactsChange,
  onHeadshotUpload,
  onHeadshotRemove,
  isOpen,
  onToggle,
  validationErrors = {},
}: KeyContactsSectionNewProps) {
  const [openContactIds, setOpenContactIds] = useState<string[]>([]);

  const toggleContact = (contactId: string) => {
    setOpenContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const addContact = () => {
    const newContact: KeyContact = {
      id: `contact-${Date.now()}`,
      contactType: "individual",
      benefitsCategories: ["Retirement"],
      benefitsCategory: "Retirement",
      role: "Advisor / Specialist",
      isPrimaryForCategory: contacts.length === 0,
      companyName: "",
      companyLogo: undefined,
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      phoneExtension: "",
      website: "",
      showOnPortal: true,
      enableContactButton: true,
      isPrimary: contacts.length === 0,
      displayScope: "thisPortal",
      name: "",
      orgType: "Advisor Firm",
      description: getDefaultDescription("Advisor Firm"),
    };
    onContactsChange([...contacts, newContact]);
    // Auto-open the new contact
    setOpenContactIds((prev) => [...prev, newContact.id]);
  };

  const updateContact = (contactId: string, fields: Partial<KeyContact>) => {
    onContactsChange(
      contacts.map((c) => (c.id === contactId ? { ...c, ...fields } : c)),
    );
  };

  const removeContact = (contactId: string) => {
    onContactsChange(contacts.filter((c) => c.id !== contactId));
    setOpenContactIds((prev) => prev.filter((id) => id !== contactId));
  };

  const handleSetPrimary = (contactId: string) => {
    onContactsChange(
      contacts.map((c) => ({
        ...c,
        isPrimary: c.id === contactId,
        isPrimaryForCategory: c.id === contactId,
      })),
    );
  };

  const errorFields = validationErrors.keyContacts || [];

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Key Contacts</h3>
        <div className="flex items-center gap-2">
          {isOpen && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                addContact();
              }}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact ({contacts.length})
            </Button>
          )}
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No contacts added yet.</p>
              <p className="text-xs mt-1">Click "Add Contact" to get started.</p>
            </div>
          ) : (
            contacts.map((contact, index) => (
              <ContactAccordion
                key={contact.id}
                contact={contact}
                index={index}
                isOpen={openContactIds.includes(contact.id)}
                onToggle={() => toggleContact(contact.id)}
                onUpdate={(fields) => updateContact(contact.id, fields)}
                onRemove={() => removeContact(contact.id)}
                onSetPrimary={() => handleSetPrimary(contact.id)}
                contactsCount={contacts.length}
                errorFields={errorFields}
              />
            ))
          )}

          {/* Bottom Add Contact button */}
          <Button onClick={addContact} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Contact ({contacts.length})
          </Button>
        </div>
      )}
    </div>
  );
}
