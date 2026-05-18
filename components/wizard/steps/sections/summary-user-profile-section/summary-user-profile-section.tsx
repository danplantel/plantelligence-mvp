"use client";

import { Building2 } from "lucide-react";
import {
  SummaryUserProfileSectionProps,
  getOrganizationTypeLabel,
  getTeamSizeLabel,
} from "./summary-user-profile-section.funcs";

export function SummaryUserProfileSection({
  organizationType,
  customOrganization,
  teamSize,
}: SummaryUserProfileSectionProps) {
  return (
    <div className="space-y-3 px-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4" />
        <h3 className="text-base font-semibold">User Profile</h3>
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground">
          Organization Type
        </label>
        <p className="text-sm">
          {organizationType
            ? getOrganizationTypeLabel(organizationType)
            : "Not specified"}
          {customOrganization && (
            <span className="text-muted-foreground ml-2">
              ({customOrganization})
            </span>
          )}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground">
          Team Size
        </label>
        <p className="text-sm">
          {teamSize ? getTeamSizeLabel(teamSize) : "Not specified"}
        </p>
      </div>
    </div>
  );
}
