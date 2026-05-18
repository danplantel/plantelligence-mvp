"use client";

import { Users } from "lucide-react";
import {
  SummaryEmployerScopeSectionProps,
  getEmployerScopeLabel,
  getTeamMembersLabel,
} from "./summary-employer-scope-section.funcs";

export function SummaryEmployerScopeSection({
  servesMultipleEmployers,
  teamMembersCount = 0,
}: SummaryEmployerScopeSectionProps) {
  return (
    <div className="space-y-4 pl-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Employer Scope</h3>
      </div>
      <div>
        <label className="text-base font-medium text-muted-foreground">
          Employer Scope
        </label>
        <p className="text-sm">
          {getEmployerScopeLabel(servesMultipleEmployers)}
        </p>
      </div>
      <div>
        <label className="text-base font-medium text-muted-foreground">
          Team Members
        </label>
        <p className="text-sm">{getTeamMembersLabel(teamMembersCount)}</p>
      </div>
    </div>
  );
}
