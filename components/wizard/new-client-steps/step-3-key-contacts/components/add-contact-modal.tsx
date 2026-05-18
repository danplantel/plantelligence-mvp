"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Shield,
  Heart,
  Gift,
  Check,
  Users,
  Briefcase,
} from "lucide-react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  benefitsCategory: BenefitsCategory;
  onBenefitsCategoryChange: (category: BenefitsCategory) => void;
  onCreateContact: (selectedContact?: any) => void;
  contacts?: KeyContact[];
  otherBenefitsText?: string;
  onOtherBenefitsTextChange?: (text: string) => void;
  defaultCompanyLogo?: string;
  globalContacts?: any[];
  advisorProfile?: any;
  isFetchingGlobalContacts?: boolean;
}

export function AddContactModal({
  open,
  onOpenChange,
  benefitsCategory,
  onBenefitsCategoryChange,
  onCreateContact,
  contacts = [],
  otherBenefitsText = "",
  onOtherBenefitsTextChange,
  defaultCompanyLogo,
  globalContacts = [],
  advisorProfile,
  isFetchingGlobalContacts,
}: AddContactModalProps) {
  const [selectedContactToImport, setSelectedContactToImport] = useState<any>(null);

  // Only show these 4 categories as per design
  const categories: BenefitsCategory[] = [
    "Retirement",
    "Group Health",
    "Group Life",
    "Other Benefits",
  ];

  const categoryIcons: Record<BenefitsCategory, typeof Building2> = {
    Retirement: Building2,
    "Group Health": Shield,
    "Group Life": Heart,
    "Other Benefits": Gift,
    "Company / Plan Sponsor": Users,
    "Recordkeeper / Vendor": Briefcase,
  };

  // Count contacts for each category
  const getContactCount = (category: BenefitsCategory): number => {
    return contacts.filter((contact) => {
      if (!contact.benefitsCategories || contact.benefitsCategories.length === 0) {
        return false;
      }
      return contact.benefitsCategories.includes(category);
    }).length;
  };

  const companyContactCount = getContactCount("Company / Plan Sponsor");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl z-[100]">
        <DialogHeader>
          <DialogTitle>Company/Plan Sponsor</DialogTitle>
          <DialogDescription>
            Choose the type of contact you want to add first. You can add multiple contacts and assign them to specific benefits categories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Company / Plan Sponsor Section */}
          <div
            className={cn(
              "rounded-lg p-4 border max-w-2xl mx-auto cursor-pointer transition-all hover:shadow-md",
              benefitsCategory === "Company / Plan Sponsor"
                ? "border-2 border-accent-blue bg-accent-blue/5"
                : "bg-white border-gray-200 hover:border-gray-300",
            )}
            onClick={() => onBenefitsCategoryChange("Company / Plan Sponsor")}
          >
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  Company / Plan Sponsor
                </h3>
                {/* Company Logo */}
                <div className="flex items-center justify-center mb-3">
                  <div className="relative flex min-h-[4rem] max-h-24 w-full max-w-[220px] min-w-0 items-center justify-center px-1 py-1">
                    {defaultCompanyLogo?.trim() ? (
                      <BrandingImage
                        src={defaultCompanyLogo}
                        alt="Company logo"
                        className="max-h-[5.5rem] w-auto max-w-full object-contain"
                      />
                    ) : null}
                    {benefitsCategory === "Company / Plan Sponsor" && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span
                    className={cn(
                      "text-gray-700",
                      companyContactCount === 0 && "text-gray-500",
                    )}
                  >
                    {companyContactCount} contact
                    {companyContactCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Category Selection */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-3">
              {categories.map((category) => {
                const Icon = categoryIcons[category];
                const isSelected = benefitsCategory === category;
                const contactCount = getContactCount(category);
                return (
                  <Card
                    key={category}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      isSelected
                        ? "border-2 border-accent-blue bg-accent-blue/5"
                        : "border border-gray-200 hover:border-gray-300",
                    )}
                    onClick={() => onBenefitsCategoryChange(category)}
                  >
                    <CardContent className="p-6 flex flex-col items-center justify-center space-y-3 min-h-[120px]">
                      <div
                        className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center relative",
                          isSelected ? "bg-accent-blue/10" : "bg-gray-100",
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-8 h-8",
                            isSelected ? "text-accent-blue" : "text-gray-600",
                          )}
                        />
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent-blue rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-sm font-semibold text-center">
                          {category === "Other Benefits" ? "Other" : category}
                        </span>
                        <span className="text-xs text-gray-500">
                          {contactCount} {contactCount === 1 ? "contact" : "contacts"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Import / Select Existing Section */}
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">Import from Saved Contacts (Optional)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Advisor Info Option */}
              <div
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3",
                  selectedContactToImport?.type === "advisor"
                    ? "border-accent-blue bg-accent-blue/5"
                    : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => setSelectedContactToImport({ type: "advisor", data: advisorProfile })}
              >
                <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-accent-blue" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate">Advisor Info</span>
                  <span className="text-xs text-gray-500 truncate">{advisorProfile?.name || "Use my profile"}</span>
                </div>
              </div>

              {/* Global Saved Contacts Dropdown/List */}
              {globalContacts.length > 0 && (
                <div className="relative group">
                  <select
                    className={cn(
                      "w-full h-full p-3 pl-12 rounded-lg border cursor-pointer transition-all text-sm appearance-none",
                      selectedContactToImport?.type === "global"
                        ? "border-accent-blue bg-accent-blue/5"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onChange={(e) => {
                      const contact = globalContacts.find(c => c.id === e.target.value);
                      if (contact) {
                        setSelectedContactToImport({ type: "global", data: contact });
                      }
                    }}
                    value={selectedContactToImport?.type === "global" ? selectedContactToImport.data.id : ""}
                  >
                    <option value="" disabled>Select Saved Contact</option>
                    {globalContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name || contact.fullName || contact.email}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center pointer-events-none">
                    <Briefcase className="w-5 h-5 text-gray-600" />
                  </div>
                </div>
              )}
            </div>
            {isFetchingGlobalContacts && (
              <p className="text-xs text-gray-400 italic">Searching for saved contacts...</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedContactToImport(null);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCreateContact(selectedContactToImport?.data);
              setSelectedContactToImport(null);
            }}
          >
            Create Contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
