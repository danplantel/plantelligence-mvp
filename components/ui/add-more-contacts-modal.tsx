"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Shield, Heart, Gift, Check, Users } from "lucide-react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";

interface AddMoreContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkip: () => void;
  onAddContactForCategory: (category: BenefitsCategory) => void;
  contacts?: KeyContact[];
}

export function AddMoreContactsModal({
  open,
  onOpenChange,
  onSkip,
  onAddContactForCategory,
  contacts = [],
}: AddMoreContactsModalProps) {
  // Only show these 4 categories as per design
  const allCategories: BenefitsCategory[] = [
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
    "Recordkeeper / Vendor": Building2,
    "Third Party Contact": Building2,
    Multiple: Building2,
  };

  // Count contacts for each category
  const getContactCount = (category: BenefitsCategory): number => {
    return contacts.filter((contact) => {
      if (
        !contact.benefitsCategories ||
        contact.benefitsCategories.length === 0
      ) {
        return false;
      }
      return contact.benefitsCategories.includes(category);
    }).length;
  };

  // Check if category has contacts
  const hasContacts = (category: BenefitsCategory): boolean => {
    return getContactCount(category) > 0;
  };

  const handleCategoryClick = (category: BenefitsCategory) => {
    onAddContactForCategory(category);
    onOpenChange(false);
  };

  const handleAddAnother = (
    category: BenefitsCategory,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    handleCategoryClick(category);
  };

  // Count contacts for Company/Plan Sponsor (Company / Plan Sponsor category)
  const companyContactCount = getContactCount("Company / Plan Sponsor");
  const hasCompanyContacts = companyContactCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            Save & Add Contact or Next
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Company / Plan Sponsor Section */}
          <div className="bg-accent-blue/5 rounded-lg p-4 border border-accent-blue/20">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
                Company / Plan Sponsor
              </h3>
              {hasCompanyContacts ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {companyContactCount} contact
                    {companyContactCount !== 1 ? "s" : ""} added
                  </span>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryClick("Company / Plan Sponsor");
                    }}
                    className="text-accent-blue hover:opacity-80 underline font-medium"
                  >
                    add another
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>No contacts added yet</span>
                </div>
              )}
            </div>
          </div>

          {/* Benefit Categories */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center dark:text-gray-100">
              Benefit Categories
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {allCategories.map((category) => {
                const Icon = categoryIcons[category];
                const contactCount = getContactCount(category);
                const categoryHasContacts = hasContacts(category);

                return (
                  <Card
                    key={category}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md relative",
                      categoryHasContacts
                        ? "border-2 border-accent-blue bg-accent-blue/5"
                        : "border border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600",
                    )}
                    onClick={() => handleCategoryClick(category)}
                  >
                    <CardContent className="p-4 flex flex-col items-center justify-center space-y-3 min-h-[140px]">
                      <div
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center relative",
                          categoryHasContacts ? "bg-accent-blue/10" : "bg-gray-100 dark:bg-gray-700",
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-7 h-7",
                            categoryHasContacts
                              ? "text-accent-blue"
                              : "text-gray-600 dark:text-gray-400",
                          )}
                        />
                        {categoryHasContacts && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent-blue rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-sm font-semibold text-center dark:text-gray-200">
                          {category === "Other Benefits" ? "Other" : category}
                        </span>
                        {categoryHasContacts && (
                          <div className="flex flex-col items-center space-y-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {contactCount} contact
                              {contactCount !== 1 ? "s" : ""} added
                            </span>
                            <button
                              onClick={(e) => handleAddAnother(category, e)}
                              className="text-xs text-accent-blue hover:opacity-80 underline font-medium"
                            >
                              add another
                            </button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Skip Button */}
        <div className="flex justify-center pt-4 border-t dark:border-gray-700">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            className="text-gray-600 hover:text-gray-900 font-medium dark:text-gray-400 dark:hover:text-gray-200"
          >
            skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
