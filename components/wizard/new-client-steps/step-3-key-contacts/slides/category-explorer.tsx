"use client";

import { useState, useCallback, useMemo } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Plus,
  Trash2,
  Pencil,
  User,
  Mail,
  Phone,
  Building2,
  Star,
  PiggyBank,
  Shield,
  Heart,
  Puzzle,
} from "lucide-react";
import { Headshot } from "@/components/ui/headshot";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";
import { getContactCountForCategory } from "../components/category-grid";

// ==================== Types ====================

export interface CategoryExplorerProps {
  /** Called when a specific category is selected (user wants to add a contact for it) */
  onCategorySelect: (category: BenefitsCategory) => void;
  /** Called when user clicks Back */
  onBack: () => void;
  /** Called when user clicks Continue to Preview */
  onContinue: () => void;
  /** Called when user wants to edit the main contact (Company/Plan Sponsor) */
  onEditMainContact?: () => void;
  /** Called when user wants to edit a specific benefit contact */
  onEditContact?: (category: BenefitsCategory, contact?: any) => void;
}

// ==================== Constants ====================

const BENEFIT_CATEGORIES: BenefitsCategory[] = [
  "Retirement",
  "Group Health",
  "Group Life",
  "Other Benefits",
];

// Category icons
const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Retirement: PiggyBank,
  "Group Health": Shield,
  "Group Life": Heart,
  "Other Benefits": Puzzle,
};

// ==================== Component ====================

export function CategoryExplorer({
  onCategorySelect,
  onBack,
  onContinue,
  onEditMainContact,
  onEditContact,
}: CategoryExplorerProps) {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();

  const contacts = useMemo(
    () => (stepData.keyContacts?.contacts || []) as any[],
    [stepData.keyContacts],
  );

  const companyContactCount = useMemo(
    () => getContactCountForCategory(contacts, "Company / Plan Sponsor"),
    [contacts],
  );

  const [expandedCategory, setExpandedCategory] =
    useState<BenefitsCategory | null>(null);

  // Check that every benefit category with contacts has a primary contact designated
  const allCategoriesHavePrimary = useMemo(() => {
    return BENEFIT_CATEGORIES.every((cat) => {
      const categoryContacts = contacts.filter((contact: any) => {
        const contactCats: BenefitsCategory[] =
          contact.benefitsCategories ||
          (contact.benefitsCategory ? [contact.benefitsCategory] : []);
        return contactCats.includes(cat);
      });
      if (categoryContacts.length === 0) return true; // no contacts, skip
      return categoryContacts.some(
        (c: any) => c.isPrimaryOverall || c.isPrimary,
      );
    });
  }, [contacts]);

  const hasMinimumContacts = useMemo(
    () =>
      companyContactCount > 0 &&
      contacts.length > 0 &&
      allCategoriesHavePrimary,
    [companyContactCount, contacts.length, allCategoriesHavePrimary],
  );

  const getCategoryStatus = useCallback(
    (category: BenefitsCategory) => {
      return getContactCountForCategory(contacts, category);
    },
    [contacts],
  );

  const allCategoriesCovered = useMemo(
    () => BENEFIT_CATEGORIES.every((cat) => getCategoryStatus(cat) > 0),
    [getCategoryStatus],
  );

  // Check if a category has a primary contact designated
  const hasPrimaryForCategory = useCallback(
    (category: BenefitsCategory) => {
      return contacts.some((contact: any) => {
        const contactCats: BenefitsCategory[] =
          contact.benefitsCategories ||
          (contact.benefitsCategory ? [contact.benefitsCategory] : []);
        return (
          contactCats.includes(category) &&
          (contact.isPrimaryOverall || contact.isPrimary)
        );
      });
    },
    [contacts],
  );

  // Get contacts for a specific category
  const getContactsForCategory = useCallback(
    (category: BenefitsCategory) => {
      return contacts.filter((contact: any) => {
        const contactCategories =
          contact.benefitsCategories ||
          (contact.benefitsCategory ? [contact.benefitsCategory] : []);
        if (!contactCategories || contactCategories.length === 0) return false;
        return contactCategories.includes(category);
      });
    },
    [contacts],
  );

  // Get display name for a contact
  const getContactDisplayName = useCallback((contact: any): string => {
    if (contact.contactType === "team_support") {
      return contact.displayName || contact.name || "Unnamed Team";
    }
    const first = contact.firstName || "";
    const last = contact.lastName || "";
    const full = `${first} ${last}`.trim();
    return full || contact.name || "Unnamed Contact";
  }, []);

  // Delete a contact
  const handleDeleteContact = useCallback(
    (contactId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updatedContacts = contacts.filter(
        (c: any) => c.id !== contactId,
      );
      const currentKeyData = stepData.keyContacts || { contacts: [] };
      const prevOrder = (
        currentKeyData as { contactDisplayOrder?: string[] }
      ).contactDisplayOrder;
      const nextOrder = Array.isArray(prevOrder)
        ? prevOrder.filter((id: string) => id !== contactId)
        : updatedContacts.map((c: any) => c.id);

      saveStepDataLocally("keyContacts", {
        ...currentKeyData,
        contacts: updatedContacts,
        contactDisplayOrder: nextOrder,
      });
    },
    [contacts, stepData.keyContacts, saveStepDataLocally],
  );

  // Toggle a contact as primary for its benefit category (one primary per category).
  // Clicking the star on an already-primary contact un-selects it.
  const handleSetPrimary = useCallback(
    (contactId: string, _category: BenefitsCategory) => {
      if (!contacts.length) return;
      const currentKeyData = stepData.keyContacts || { contacts: [] };

      const promotedContact = contacts.find((c: any) => c.id === contactId);
      const wasAlreadyPrimary =
        promotedContact?.isPrimaryOverall || promotedContact?.isPrimary;
      const promotedCategories: BenefitsCategory[] =
        promotedContact?.benefitsCategories ||
        (promotedContact?.benefitsCategory
          ? [promotedContact.benefitsCategory]
          : []);

      const updatedContacts = contacts.map((c: any) => {
        if (c.id === contactId) {
          // Toggle: if already primary, unset; otherwise promote
          return {
            ...c,
            isPrimaryOverall: !wasAlreadyPrimary,
            isPrimary: !wasAlreadyPrimary,
          };
        }
        // Only demote contacts that share a category with the clicked contact
        const contactCats: BenefitsCategory[] =
          c.benefitsCategories ||
          (c.benefitsCategory ? [c.benefitsCategory] : []);
        const sharesCategory = promotedCategories.some((cat) =>
          contactCats.includes(cat),
        );
        if (sharesCategory && !wasAlreadyPrimary) {
          // If promoting, demote others; if unselecting, leave others alone
          return {
            ...c,
            isPrimaryOverall: false,
            isPrimary: false,
          };
        }
        return c;
      });

      saveStepDataLocally("keyContacts", {
        ...currentKeyData,
        contacts: updatedContacts,
      });
    },
    [contacts, stepData.keyContacts, saveStepDataLocally],
  );

  // Toggle category expansion
  const toggleCategory = useCallback((category: BenefitsCategory) => {
    setExpandedCategory((prev) => (prev === category ? null : category));
  }, []);

  return (
    <div className="flex flex-col items-center space-y-6 py-4">
      {/* Company Logo above header */}
      {stepData?.companyBasics?.companyLogo?.url?.trim() && (
        <BrandingImage
          src={stepData.companyBasics.companyLogo.url}
          alt="Company logo"
          className="w-12 h-12 object-contain mx-auto"
        />
      )}

      {/* Header */}
      <div className="text-center space-y-2 max-w-2xl">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Do employees need different contacts for specific benefits?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-100">
          {contacts.length <= 1
            ? "Great start! Click a category below to add a contact."
            : allCategoriesCovered
              ? !allCategoriesHavePrimary
                ? "Each category needs a primary contact before continuing."
                : "All benefit categories are covered! Click Continue to review your team."
              : "Click any category to add or manage contacts."}
        </p>
      </div>

      {/* Main Contact (Company / Plan Sponsor) Section */}
      {companyContactCount > 0 && (
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-6 h-6 text-accent-blue" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Main Contact
            </span>
          </div>
          <div className="rounded-lg border-2 border-accent-blue/20 bg-white dark:bg-gray-800 overflow-hidden">
            {/* Plan Sponsor contacts */}
            {contacts
              .filter((c: any) => {
                const cats = c.benefitsCategories || (c.benefitsCategory ? [c.benefitsCategory] : []);
                return cats.includes("Company / Plan Sponsor");
              })
              .map((contact: any) => {
                const name = getContactDisplayName(contact);
                const email = contact.email || "";
                const phone = contact.phone || "";
                const formattedPhone = phone
                  ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`
                  : "";

                return (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between px-4 py-3 border-b border-accent-blue/10 last:border-b-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {contact.headshot ? (
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                          <Headshot src={contact.headshot} alt={name} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {name}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                          {email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              {email}
                            </span>
                          )}
                          {formattedPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              {formattedPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onEditMainContact}
                        className="h-8 px-2 text-xs text-accent-blue hover:text-accent-blue/80 hover:bg-accent-blue/10 rounded-md"
                        title="Edit main contact"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteContact(contact.id, e)}
                        className="h-8 w-8 p-0 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={`Delete ${name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Benefit Categories Section Header */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Benefit Contacts
            </span>
          </div>
          {/* Star icon legend */}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>= Primary Contact per category</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Click a category to add or manage contacts for specific benefits.
        </p>
      </div>

      {/* Expandable Category Rows */}
      <div className="w-full max-w-2xl space-y-2">
        {BENEFIT_CATEGORIES.map((category) => {
          const count = getCategoryStatus(category);
          const isCovered = count > 0;
          const isExpanded = expandedCategory === category;
          const categoryContacts = getContactsForCategory(category);
          const displayLabel =
            category === "Other Benefits" ? "Other Benefits" : category;

          return (
            <div
              key={category}
              className={cn(
                "rounded-lg border overflow-hidden transition-all duration-200",
                isExpanded
                  ? "border-accent-blue shadow-sm"
                  : isCovered
                    ? "border-green-200 dark:border-green-800"
                    : "border-gray-200 dark:border-gray-700",
              )}
            >
              {/* Category Header Row - clickable to expand */}
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
                  isExpanded
                    ? "bg-accent-blue/5"
                    : isCovered
                      ? "bg-green-50/50 dark:bg-green-900/10"
                      : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 flex items-center justify-center bg-transparent flex-shrink-0">
                    {(() => {
                      const IconComponent = CATEGORY_ICON[category];
                      return IconComponent ? (
                        <IconComponent className="w-6 h-6 text-accent-blue" />
                      ) : null;
                    })()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {displayLabel}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        isCovered && !hasPrimaryForCategory(category)
                          ? "text-amber-600 dark:text-amber-400"
                          : isCovered
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-400 dark:text-gray-500",
                      )}
                    >
                      {isCovered
                        ? hasPrimaryForCategory(category)
                          ? `${count} contact${count !== 1 ? "s" : ""}`
                          : `${count} contact${count !== 1 ? "s" : ""} — needs primary`
                        : "No contacts yet"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Add Contact Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCategorySelect(category);
                    }}
                    className="h-8 w-8 p-0 rounded-full text-accent-blue hover:text-accent-blue/80 hover:bg-accent-blue/10"
                    title={`Add ${displayLabel} contact`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>

                  {/* Expand/Collapse Chevron */}
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-gray-400 transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )}
                  />
                </div>
              </button>

              {/* Expanded Contact List */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {categoryContacts.length > 0 ? (
                    categoryContacts.map((contact: any) => {
                      const name = getContactDisplayName(contact);
                      const email = contact.email || "";
                      const phone = contact.phone || "";
                      const formattedPhone = phone
                        ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`
                        : "";

                      return (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {contact.headshot ? (
                              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                                <Headshot src={contact.headshot} alt={name} />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {name}
                              </span>
                              <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                                {email && (
                                  <span className="flex items-center gap-1 truncate">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    {email}
                                  </span>
                                )}
                                {formattedPhone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    {formattedPhone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {/* Primary checkbox for benefit categories only */}
                            {category !== "Company / Plan Sponsor" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetPrimary(contact.id, category);
                                }}
                                className={cn(
                                  "flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors",
                                  contact.isPrimaryOverall || contact.isPrimary
                                    ? "text-amber-500 hover:text-amber-600"
                                    : "text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-400",
                                )}
                                title={
                                  contact.isPrimaryOverall || contact.isPrimary
                                    ? "Primary contact"
                                    : "Mark as primary"
                                }
                              >
                                <Star
                                  className={cn(
                                    "w-3.5 h-3.5",
                                    (contact.isPrimaryOverall || contact.isPrimary) && "fill-amber-500",
                                  )}
                                />
                              </button>
                            )}
                            {onEditContact && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditContact(category, contact);
                                }}
                                className="h-7 px-1.5 text-xs text-accent-blue hover:text-accent-blue/80 hover:bg-accent-blue/10 rounded-md"
                                title={`Edit ${name}`}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeleteContact(contact.id, e)}
                              className="h-7 w-7 p-0 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title={`Delete ${name}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-4 text-center bg-white dark:bg-gray-800">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        No contacts added yet.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 w-full max-w-md pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          className="flex items-center gap-2 bg-accent-blue dark:bg-accent-blue hover:bg-accent-blue/90 text-white"
          disabled={!hasMinimumContacts}
        >
          {allCategoriesCovered ? "Review Team" : "Continue to Preview"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
