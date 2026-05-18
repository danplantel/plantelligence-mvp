"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UploadInput } from "@/components/ui/upload-input";
import { ChevronDown, ChevronUp, Plus, MoreVertical } from "lucide-react";
import { KeyContact } from "@/types/new-client-wizard";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";

interface KeyContactsSectionProps {
  keyContacts: KeyContact[];
  onContactsChange: (contacts: KeyContact[]) => void;
  onHeadshotUpload: (index: number, file: File) => void;
  onHeadshotRemove: (index: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function KeyContactsSection({
  keyContacts,
  onContactsChange,
  onHeadshotUpload,
  onHeadshotRemove,
  isOpen,
  onToggle,
}: KeyContactsSectionProps) {
  const handleKeyContactChange = (
    index: number,
    field: keyof KeyContact,
    value: any,
  ) => {
    onContactsChange(
      keyContacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact,
      ),
    );
  };

  const addKeyContact = () => {
    onContactsChange([
      ...keyContacts,
      {
        id: Date.now().toString(),
        contactType: "individual",
        benefitsCategories: ["Retirement"],
        benefitsCategory: "Retirement" as const,
        role: "Advisor / Specialist" as const,
        isPrimaryForCategory: false,
        companyName: "",
        firstName: "",
        lastName: "",
        title: "",
        email: "",
        phone: "",
        headshot: "",
        showOnPortal: true,
        enableContactButton: false,
        isPrimary: false,
        // Legacy fields for backward compatibility
        name: "",
        customRole: "",
      },
    ]);
  };

  const removeKeyContact = (index: number) => {
    if (index === 0) return;
    onContactsChange(keyContacts.filter((_, i) => i !== index));
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl">Key Contacts</CardTitle>
          </div>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
        <p className="font-light text-muted-foreground">
          Add key contacts for this client
        </p>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {keyContacts.map((contact, index) => (
              <div key={index} className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-0 w-8 h-12">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        addKeyContact();
                      }}
                    >
                      Duplicate
                    </DropdownMenuItem>
                    {index > 0 && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          removeKeyContact(index);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex-1 space-y-4">
                  {/* First row */}
                  <div className="flex-1 gap-4 grid grid-cols-1 md:grid-cols-2">
                    {/* Name */}
                    <div>
                      <label className="block mb-1 font-medium text-sm">
                        {index === 0
                          ? "Primary contact *"
                          : index === 1
                          ? "Secondary contact *"
                          : "Additional contact *"}
                      </label>
                      <Input
                        value={contact.name}
                        onChange={(e) =>
                          handleKeyContactChange(index, "name", e.target.value)
                        }
                        placeholder="Full name"
                      />
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block mb-1 font-medium text-muted-foreground text-sm">
                        Role *
                      </label>
                      <Select
                        value={contact.role}
                        onValueChange={(value) => {
                          handleKeyContactChange(index, "role", value);
                        }}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Advisor / Financial Services */}
                          <SelectItem value="Financial Advisor">
                            Financial Advisor
                          </SelectItem>
                          <SelectItem value="Retirement Plan Advisor">
                            Retirement Plan Advisor
                          </SelectItem>
                          <SelectItem value="Wealth Manager">
                            Wealth Manager
                          </SelectItem>
                          <SelectItem value="Financial Planner">
                            Financial Planner
                          </SelectItem>
                          <SelectItem value="Investment Consultant">
                            Investment Consultant
                          </SelectItem>
                          <SelectItem value="Insurance Agent">
                            Insurance Agent
                          </SelectItem>
                          <SelectItem value="Insurance Advisor">
                            Insurance Advisor
                          </SelectItem>

                          {/* HR / Employer (Plan Sponsor) */}
                          <SelectItem value="HR Manager">HR Manager</SelectItem>
                          <SelectItem value="HR Director">
                            HR Director
                          </SelectItem>
                          <SelectItem value="Benefits Manager">
                            Benefits Manager
                          </SelectItem>
                          <SelectItem value="Benefits Director">
                            Benefits Director
                          </SelectItem>
                          <SelectItem value="Compensation & Benefits Specialist">
                            Compensation & Benefits Specialist
                          </SelectItem>
                          <SelectItem value="Chief Human Resources Officer (CHRO)">
                            Chief Human Resources Officer (CHRO)
                          </SelectItem>
                          <SelectItem value="CFO / Finance Manager">
                            CFO / Finance Manager
                          </SelectItem>

                          {/* Recordkeeper / Partner */}
                          <SelectItem value="Relationship Manager">
                            Relationship Manager
                          </SelectItem>
                          <SelectItem value="Client Success Manager">
                            Client Success Manager
                          </SelectItem>
                          <SelectItem value="Plan Consultant">
                            Plan Consultant
                          </SelectItem>
                          <SelectItem value="Compliance Specialist">
                            Compliance Specialist
                          </SelectItem>

                          {/* Other */}
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {contact.role === "Other" && (
                        <Input
                          className="mt-1"
                          value={contact.customRole || ""}
                          onChange={(e) =>
                            handleKeyContactChange(
                              index,
                              "customRole",
                              e.target.value,
                            )
                          }
                          placeholder="Enter custom role"
                        />
                      )}
                    </div>
                  </div>

                  {/* Second row - Email and Phone (Required fields) */}
                  <div className="flex-1 gap-4 grid grid-cols-1 md:grid-cols-2">
                    {/* Email */}
                    <div>
                      <label className="block mb-1 font-medium text-muted-foreground text-sm">
                        Email *
                      </label>
                      <Input
                        type="email"
                        value={contact.email}
                        onChange={(e) =>
                          handleKeyContactChange(index, "email", e.target.value)
                        }
                        placeholder="Enter email"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox
                          checked={contact.showOnPortal}
                          onCheckedChange={(checked) =>
                            handleKeyContactChange(
                              index,
                              "showOnPortal",
                              Boolean(checked),
                            )
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          Display on portal
                        </span>
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block mb-1 font-medium text-muted-foreground text-sm">
                        Phone *
                      </label>
                      <Input
                        type="tel"
                        value={formatPhoneNumber(contact.phone)}
                        onChange={(e) => {
                          const normalized = normalizePhoneNumber(
                            e.target.value,
                          );
                          handleKeyContactChange(index, "phone", normalized);
                        }}
                        placeholder="(555) 123-4567"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox
                          checked={contact.showOnPortal}
                          onCheckedChange={(checked) =>
                            handleKeyContactChange(
                              index,
                              "showOnPortal",
                              Boolean(checked),
                            )
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          Display on portal
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Third row - Contact Button */}
                  <div className="flex-1">
                    <label className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={contact.enableContactButton}
                        onCheckedChange={(checked) =>
                          handleKeyContactChange(
                            index,
                            "enableContactButton",
                            Boolean(checked),
                          )
                        }
                      />
                      <span className="font-medium text-sm">
                        Contact button
                      </span>
                    </label>
                    {contact.enableContactButton && (
                      <div className="mt-2 space-y-3">
                        <RadioGroup
                          value="email"
                          onValueChange={(value) => {
                            // Handle contact button type change
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="email"
                              id={`email-${index}`}
                            />
                            <Label
                              htmlFor={`email-${index}`}
                              className="text-sm"
                            >
                              Use email
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="contact-form"
                              id={`contact-form-${index}`}
                            />
                            <Label
                              htmlFor={`contact-form-${index}`}
                              className="text-sm"
                            >
                              Use contact form
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                  {/* Fourth row - Headshot and Bio */}
                  <div className="gap-4 grid grid-cols-1 md:grid-cols-3 mt-4">
                    {/* Headshot */}
                    <div className="md:col-span-1">
                      <label className="block mb-1 font-medium text-muted-foreground text-sm">
                        Headshot
                      </label>
                      <UploadInput
                        id={`headshot-${index}`}
                        value={contact.headshot || ""}
                        fileName={contact.name || "Headshot"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onHeadshotUpload(index, file);
                        }}
                        onRemove={() => onHeadshotRemove(index)}
                        placeholder="Upload headshot"
                      />
                    </div>

                    {/* Short bio */}
                    <div className="md:col-span-2">
                      <label className="block mb-1 font-medium text-muted-foreground text-sm">
                        Short bio
                      </label>
                      <Textarea
                        maxLength={200}
                        value=""
                        onChange={(e) => {
                          // Bio field not available in current type
                        }}
                        placeholder="Short bio (max 200 chars)"
                        className="h-24"
                      />
                      <div className="flex justify-end">
                        <span className="mt-1 text-[14px] text-gray-500">
                          0/200
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              disabled={keyContacts.length >= 3}
              onClick={addKeyContact}
              variant="outline"
              className="hover:bg-muted/50 shadow-none py-6 border-none text-accent-blue"
            >
              <Plus className="mr-2 size-6" />
              Add Contact
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
