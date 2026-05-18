import { step2ServiceTypeToCategory } from "@/lib/service-categories";

export interface SummaryServicesSectionProps {
  services?: string[];
  customService?: string;
  insuranceLicensing?: {
    offersInsurance: boolean;
    licenses?: any[];
  };
}

/** Same labels as Step 2 and Settings (Primary Service Categories). */
export const getServiceLabels = (services: string[]) =>
  services.map((s) => step2ServiceTypeToCategory(s) || s);
