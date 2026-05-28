"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LargeHorizontalCard } from "@/components/pages/my-benefits-team/large-horizontal-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";

interface CardPreviewSectionProps {
  cardDisplayMode: "large-horizontal" | "small-vertical";
  onCardDisplayModeChange: (
    mode: "large-horizontal" | "small-vertical",
  ) => void;
  previewContact: KeyContact & {
    logo?: string;
    displayScheduleAppointment?: boolean;
  };
  primaryColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  displayEmail: boolean;
  displayPhone: boolean;
  displayScheduleAppointment: boolean;
  displayWebsite: boolean;
  email: string;
  phone: string;
  websiteUrl: string;
}

export function CardPreviewSection({
  cardDisplayMode,
  onCardDisplayModeChange,
  previewContact,
  primaryColor,
  secondaryColor,
  appointmentLink,
  companyName,
  displayEmail,
  displayPhone,
  displayScheduleAppointment,
  displayWebsite,
  email,
  phone,
  websiteUrl,
}: CardPreviewSectionProps) {
  return (
    <>
      {/* Card Display Mode Selection */}
      <div className="space-y-2 border-t pt-4 dark:border-gray-700">
        <Label className="text-sm font-medium dark:text-gray-300">Card Display Mode</Label>
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant={
              cardDisplayMode === "large-horizontal" ? "default" : "outline"
            }
            onClick={() => onCardDisplayModeChange("large-horizontal")}
            className={cn(
              "flex items-center justify-center gap-2 h-auto py-3 flex-1",
              cardDisplayMode === "large-horizontal"
                ? "bg-accent-blue text-white hover:opacity-90"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
            )}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-accent-blue/20 rounded"></div>
              <span>Large Horizontal</span>
            </div>
          </Button>
          <Button
            type="button"
            variant={
              cardDisplayMode === "small-vertical" ? "default" : "outline"
            }
            onClick={() => onCardDisplayModeChange("small-vertical")}
            className={cn(
              "flex items-center justify-center gap-2 h-auto py-3 flex-1",
              cardDisplayMode === "small-vertical"
                ? "bg-accent-blue text-white hover:opacity-90"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
            )}
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-6 bg-green-200 rounded"></div>
              <span>Small Vertical</span>
            </div>
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      <h4 className="text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Live Preview</h4>
      <div className="relative flex items-center justify-center mb-3">
        {cardDisplayMode === "large-horizontal" ? (
          <LargeHorizontalCard
            key={`preview-${displayEmail}-${displayPhone}-${displayScheduleAppointment}-${displayWebsite}-${email}-${phone}-${websiteUrl}`}
            contact={previewContact as any}
            brandColor={primaryColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={0}
            disableAnimation={true}
          />
        ) : (
          <SmallVerticalCard
            key={`preview-${displayEmail}-${displayPhone}-${displayScheduleAppointment}-${displayWebsite}-${email}-${phone}-${websiteUrl}`}
            contact={previewContact as any}
            brandColor={primaryColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={0}
            disableAnimation={true}
          />
        )}
      </div>
    </>
  );
}
