"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Headshot } from "@/components/ui/headshot";
import { KeyContact } from "@/types/new-client-wizard";
import { Plus, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactListProps {
  contacts: KeyContact[];
  selectedContactId: string | null;
  onSelectContact: (contact: KeyContact) => void | Promise<void>;
  onDeleteContact: (contactId: string, e: React.MouseEvent) => void;
  onAddContact: () => void;
  validationAttempted?: boolean;
}

// Helper function to get initials
const getInitials = (contact: KeyContact): string => {
  if (contact.contactType === "individual") {
    const first = contact.firstName?.charAt(0).toUpperCase() || "";
    const last = contact.lastName?.charAt(0).toUpperCase() || "";
    return first + last || "NC";
  } else {
    const initials =
      contact.displayName
        ?.split(" ")
        .map((n) => n.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2) || "NC";
    return initials;
  }
};

// Helper function to get display name
const getDisplayName = (contact: KeyContact): string => {
  if (contact.contactType === "individual") {
    const name = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
    return name || "New Contact";
  } else {
    return contact.displayName || "New Contact";
  }
};

// Helper function to get role display
const getRoleDisplay = (contact: KeyContact): string => {
  // Use Benefits Category instead of role
  if (contact.benefitsCategory) {
    return contact.benefitsCategory;
  }
  if (contact.benefitsCategories && contact.benefitsCategories.length > 0) {
    return contact.benefitsCategories[0];
  }
  // Fallback to role if no benefits category is available
  if (contact.role === "Other" && contact.roleOther) {
    return contact.roleOther;
  }
  return contact.role || "";
};

// Helper function to check if contact is complete (has all required fields)
const isContactComplete = (contact: KeyContact): boolean => {
  // Check if benefitsCategories exist
  if (!contact.benefitsCategories || contact.benefitsCategories.length === 0) {
    return false;
  }

  // Check name based on contact type
  if (contact.contactType === "individual") {
    // Both firstName and lastName are required
    const hasFirstName = contact.firstName && contact.firstName.trim();
    const hasLastName = contact.lastName && contact.lastName.trim();
    if (!hasFirstName || !hasLastName) {
      return false;
    }
    // Check title for individual contacts
    if (!contact.title || !contact.title.trim()) {
      return false;
    }
  } else if (contact.contactType === "team_support") {
    if (!contact.displayName || !contact.displayName.trim()) {
      return false;
    }
  }

  // Check if both email and phone are provided (both are required)
  const hasEmail = contact.email && contact.email.trim();
  const hasPhone = contact.phone && contact.phone.trim();
  if (!hasEmail || !hasPhone) {
    return false;
  }

  // Validate email format (must contain @ and .)
  if (hasEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email.trim())) {
      return false;
    }
  }

  return true;
};

export function ContactList({
  contacts,
  selectedContactId,
  onSelectContact,
  onDeleteContact,
  onAddContact,
  validationAttempted = false,
}: ContactListProps) {
  return (
    <div className="space-y-2">
      {contacts.length > 0 ? (
        // Sort contacts: primary first, then others
        [...contacts]
          .sort((a, b) => {
            const aIsPrimary = a.isPrimaryOverall || a.isPrimary || false;
            const bIsPrimary = b.isPrimaryOverall || b.isPrimary || false;
            // Primary contacts come first
            if (aIsPrimary && !bIsPrimary) return -1;
            if (!aIsPrimary && bIsPrimary) return 1;
            return 0;
          })
          .map((contact, index) => {
            const initials = getInitials(contact);
            const displayName = getDisplayName(contact);
            const roleDisplay = getRoleDisplay(contact);

            // Generate color based on initials
            const colors = [
              "bg-accent-blue",
              "bg-green-500",
              "bg-purple-500",
              "bg-pink-500",
              "bg-indigo-500",
              "bg-yellow-500",
            ];
            const colorIndex =
              (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) %
              colors.length;
            const bgColor = colors[colorIndex];

            const isSelected = selectedContactId === contact.id;
            const contactNumber = index + 1;
            const isComplete = isContactComplete(contact);

            // Determine border and background colors
            // Incomplete contacts show red border only if validation was attempted
            // Complete contacts show blue if selected, gray if not selected
            const getCardStyles = () => {
              if (!isComplete && validationAttempted) {
                // Incomplete and validation attempted: red, more prominent if selected
                return isSelected
                  ? "ring-2 ring-red-500 border-red-500 bg-red-50/50 shadow-sm"
                  : "ring-2 ring-red-300 border-red-300 bg-red-50/40 hover:border-red-400 hover:ring-red-400 shadow-sm";
              }
              // Complete or validation not attempted: blue if selected, gray if not
              return isSelected
                ? "ring-2 ring-accent-blue border-accent-blue bg-accent-blue/5 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:bg-gray-800 dark:border-gray-600 dark:hover:border-gray-500";
            };

            return (
              <Card
                key={contact.id}
                className={cn(
                  "cursor-pointer transition-all group relative",
                  getCardStyles(),
                )}
                onClick={() => onSelectContact(contact)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Contact Number */}
                    <div
                      className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                        isSelected && !isComplete && validationAttempted
                          ? "bg-red-100 text-red-700"
                          : isSelected && isComplete
                            ? "bg-accent-blue/10 text-accent-blue"
                            : !isComplete && validationAttempted
                              ? "bg-red-100 text-red-600"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
                      )}
                    >
                      {contactNumber}
                    </div>
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden transition-opacity",
                        bgColor,
                        !isSelected && "opacity-80",
                      )}
                    >
                      {contact.headshot ? (
                        <Headshot src={contact.headshot} alt={displayName} />
                      ) : (
                        initials
                      )}
                    </div>
                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <h4
                        className={cn(
                          "font-semibold truncate",
                          isSelected ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300",
                        )}
                      >
                        {displayName}
                      </h4>
                      <p
                        className={cn(
                          "text-sm truncate",
                          isSelected ? "text-gray-600 dark:text-gray-400" : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        {roleDisplay}
                      </p>
                    </div>
                    {/* Delete Button - visible on hover */}
                    <button
                      onClick={(e) => onDeleteContact(contact.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-full text-red-500 hover:text-red-700 flex-shrink-0"
                      title="Delete contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {/* Arrow */}
                    <ChevronRight
                      className={cn(
                        "w-5 h-5 flex-shrink-0 transition-colors",
                        isSelected && !isComplete && validationAttempted
                          ? "text-red-500"
                          : isSelected && isComplete
                            ? "text-accent-blue"
                            : "text-gray-400",
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No saved contacts yet</p>
          <p className="text-xs mt-1">
            Fill in the form and click &quot;Save & Add Contact&quot; to save
          </p>
        </div>
      )}

      {/* Add Contact Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full mt-4"
        onClick={onAddContact}
      >
        <Plus className="w-4 h-4 mr-2" />
        Save & Add Contact
      </Button>
    </div>
  );
}
