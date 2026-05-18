export interface SummaryUserProfileSectionProps {
  organizationType?: string;
  customOrganization?: string;
  teamSize?: string;
}

export const getOrganizationTypeLabel = (type: string) => {
  const types = {
    INDEPENDENT: "Independent Advisor",
    RIA: "RIA or Boutique Firm",
    HYBRID: "Hybrid Wealth & Insurance Firm",
    BROKER: "Broker-Dealer / Aggregator",
    INSURANCE: "Insurance Agency / IMO",
    RECORDKEEPER: "Recordkeeper / TPA / Partner",
    OTHER: "Other",
  };
  return types[type as keyof typeof types] || type;
};

export const getTeamSizeLabel = (size: string) => {
  const sizes = {
    just_me: "Just me",
    "2_5": "2–5",
    "6_20": "6–20",
    enterprise: "21+",
  };
  return sizes[size as keyof typeof sizes] || size;
};
