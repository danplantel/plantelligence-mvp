"use client";

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
import {
  Building2,
  Shield,
  Heart,
  Gift,
  Plus,
  Users,
  Briefcase,
} from "lucide-react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";

interface IncompleteCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFillCategories: () => void;
  onSkip: () => void;
  missingCategories: BenefitsCategory[];
  onAddContactForCategory?: (category: BenefitsCategory) => void;
  contacts?: KeyContact[];
}

export function IncompleteCategoriesModal({
  open,
  onOpenChange,
  onFillCategories,
  onSkip,
  missingCategories,
  onAddContactForCategory,
  contacts = [],
}: IncompleteCategoriesModalProps) {
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

  // Check if category is missing
  const isCategoryMissing = (category: BenefitsCategory): boolean => {
    return missingCategories.includes(category);
  };

  const handleCategoryClick = (category: BenefitsCategory) => {
    if (onAddContactForCategory) {
      onAddContactForCategory(category);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Complete All Categories</DialogTitle>
          <DialogDescription>
            Please add contacts for all categories or you can skip ahead after adding one contact.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
            The following categories need contacts:
          </p>
          
          {/* Categories Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {allCategories.map((category) => {
              const Icon = categoryIcons[category];
              const isMissing = isCategoryMissing(category);
              const contactCount = getContactCount(category);
              const hasContacts = contactCount > 0;

              return (
                <Card
                  key={category}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md relative",
                    isMissing
                      ? "border-2 border-orange-500 bg-orange-50"
                      : hasContacts
                      ? "border-2 border-green-500 bg-green-50"
                      : "border border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500",
                  )}
                  onClick={() => handleCategoryClick(category)}
                >
                  <CardContent className="p-4 flex flex-col items-center justify-center space-y-2 min-h-[100px]">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center relative",
                        isMissing
                          ? "bg-orange-100"
                          : hasContacts
                          ? "bg-green-100"
                          : "bg-gray-100 dark:bg-gray-700",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-6 h-6",
                          isMissing
                            ? "text-orange-600"
                            : hasContacts
                            ? "text-green-600"
                            : "text-gray-600 dark:text-gray-400",
                        )}
                      />
                      {isMissing && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                          <Plus className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {hasContacts && !isMissing && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-bold">✓</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-xs font-semibold text-center dark:text-gray-200">
                        {category === "Other Benefits" ? "Other" : category}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {contactCount} {contactCount === 1 ? "contact" : "contacts"}
                      </span>
                    </div>
                    {isMissing && (
                      <span className="text-xs text-orange-600 font-medium">
                        Click to add
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Missing Categories List */}
          {missingCategories.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm font-medium text-orange-900 mb-2">
                Missing categories:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-orange-800">
                {missingCategories.map((category) => (
                  <li key={category}>
                    {category === "Other Benefits" ? "Other" : category}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            className="w-full sm:w-auto"
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={onFillCategories}
            className="w-full sm:w-auto"
          >
            Go to Add Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

