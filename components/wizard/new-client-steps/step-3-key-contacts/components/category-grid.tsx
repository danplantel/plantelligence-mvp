"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Building2, Shield, Heart, Gift, Check, Users, Briefcase } from "lucide-react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";

export interface CategoryGridProps {
  /** The 4 benefit categories to display (default: Retirement, Group Health, Group Life, Other Benefits) */
  categories: BenefitsCategory[];
  /** Currently selected category (highlighted with blue border + checkmark) */
  selectedCategory: BenefitsCategory | null;
  /** Called when a category card is clicked */
  onCategorySelect: (category: BenefitsCategory) => void;
  /** All contacts to count per category */
  contacts: KeyContact[];
  /** Contact count for Company/Plan Sponsor (computed externally for consistency) */
  companyContactCount: number;
  /** Whether to disable non-Plan-Sponsor categories until Plan Sponsor exists */
  lockCategoriesUntilSponsor: boolean;
  /** Whether this grid includes Company/Plan Sponsor card at top */
  showPlanSponsorCard?: boolean;
  /** Company logo URL for Plan Sponsor card */
  planSponsorCompanyLogo?: string;
  /** Error fields from validation */
  errorFields?: string[];
  /** Whether to show contact count badges */
  showContactCounts?: boolean;
  /** Whether this is the "from step3b" re-entry mode (hide contact counts) */
  fromStep3b?: boolean;
  /** Other Benefits custom text */
  otherBenefitsText?: string;
  /** Called when Other Benefits text changes */
  onOtherBenefitsTextChange?: (text: string) => void;
  /** Show Other Benefits text input below the grid */
  showOtherBenefitsInput?: boolean;
}

const CATEGORY_ICONS: Record<BenefitsCategory, typeof Building2> = {
  Retirement: Building2,
  "Group Health": Shield,
  "Group Life": Heart,
  "Other Benefits": Gift,
  "Company / Plan Sponsor": Users,
  "Recordkeeper / Vendor": Briefcase,
  "Third Party Contact": Briefcase,
};

const CATEGORY_LOGOS: Record<BenefitsCategory, string> = {
  Retirement: "/benefits-logo/Waypoint-WEB.webp",
  "Group Health": "/benefits-logo/Integrity_H_CMYK.jpeg",
  "Group Life": "/benefits-logo/Sun-Life-Financial.jpg",
  "Other Benefits": "/benefits-logo/wellhub.png",
  "Company / Plan Sponsor": "",
  "Recordkeeper / Vendor": "",
  "Third Party Contact": "",
};

/** Count complete contacts per category */
export function getContactCountForCategory(
  contacts: any[],
  category: BenefitsCategory,
): number {
  return contacts.filter((contact) => {
    const hasFirstName =
      contact.firstName && String(contact.firstName).trim() !== "";
    const hasLastName =
      contact.lastName && String(contact.lastName).trim() !== "";
    const hasEmail = contact.email && String(contact.email).trim() !== "";
    const hasPhone = contact.phone && String(contact.phone).trim() !== "";
    const isComplete = hasFirstName && hasLastName && (hasEmail || hasPhone);
    if (!isComplete) return false;
    const contactCategories =
      contact.benefitsCategories ||
      (contact.benefitsCategory ? [contact.benefitsCategory] : []);
    if (!contactCategories || contactCategories.length === 0) return false;
    return contactCategories.includes(category);
  }).length;
}

export function CategoryGrid({
  categories,
  selectedCategory,
  onCategorySelect,
  contacts,
  companyContactCount,
  lockCategoriesUntilSponsor,
  showPlanSponsorCard = false,
  planSponsorCompanyLogo,
  errorFields = [],
  showContactCounts = true,
  fromStep3b = false,
  otherBenefitsText = "",
  onOtherBenefitsTextChange,
  showOtherBenefitsInput = false,
}: CategoryGridProps) {
  const hasPlanSponsor = companyContactCount > 0;
  const isLocked = lockCategoriesUntilSponsor && !hasPlanSponsor;

  const getCategoryContactCount = (category: BenefitsCategory): number => {
    if (category === "Company / Plan Sponsor") return companyContactCount;
    return getContactCountForCategory(contacts, category);
  };

  return (
    <div className="space-y-2">
      {/* Company / Plan Sponsor Card (optional, shown above the grid) */}
      {showPlanSponsorCard && (
        <div
          className={cn(
            "rounded-lg border max-w-2xl mx-auto cursor-pointer transition-all hover:shadow-md",
            selectedCategory === "Company / Plan Sponsor"
              ? "border-2 border-accent-blue bg-accent-blue/5"
              : "bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-600",
            errorFields.includes("benefitsCategory") &&
              selectedCategory !== "Company / Plan Sponsor" &&
              "border-red-300",
          )}
          onClick={() => onCategorySelect("Company / Plan Sponsor")}
          role="button"
          tabIndex={0}
          aria-pressed={selectedCategory === "Company / Plan Sponsor"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCategorySelect("Company / Plan Sponsor");
            }
          }}
        >
          <div className="p-4 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-2 dark:text-gray-100">
              Company / Plan Sponsor
            </h3>
            {planSponsorCompanyLogo?.trim() ? (
              <div className="relative inline-block mb-2">
                <BrandingImage
                  src={planSponsorCompanyLogo}
                  alt="Company logo"
                  className="w-32 h-32"
                />
                {selectedCategory === "Company / Plan Sponsor" && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            ) : (
              selectedCategory === "Company / Plan Sponsor" && (
                <div className="relative inline-block mb-2">
                  <div className="w-32 h-14" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
              )
            )}
            {!fromStep3b && showContactCounts && (
              <p className="text-xs text-gray-700 dark:text-gray-400">
                {companyContactCount === 0
                  ? "Contact(s) needed"
                  : `${companyContactCount} ${companyContactCount === 1 ? "contact" : "contacts"} added`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Benefit Category Cards Grid */}
      <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto">
        {categories.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const isSelected = selectedCategory === category;
          const contactCount = getCategoryContactCount(category);
          const hasError =
            errorFields.includes("benefitsCategory") &&
            selectedCategory === null;

          return (
            <Card
              key={category}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md flex-1 dark:bg-gray-800",
                isSelected
                  ? "border-2 border-accent-blue bg-accent-blue/5"
                  : "border border-gray-200 hover:border-gray-300 dark:border-gray-600",
                hasError && !isSelected && "border-red-300",
                isLocked &&
                  !isSelected &&
                  "cursor-not-allowed opacity-[0.58] hover:shadow-none",
              )}
              onClick={() => onCategorySelect(category)}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-pressed={isSelected}
              aria-disabled={isLocked}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isLocked) {
                  e.preventDefault();
                  onCategorySelect(category);
                }
              }}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center space-y-2 min-h-[100px]">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center relative",
                    isSelected
                      ? "bg-accent-blue/10"
                      : "bg-gray-100 dark:bg-gray-700",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-6 h-6",
                      isSelected
                        ? "text-accent-blue"
                        : "text-gray-600 dark:text-gray-400",
                    )}
                  />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center space-y-0.5">
                  <span className="text-xs font-semibold text-center dark:text-gray-200">
                    {category === "Other Benefits" ? "Other" : category}
                  </span>
                  {!fromStep3b && showContactCounts && (
                    <span
                      className={cn(
                        "text-xs",
                        contactCount === 0
                          ? "text-gray-500 font-medium dark:text-gray-400"
                          : "text-gray-500 dark:text-gray-400",
                      )}
                    >
                      {contactCount === 0
                        ? "Contact(s) needed"
                        : `${contactCount} ${contactCount === 1 ? "contact" : "contacts"} added`}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Other Benefits Text Input (conditional) */}
      {showOtherBenefitsInput && onOtherBenefitsTextChange && (
        <div
          className={cn(
            "max-w-2xl mx-auto mt-4 transition-all duration-300 ease-in-out overflow-hidden",
            selectedCategory === "Other Benefits"
              ? "opacity-100 max-h-[500px]"
              : "opacity-0 max-h-0 mt-0",
          )}
        >
          <Card className="dark:bg-gray-800 dark:border-gray-600">
            <CardContent className="p-4">
              <div className="space-y-2">
                <label
                  htmlFor="other-benefits-text"
                  className="text-sm font-medium dark:text-gray-300"
                >
                  Please specify other category (max 50 characters)
                </label>
                <input
                  id="other-benefits-text"
                  value={otherBenefitsText}
                  onChange={(e) => onOtherBenefitsTextChange(e.target.value)}
                  placeholder="Enter custom type"
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
                <div className="text-xs text-muted-foreground text-right dark:text-gray-400">
                  {otherBenefitsText.length}/50 characters
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
