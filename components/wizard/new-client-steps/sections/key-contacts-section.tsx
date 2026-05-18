"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { BrandingImage } from "@/components/ui/branding-image";
import {
  User,
  Mail,
  Phone,
  UserCircle,
  Trash2,
  AlertCircle,
  Building2,
  Loader2,
} from "lucide-react";
import { PortalTeam } from "@/components/pages/client-portal/sections/portal-team";
import { KeyContact } from "@/types/new-client-wizard";
import { KeyContactsModal } from "@/components/ui/keyContactsModal";
import { useDebounce } from "@/hooks/useDebounce";
import { normalizeExtension } from "@/lib/phone-utils";

export interface KeyContactsSectionProps {
  contacts: KeyContact[];
  onContactsChange: (contacts: KeyContact[]) => void;
  onHeadshotUpload?: (index: number, file: File) => void;
  onHeadshotRemove?: (index: number) => void;
  organizationName?: string;
  companyLogo?: string;
  recordkeeperFromStep4?: string;
  title?: string;
  description?: string;
  validationErrors?: Record<string, string[]>;
  errorFields?: string[];
}

type CompanySuggestionSource =
  | "client"
  | "plan"
  | "provider"
  | "recordkeeper"
  | "draft";

interface CompanySuggestion {
  id: string;
  name: string;
  logo?: string | null;
  source: CompanySuggestionSource;
}

interface CompanyAutocompleteInputProps {
  value: string;
  placeholder?: string;
  hasError?: boolean;
  onManualChange: (value: string) => void;
  onSuggestionSelect: (suggestion: CompanySuggestion) => void;
}

const COMPANY_SOURCE_LABELS: Record<CompanySuggestionSource, string> = {
  client: "Client",
  plan: "Plan",
  provider: "Provider",
  recordkeeper: "Recordkeeper",
  draft: "Draft",
};

const MIN_COMPANY_QUERY = 2;

const CompanyAutocompleteInput: React.FC<CompanyAutocompleteInputProps> = ({
  value,
  placeholder = "Search saved companies",
  hasError = false,
  onManualChange,
  onSuggestionSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchController = useRef<AbortController | null>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCompanies = useCallback(async (query: string) => {
    fetchController.current?.abort();
    const controller = new AbortController();
    fetchController.current = controller;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/companies/search?query=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }

      const payload = await response.json();
      setSuggestions(Array.isArray(payload.data) ? payload.data : []);
      setIsDropdownOpen(true);
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        return;
      }
      console.error("Company search failed:", error);
      setErrorMessage("Unable to load company suggestions.");
      setSuggestions([]);
    } finally {
      if (fetchController.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed.length < MIN_COMPANY_QUERY) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      fetchController.current?.abort();
      setIsLoading(false);
      return;
    }

    fetchCompanies(trimmed);
  }, [debouncedSearch, fetchCompanies]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setSearchTerm(nextValue);
    onManualChange(nextValue);
    if (nextValue.trim().length >= MIN_COMPANY_QUERY) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const handleSelect = (suggestion: CompanySuggestion) => {
    setSearchTerm(suggestion.name);
    onSuggestionSelect(suggestion);
    setIsDropdownOpen(false);
  };

  const handleFocus = () => {
    if (
      searchTerm.trim().length >= MIN_COMPANY_QUERY &&
      suggestions.length > 0
    ) {
      setIsDropdownOpen(true);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Input
        icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={hasError ? "border-red-500" : ""}
      />
      {isDropdownOpen && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching companies…
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/70"
                onClick={() => handleSelect(suggestion)}
              >
                {suggestion.logo ? (
                  <BrandingImage
                    src={suggestion.logo}
                    alt={`${suggestion.name} logo`}
                    className="h-8 w-8 rounded border object-contain"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded border bg-muted text-xs font-semibold uppercase text-muted-foreground">
                    {suggestion.name.slice(0, 2)}
                  </div>
                )}
                <div className="flex flex-1 flex-col">
                  <span className="font-medium text-foreground">
                    {suggestion.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {COMPANY_SOURCE_LABELS[suggestion.source]}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {errorMessage ||
                (searchTerm.trim().length < MIN_COMPANY_QUERY
                  ? "Type at least 2 characters to search"
                  : "No companies found")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const KeyContactsSection: React.FC<KeyContactsSectionProps> = ({
  contacts,
  organizationName,
  companyLogo,
  onContactsChange,
  errorFields = [],
  title,
  description,
}) => {
  const [collapsedContactIds, setCollapsedContactIds] = useState<string[]>([]);
  const [previewContactId, setPreviewContactId] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

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

  const updateContact = (
    contactId: string,
    updatedFields: Partial<KeyContact>,
  ) => {
    const updated = contacts.map((c) =>
      c.id === contactId ? { ...c, ...updatedFields } : c,
    );
    onContactsChange(updated);
  };

  const removeContact = (contactId: string) => {
    const updated = contacts.filter((c) => c.id !== contactId);
    onContactsChange(updated);
    setCollapsedContactIds((prev) => prev.filter((id) => id !== contactId));
  };

  const handleSetPrimary = (contactId: string) => {
    const updated = contacts.map((c) => ({
      ...c,
      isPrimary: c.id === contactId,
      isPrimaryForCategory: c.id === contactId,
    }));
    updated.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    onContactsChange(updated);
    setCollapsedContactIds([]);
  };

  const toggleCollapse = (contactId: string) => {
    setCollapsedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const handleHeadshotUpload = (contactId: string, headshotData: any) => {
    updateContact(contactId, { headshot: headshotData?.original_url || "" });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newContacts = Array.from(contacts);
    const [moved] = newContacts.splice(result.source.index, 1);
    newContacts.splice(result.destination.index, 0, moved);

    const updated = newContacts.map((c, index) => ({
      ...c,
      isPrimary: index === 0,
    }));

    onContactsChange(updated);
  };

  const hasError = (fieldKey: string, contactIndex: number) => {
    const contactNum = contactIndex + 1;
    const fieldName = fieldKey.split("_").pop() || "";
    const numericKey = `contact_${contactNum}_${fieldName}`;
    return errorFields.includes(numericKey) || errorFields.includes(fieldKey);
  };

  const normalizedContactsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    contacts.forEach((contact) => {
      // Skip if already normalized
      if (normalizedContactsRef.current.has(contact.id)) {
        return;
      }

      const updates: Partial<KeyContact> = {};
      let needsUpdate = false;

      if ((!contact.firstName || !contact.lastName) && contact.name) {
        const parts = contact.name.trim().split(" ");
        const newFirstName = contact.firstName || parts[0] || "";
        const newLastName =
          contact.lastName || parts.slice(1).join(" ").trim() || "";
        if (
          newFirstName !== contact.firstName ||
          newLastName !== contact.lastName
        ) {
          updates.firstName = newFirstName;
          updates.lastName = newLastName;
          needsUpdate = true;
        }
      }

      if (!contact.companyName && organizationName) {
        updates.companyName = organizationName;
        needsUpdate = true;
      }

      if (!contact.companyLogo && companyLogo) {
        updates.companyLogo = companyLogo;
        needsUpdate = true;
      }

      if (!contact.title && contact.role === "Advisor / Specialist") {
        updates.title = "Advisor";
        needsUpdate = true;
      } else if (!contact.title && contact.role === "HR Generalist") {
        updates.title = "HR Benefits & Enrollment";
        needsUpdate = true;
      } else if (!contact.title && contact.role === "Vendor / Provider") {
        updates.title = "Plan Recordkeeper Support";
        needsUpdate = true;
      }

      if (needsUpdate) {
        updateContact(contact.id, updates);
        normalizedContactsRef.current.add(contact.id);
      } else {
        // Mark as normalized even if no updates needed
        normalizedContactsRef.current.add(contact.id);
      }
    });

    // Clean up ref for removed contacts
    const currentIds = new Set(contacts.map((c) => c.id));
    normalizedContactsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        normalizedContactsRef.current.delete(id);
      }
    });
  }, [contacts, organizationName, companyLogo, updateContact]);

  return (
    <div className="space-y-4">
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="contacts">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {contacts.map((contact, index) => {
                return (
                  <Draggable
                    key={contact.id}
                    draggableId={contact.id}
                    index={index}
                    isDragDisabled={!collapsedContactIds.includes(contact.id)}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="flex items-center gap-2">
                                <User className="w-5 h-5 text-teal-600" />
                                Contact {index + 1}
                                {contact.isPrimary && (
                                  <Badge variant="default">Primary</Badge>
                                )}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleCollapse(contact.id)}
                                >
                                  {collapsedContactIds.includes(contact.id)
                                    ? "Expand"
                                    : "Collapse"}
                                </Button>
                                {!contact.isPrimary && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSetPrimary(contact.id)}
                                  >
                                    Set as Primary
                                  </Button>
                                )}
                                {contacts.length > 1 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeContact(contact.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                {contact.email || "No email"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone className="w-4 h-4" />
                                {contact.phone ? formatPhoneNumber(contact.phone) : "No phone"}
                                {contact.phoneExtension && ` ext. ${contact.phoneExtension}`}
                              </span>
                              {contact.benefitsCategory && (
                                <span className="flex items-center gap-1">
                                  <Badge variant="outline">
                                    {contact.benefitsCategory}
                                  </Badge>
                                </span>
                              )}
                            </div>
                          </CardHeader>

                          <CardContent
                            className={`space-y-4 ${collapsedContactIds.includes(contact.id)
                              ? "hidden"
                              : ""
                              }`}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* A. Benefits Category */}
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`benefitsCategory-${contact.id}`}
                                >
                                  Benefits Category{" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                  value={
                                    contact.benefitsCategory || "Retirement"
                                  }
                                  onValueChange={(value) => {
                                    updateContact(contact.id, {
                                      benefitsCategory: value as
                                        | "Retirement"
                                        | "Group Health"
                                        | "Group Life"
                                        | "Company / Plan Sponsor"
                                        | "Other Benefits",
                                      benefitsCategoryOther:
                                        value !== "Other Benefits"
                                          ? undefined
                                          : "",
                                    });
                                  }}
                                >
                                  <SelectTrigger
                                    className={
                                      hasError(
                                        `contact_${contact.id}_benefitsCategory`,
                                        index,
                                      )
                                        ? "border-red-500"
                                        : ""
                                    }
                                  >
                                    <SelectValue placeholder="Select benefits category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Retirement">
                                      Retirement
                                    </SelectItem>
                                    <SelectItem value="Group Health">
                                      Group Health
                                    </SelectItem>
                                    <SelectItem value="Group Life">
                                      Group Life
                                    </SelectItem>
                                    <SelectItem value="Company / Plan Sponsor">
                                      Company / Plan Sponsor
                                    </SelectItem>
                                    <SelectItem value="Other Benefits">
                                      Other Benefits
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {contact.benefitsCategory ===
                                  "Other Benefits" && (
                                    <Input
                                      id={`benefitsCategoryOther-${contact.id}`}
                                      value={contact.benefitsCategoryOther || ""}
                                      onChange={(e) =>
                                        updateContact(contact.id, {
                                          benefitsCategoryOther:
                                            e.target.value.slice(0, 32),
                                        })
                                      }
                                      placeholder="Enter custom category (max 32 chars)"
                                      maxLength={32}
                                      className="mt-2"
                                    />
                                  )}
                                {hasError(
                                  `contact_${contact.id}_benefitsCategory`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Benefits Category is required
                                    </p>
                                  )}
                              </div>

                              {/* B. Role */}
                              <div className="space-y-2">
                                <Label htmlFor={`role-${contact.id}`}>
                                  Role <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                  value={contact.role || "Advisor / Specialist"}
                                  onValueChange={(value) => {
                                    updateContact(contact.id, {
                                      role: value as
                                        | "Advisor / Specialist"
                                        | "HR Generalist"
                                        | "Vendor / Provider"
                                        | "Support Team"
                                        | "Other",
                                      roleOther:
                                        value !== "Other" ? undefined : "",
                                    });
                                  }}
                                >
                                  <SelectTrigger
                                    className={
                                      hasError(
                                        `contact_${contact.id}_role`,
                                        index,
                                      )
                                        ? "border-red-500"
                                        : ""
                                    }
                                  >
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Advisor / Specialist">
                                      Advisor / Specialist
                                    </SelectItem>
                                    <SelectItem value="HR Generalist">
                                      HR Generalist
                                    </SelectItem>
                                    <SelectItem value="Vendor / Provider">
                                      Vendor / Provider
                                    </SelectItem>
                                    <SelectItem value="Support Team">
                                      Support Team
                                    </SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                {contact.role === "Other" && (
                                  <Input
                                    id={`roleOther-${contact.id}`}
                                    value={contact.roleOther || ""}
                                    onChange={(e) =>
                                      updateContact(contact.id, {
                                        roleOther: e.target.value.slice(0, 32),
                                      })
                                    }
                                    placeholder="Enter custom role (max 32 chars)"
                                    maxLength={32}
                                    className="mt-2"
                                  />
                                )}
                                {hasError(
                                  `contact_${contact.id}_role`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Role is required
                                    </p>
                                  )}
                              </div>

                              {/* C. Is Primary For Category */}
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`isPrimaryForCategory-${contact.id}`}
                                >
                                  Is this the primary contact for this category?
                                  <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`isPrimaryForCategory-${contact.id}`}
                                    checked={
                                      contact.isPrimaryForCategory || false
                                    }
                                    onCheckedChange={(checked) => {
                                      updateContact(contact.id, {
                                        isPrimaryForCategory: checked,
                                      });
                                      if (checked) {
                                        handleSetPrimary(contact.id);
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`isPrimaryForCategory-${contact.id}`}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {contact.isPrimaryForCategory
                                      ? "Yes"
                                      : "No"}
                                  </Label>
                                </div>
                              </div>

                              {/* D. Company Name */}
                              <div className="space-y-2">
                                <Label htmlFor={`companyName-${contact.id}`}>
                                  Company Name{" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <CompanyAutocompleteInput
                                      value={contact.companyName || ""}
                                      placeholder="Search existing companies"
                                      hasError={hasError(
                                        `contact_${contact.id}_companyName`,
                                        index,
                                      )}
                                      onManualChange={(value) => {
                                        updateContact(contact.id, {
                                          companyName: value,
                                          companyLogo:
                                            value !== contact.companyName
                                              ? undefined
                                              : contact.companyLogo,
                                        });
                                      }}
                                      onSuggestionSelect={(suggestion) => {
                                        const updates: Partial<KeyContact> = {
                                          companyName: suggestion.name,
                                        };
                                        if (suggestion.logo) {
                                          updates.companyLogo = suggestion.logo;
                                        }
                                        updateContact(contact.id, updates);
                                      }}
                                    />
                                  </div>
                                  {contact.companyLogo && (
                                    <div className="relative w-10 h-10 border rounded overflow-hidden flex items-center justify-center bg-background">
                                      <BrandingImage
                                        src={contact.companyLogo}
                                        alt="Company logo"
                                        className="max-h-10 max-w-10 object-contain"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute -top-2 -right-2 h-4 w-4 p-0"
                                        onClick={() =>
                                          updateContact(contact.id, {
                                            companyLogo: undefined,
                                          })
                                        }
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  )}
                                  {!contact.companyLogo && (
                                    <UniversalImageEditorModal
                                      type="logo"
                                      icon={<UserCircle className="w-4 h-4" />}
                                      value=""
                                      fileName=""
                                      onChange={(value) =>
                                        updateContact(contact.id, {
                                          companyLogo: value,
                                        })
                                      }
                                      onRemove={() => { }}
                                      placeholder="Upload Logo"
                                    />
                                  )}
                                </div>
                                {hasError(
                                  `contact_${contact.id}_companyName`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Company Name is required
                                    </p>
                                  )}
                              </div>

                              {/* E. First Name */}
                              <div className="space-y-2">
                                <Label htmlFor={`firstName-${contact.id}`}>
                                  First Name{" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  icon={<User className="h-4 w-4" />}
                                  id={`firstName-${contact.id}`}
                                  value={contact.firstName || ""}
                                  onChange={(e) => {
                                    const firstName = e.target.value;
                                    updateContact(contact.id, {
                                      firstName,
                                      name: `${firstName} ${contact.lastName || ""
                                        }`.trim(),
                                    });
                                  }}
                                  placeholder="First name"
                                  required
                                  className={
                                    hasError(
                                      `contact_${contact.id}_firstName`,
                                      index,
                                    )
                                      ? "border-red-500"
                                      : ""
                                  }
                                />
                                {hasError(
                                  `contact_${contact.id}_firstName`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      First Name is required
                                    </p>
                                  )}
                              </div>

                              {/* F. Last Name */}
                              <div className="space-y-2">
                                <Label htmlFor={`lastName-${contact.id}`}>
                                  Last Name{" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  icon={<User className="h-4 w-4" />}
                                  id={`lastName-${contact.id}`}
                                  value={contact.lastName || ""}
                                  onChange={(e) => {
                                    const lastName = e.target.value;
                                    updateContact(contact.id, {
                                      lastName,
                                      name: `${contact.firstName || ""
                                        } ${lastName}`.trim(),
                                    });
                                  }}
                                  placeholder="Last name"
                                  required
                                  className={
                                    hasError(
                                      `contact_${contact.id}_lastName`,
                                      index,
                                    )
                                      ? "border-red-500"
                                      : ""
                                  }
                                />
                                {hasError(
                                  `contact_${contact.id}_lastName`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Last Name is required
                                    </p>
                                  )}
                              </div>

                              {/* G. Title */}
                              <div className="space-y-2">
                                <Label htmlFor={`title-${contact.id}`}>
                                  Title <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id={`title-${contact.id}`}
                                  value={contact.title || ""}
                                  onChange={(e) =>
                                    updateContact(contact.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="Enter job title"
                                  required
                                  className={
                                    hasError(
                                      `contact_${contact.id}_title`,
                                      index,
                                    )
                                      ? "border-red-500"
                                      : ""
                                  }
                                />
                                {hasError(
                                  `contact_${contact.id}_title`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Title is required
                                    </p>
                                  )}
                              </div>

                              {/* H. Email */}
                              <div className="space-y-2">
                                <Label htmlFor={`email-${contact.id}`}>
                                  Email <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  icon={<Mail className="h-4 w-4" />}
                                  id={`email-${contact.id}`}
                                  type="email"
                                  value={contact.email || ""}
                                  onChange={(e) =>
                                    updateContact(contact.id, {
                                      email: e.target.value,
                                    })
                                  }
                                  placeholder="email@example.com"
                                  required
                                  className={
                                    hasError(
                                      `contact_${contact.id}_email`,
                                      index,
                                    )
                                      ? "border-red-500"
                                      : ""
                                  }
                                />
                                {hasError(
                                  `contact_${contact.id}_email`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      {contact.email &&
                                        contact.email.trim() !== ""
                                        ? "Please enter a valid email address"
                                        : "Email is required"}
                                    </p>
                                  )}
                              </div>

                              {/* I. Phone (+ext) */}
                              <div className="space-y-2">
                                <Label htmlFor={`phone-${contact.id}`}>
                                  Phone (+ext){" "}
                                  <span className="text-red-500">*</span>
                                  <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex gap-2">
                                  <Input
                                    icon={<Phone className="h-4 w-4" />}
                                    id={`phone-${contact.id}`}
                                    type="tel"
                                    value={
                                      contact.phone
                                        ? formatPhoneNumber(contact.phone)
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const normalized = normalizePhoneNumber(
                                        e.target.value,
                                      );
                                      if (normalized.length > 11) return;
                                      updateContact(contact.id, {
                                        phone: normalized,
                                      });
                                    }}
                                    placeholder="(555) 123-4567"
                                    required
                                    className={
                                      hasError(
                                        `contact_${contact.id}_phone`,
                                        index,
                                      )
                                        ? "border-red-500"
                                        : ""
                                    }
                                  />
                                  <Input
                                    id={`phoneExtension-${contact.id}`}
                                    value={contact.phoneExtension || ""}
                                    onChange={(e) => {
                                      const normalized = normalizeExtension(
                                        e.target.value,
                                      );
                                      updateContact(contact.id, {
                                        phoneExtension: normalized,
                                      });
                                    }}
                                    placeholder="Ext."
                                    className="w-24"
                                  />
                                </div>
                                {hasError(
                                  `contact_${contact.id}_phone`,
                                  index,
                                ) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Phone is required
                                    </p>
                                  )}
                              </div>

                              {/* J. Website (optional) */}
                              <div className="space-y-2">
                                <Label htmlFor={`website-${contact.id}`}>
                                  Website (optional)
                                </Label>
                                <Input
                                  id={`website-${contact.id}`}
                                  type="url"
                                  value={contact.website || ""}
                                  onChange={(e) =>
                                    updateContact(contact.id, {
                                      website: e.target.value,
                                    })
                                  }
                                  placeholder="https://example.com"
                                />
                              </div>
                            </div>

                            {/* K. Headshot (optional) */}
                            <div className="space-y-2">
                              <Label>Headshot (optional)</Label>
                              <div className="flex items-center gap-4">
                                <UniversalImageEditorModal
                                  type="headshot"
                                  icon={<UserCircle className="w-4 h-4" />}
                                  value={contact.headshot || ""}
                                  fileName=""
                                  onChange={(value) =>
                                    handleHeadshotUpload(contact.id, {
                                      original_url: value,
                                    })
                                  }
                                  onRemove={() =>
                                    handleHeadshotUpload(contact.id, null)
                                  }
                                  placeholder="Upload Headshot"
                                />
                                {contact.headshot && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-12 h-12 rounded-full border overflow-hidden">
                                      <Headshot
                                        src={contact.headshot}
                                        alt={`${contact.firstName} ${contact.lastName} headshot`}
                                      />
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        updateContact(contact.id, {
                                          headshot: "",
                                        })
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="w-full flex justify-end">
                              <Button
                                size="sm"
                                onClick={() =>
                                  setPreviewContactId((prev) =>
                                    prev === contact.id ? null : contact.id,
                                  )
                                }
                              >
                                {previewContactId === contact.id
                                  ? "Preview On"
                                  : "Preview Off"}
                              </Button>
                            </div>

                            {previewContactId === contact.id && (
                              <PortalTeam keyContacts={[contact]} />
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {editingIndex !== null && (
          <KeyContactsModal
            open={modalOpen}
            contact={contacts[editingIndex]}
            onOpenChange={setModalOpen}
            onSave={(updatedContact) => {
              const updatedContacts = [...contacts];
              updatedContacts[editingIndex] = updatedContact;
              onContactsChange(updatedContacts);
              setEditingIndex(null);
              setModalOpen(false);
            }}
          />
        )}
      </DragDropContext>
    </div>
  );
};
