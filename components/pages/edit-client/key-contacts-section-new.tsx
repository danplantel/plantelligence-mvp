"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { KeyContactsSection } from "@/components/wizard/new-client-steps/sections/key-contacts-section";
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
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Key Contacts</CardTitle>
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
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent>
          <KeyContactsSection
            contacts={contacts}
            onContactsChange={onContactsChange}
            validationErrors={validationErrors}
          />

          <Button onClick={addContact} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Contact ({contacts.length})
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
