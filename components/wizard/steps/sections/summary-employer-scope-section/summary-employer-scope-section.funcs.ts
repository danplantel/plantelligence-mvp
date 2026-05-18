export interface SummaryEmployerScopeSectionProps {
  servesMultipleEmployers?: boolean;
  teamMembersCount?: number;
}

export const getEmployerScopeLabel = (servesMultipleEmployers?: boolean) => {
  return servesMultipleEmployers
    ? "Multi-Portal Structure"
    : "Single Employer Setup";
};

export const getTeamMembersLabel = (count: number) => {
  return `${count} team member(s) added`;
};
