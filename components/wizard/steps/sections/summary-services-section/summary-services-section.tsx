"use client";

import { Briefcase } from "lucide-react";
import {
  SummaryServicesSectionProps,
  getServiceLabels,
} from "./summary-services-section.funcs";

export function SummaryServicesSection({
  services,
  customService,
  insuranceLicensing,
}: SummaryServicesSectionProps) {
  return (
    <div className="space-y-3 px-4">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="w-4 h-4" />
        <h3 className="text-base font-semibold">Services Provided</h3>
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground">
          Services Offered
        </label>
        <p className="text-sm">
          {services?.length
            ? getServiceLabels(services).join(", ")
            : "No services selected"}
        </p>
        {customService && (
          <p className="text-sm text-muted-foreground mt-1">
            Custom: {customService}
          </p>
        )}
      </div>

      {insuranceLicensing?.offersInsurance && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Insurance Licensing
          </label>
          <p className="text-sm">
            {insuranceLicensing.licenses?.length || 0} license(s) added
          </p>
        </div>
      )}
    </div>
  );
}
