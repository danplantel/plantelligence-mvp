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
  ChevronUp,
  ChevronDown,
} from "lucide-react";
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

export const KeyContactsSection: React.FC<KeyContactsSectionProps> = ({
  contacts,
  organizationName,
  companyLogo,
  onContactsChange,
  errorFields = [],
  title,
  description,
}) => {
  const [expandedContactIds, setExpandedContactIds] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  /** Tracks the previous set of contact IDs so we can detect newly added contacts and auto-expand them. */
  const prevContactIdsRef = useRef<Set<string>>(new Set());
  /** Prevents auto-expanding all contacts on initial mount — only true additions after mount should auto-open. */
  const isInitialMountRef = useRef(true);

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
    setExpandedContactIds((prev) => prev.filter((id) => id !== contactId));
  };

  const handleSetPrimary = (contactId: string) => {
    const updated = contacts.map((c) => ({
      ...c,
      isPrimary: c.id === contactId,
      isPrimaryForCategory: c.id === contactId,
    }));
    updated.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    onContactsChange(updated);
    setExpandedContactIds([]);
  };

  const toggleAccordion = (contactId: string) => {
    setExpandedContactIds((prev) =>
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

// Auto-expand newly added contacts so the user sees the form immediately.
// On initial mount, all contacts are seeded as "already seen" so none auto-open.
// Only contacts added after the initial mount get auto-expanded.
useEffect(() => {
  const currentIds = new Set(contacts.map((c) => c.id));

  if (isInitialMountRef.current) {
    // Seed the ref with existing IDs so they're not treated as "new" on mount
    prevContactIdsRef.current = currentIds;
    isInitialMountRef.current = false;
    return;
  }

  const newIds = [...currentIds].filter(
    (id) => !prevContactIdsRef.current.has(id),
  );
  if (newIds.length > 0) {
    setExpandedContactIds((prev) => [...prev, ...newIds]);
  }
  prevContactIdsRef.current = currentIds;
}, [contacts]);

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
                    isDragDisabled={!expandedContactIds.includes(contact.id)}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <Card>
                          {/* Accordion Header - clickable, shows headshot */}
                          <CardHeader
                            className="cursor-pointer py-3 px-4 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors"
                            onClick={() => toggleAccordion(contact.id)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Headshot / Avatar in header */}
                              <div className="flex-shrink-0">
                                  {contact.headshot ? (
                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                                      <Headshot
                                        src={contact.headshot}
                                        alt={getDisplayName(contact)}
                                      />
                                    </div>
                                  ) : (
                                  <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold ${getAvatarColor(getDisplayName(contact))}`}
                                  >
                                    {getInitials(contact)}
                                  </div>
                                )}
                              </div>

                              {/* Contact summary */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">
                                    {getDisplayName(contact)}
                                  </span>
                                  {contact.isPrimary && (
                                    <Badge className="bg-accent-blue/10 text-accent-blue border-accent-blue/20 text-[10px] px-1.5 py-0">
                                      Primary
                                    </Badge>
                                  )}
                                  {contact.benefitsCategory && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {contact.benefitsCategory === "Other Benefits" && contact.benefitsCategoryOther
                                        ? contact.benefitsCategoryOther
                                        : contact.benefitsCategory}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                  {contact.email && (
                                    <span className="flex items-center gap-1 truncate max-w-[180px]">
                                      <Mail className="w-3 h-3 flex-shrink-0" />
                                      {contact.email}
                                    </span>
                                  )}
                                  {contact.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3 flex-shrink-0" />
                                      {formatPhoneNumber(contact.phone)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Accordion chevron */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeContact(contact.id);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                                  title="Remove contact"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                {expandedContactIds.includes(contact.id)
                                  ? <ChevronUp className="h-5 w-5 text-gray-400" />
                                  : <ChevronDown className="h-5 w-5 text-gray-400" />}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent
                            className={`space-y-5 ${!expandedContactIds.includes(contact.id)
                              ? "hidden"
                              : ""
                              }`}
                          >
                            {/* SECTION: Identity - Headshot + Name */}
                            <div className="flex items-start gap-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                              {/* Headshot (moved to top) */}
                              <div className="flex-shrink-0">
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Headshot</Label>
                                <UniversalImageEditorModal
                                  type="headshot"
                                  icon={<UserCircle className="w-8 h-8 text-muted-foreground" />}
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
                              </div>
                              {/* Name + Title column */}
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`firstName-${contact.id}`}>
                                    First Name <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    icon={<User className="h-4 w-4" />}
                                    id={`firstName-${contact.id}`}
                                    value={contact.firstName || ""}
                                    onChange={(e) => {
                                      const firstName = e.target.value;
                                      updateContact(contact.id, {
                                        firstName,
                                        name: `${firstName} ${contact.lastName || ""}`.trim(),
                                      });
                                    }}
                                    placeholder="First name"
                                    required
                                    className={
                                      hasError(`contact_${contact.id}_firstName`, index)
                                        ? "border-red-500"
                                        : ""
                                    }
                                  />
                                  {hasError(`contact_${contact.id}_firstName`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      First Name is required
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`lastName-${contact.id}`}>
                                    Last Name <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    icon={<User className="h-4 w-4" />}
                                    id={`lastName-${contact.id}`}
                                    value={contact.lastName || ""}
                                    onChange={(e) => {
                                      const lastName = e.target.value;
                                      updateContact(contact.id, {
                                        lastName,
                                        name: `${contact.firstName || ""} ${lastName}`.trim(),
                                      });
                                    }}
                                    placeholder="Last name"
                                    required
                                    className={
                                      hasError(`contact_${contact.id}_lastName`, index)
                                        ? "border-red-500"
                                        : ""
                                    }
                                  />
                                  {hasError(`contact_${contact.id}_lastName`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Last Name is required
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2 sm:col-span-2">
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
                                      hasError(`contact_${contact.id}_title`, index)
                                        ? "border-red-500"
                                        : ""
                                    }
                                  />
                                  {hasError(`contact_${contact.id}_title`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Title is required
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* SECTION: Contact Details */}
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Details</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Email */}
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
                                      hasError(`contact_${contact.id}_email`, index)
                                        ? "border-red-500"
                                        : ""
                                    }
                                  />
                                  {hasError(`contact_${contact.id}_email`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      {contact.email && contact.email.trim() !== ""
                                        ? "Please enter a valid email address"
                                        : "Email is required"}
                                    </p>
                                  )}
                                </div>

                                {/* Phone (+ext) */}
                                <div className="space-y-2">
                                  <Label htmlFor={`phone-${contact.id}`}>
                                    Phone <span className="text-red-500">*</span>
                                  </Label>
                                  <div className="flex gap-2">
                                    <Input
                                      icon={<Phone className="h-4 w-4" />}
                                      id={`phone-${contact.id}`}
                                      type="tel"
                                      value={contact.phone ? formatPhoneNumber(contact.phone) : ""}
                                      onChange={(e) => {
                                        const normalized = normalizePhoneNumber(e.target.value);
                                        if (normalized.length > 11) return;
                                        updateContact(contact.id, { phone: normalized });
                                      }}
                                      placeholder="(555) 123-4567"
                                      required
                                      className={`flex-1 ${hasError(`contact_${contact.id}_phone`, index) ? "border-red-500" : ""}`}
                                    />
                                    <Input
                                      id={`phoneExtension-${contact.id}`}
                                      value={contact.phoneExtension || ""}
                                      onChange={(e) => {
                                        const normalized = normalizeExtension(e.target.value);
                                        updateContact(contact.id, { phoneExtension: normalized });
                                      }}
                                      placeholder="Ext."
                                      className="w-20"
                                    />
                                  </div>
                                  {hasError(`contact_${contact.id}_phone`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Phone is required
                                    </p>
                                  )}
                                </div>

                                {/* Website (optional) */}
                                <div className="space-y-2">
                                  <Label htmlFor={`website-${contact.id}`}>
                                    Website (optional)
                                  </Label>
                                  <Input
                                    id={`website-${contact.id}`}
                                    type="url"
                                    value={contact.website || ""}
                                    onChange={(e) =>
                                      updateContact(contact.id, { website: e.target.value })
                                    }
                                    placeholder="https://example.com"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* SECTION: Assignment */}
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Role & Assignment</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Benefits Category */}
                                <div className="space-y-2">
                                  <Label htmlFor={`benefitsCategory-${contact.id}`}>
                                    Benefits Category <span className="text-red-500">*</span>
                                  </Label>
                                  <Select
                                    value={contact.benefitsCategory || "Retirement"}
                                    onValueChange={(value) => {
                                      updateContact(contact.id, {
                                        benefitsCategory: value as
                                          | "Retirement"
                                          | "Group Health"
                                          | "Group Life"
                                          | "Company / Plan Sponsor"
                                          | "Other Benefits",
                                        benefitsCategoryOther: value !== "Other Benefits" ? undefined : "",
                                      });
                                    }}
                                  >
                                    <SelectTrigger
                                      className={
                                        hasError(`contact_${contact.id}_benefitsCategory`, index)
                                          ? "border-red-500"
                                          : ""
                                      }
                                    >
                                      <SelectValue placeholder="Select benefits category" />
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
                                      id={`benefitsCategoryOther-${contact.id}`}
                                      value={contact.benefitsCategoryOther || ""}
                                      onChange={(e) =>
                                        updateContact(contact.id, {
                                          benefitsCategoryOther: e.target.value.slice(0, 32),
                                        })
                                      }
                                      placeholder="Enter custom category (max 32 chars)"
                                      maxLength={32}
                                      className="mt-2"
                                    />
                                  )}
                                  {hasError(`contact_${contact.id}_benefitsCategory`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Benefits Category is required
                                    </p>
                                  )}
                                </div>

                                {/* Role */}
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
                                        roleOther: value !== "Other" ? undefined : "",
                                      });
                                    }}
                                  >
                                    <SelectTrigger
                                      className={
                                        hasError(`contact_${contact.id}_role`, index)
                                          ? "border-red-500"
                                          : ""
                                      }
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
                                  {hasError(`contact_${contact.id}_role`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Role is required
                                    </p>
                                  )}
                                </div>

                                {/* Company Name */}
                                <div className="space-y-2">
                                  <Label htmlFor={`companyName-${contact.id}`}>
                                    Company Name <span className="text-red-500">*</span>
                                  </Label>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                      <CompanyAutocompleteInput
                                        value={contact.companyName || ""}
                                        placeholder="Search existing companies"
                                        hasError={hasError(`contact_${contact.id}_companyName`, index)}
                                        onManualChange={(value) => {
                                          updateContact(contact.id, {
                                            companyName: value,
                                            companyLogo: value !== contact.companyName ? undefined : contact.companyLogo,
                                          });
                                        }}
                                        onSuggestionSelect={(suggestion) => {
                                          const updates: Partial<KeyContact> = { companyName: suggestion.name };
                                          if (suggestion.logo) updates.companyLogo = suggestion.logo;
                                          updateContact(contact.id, updates);
                                        }}
                                      />
                                    </div>
                                    {/* Company Logo upload / display */}
                                    <div className="flex-shrink-0">
                                      {contact.companyLogo ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-14 h-14 rounded-xl border-2 border-gray-200 dark:border-gray-600 overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                                            <BrandingImage
                                              src={contact.companyLogo}
                                              alt="Company logo"
                                              className="max-h-12 max-w-12 object-contain"
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => updateContact(contact.id, { companyLogo: undefined })}
                                            className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
                                            title="Remove logo"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <UniversalImageEditorModal
                                          type="logo"
                                          icon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                                          value=""
                                          fileName=""
                                          onChange={(value) => updateContact(contact.id, { companyLogo: value })}
                                          onRemove={() => {}}
                                          placeholder="Logo"
                                        />
                                      )}
                                    </div>
                                  </div>
                                  {hasError(`contact_${contact.id}_companyName`, index) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Company Name is required
                                    </p>
                                  )}
                                </div>

                                {/* Is Primary For Category */}
                                <div className="space-y-2">
                                  <Label htmlFor={`isPrimaryForCategory-${contact.id}`}>
                                    Primary contact for this category?
                                  </Label>
                                  <div className="flex items-center gap-2 h-10">
                                    <Switch
                                      id={`isPrimaryForCategory-${contact.id}`}
                                      checked={contact.isPrimaryForCategory || false}
                                      onCheckedChange={(checked) => {
                                        updateContact(contact.id, { isPrimaryForCategory: checked });
                                        if (checked) handleSetPrimary(contact.id);
                                      }}
                                    />
                                    <Label
                                      htmlFor={`isPrimaryForCategory-${contact.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {contact.isPrimaryForCategory ? "Yes" : "No"}
                                    </Label>
                                  </div>
                                </div>
                              </div>
                            </div>

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
