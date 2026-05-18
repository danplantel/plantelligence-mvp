"use client";

import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SummarySuccessBlock() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 bg-[#00A63E]/10 rounded-full p-3">
            <CheckCircle className="size-6 text-[#00A63E]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[#00A63E] mb-1">
              Setup Complete!
            </h3>
            <p className="text-sm text-muted-foreground">
              Your PlanTelligence advisor account has been successfully
              configured.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
