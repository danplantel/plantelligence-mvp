"use client";

import { useState, useEffect } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Info, Building2 } from "lucide-react";
import {
  EmployerScopeSectionProps,
  onScopeChangeInternal,
} from "./employer-scope-section.funcs";

export function EmployerScopeSection({
  onScopeChange: onScopeChangeProp,
}: EmployerScopeSectionProps) {
  const { stepData } = useOnboardingWizardStore();

  // Employer Scope state
  const [servesMultipleEmployers, setServesMultipleEmployers] = useState(
    stepData.employerScope?.servesMultipleEmployers || false,
  );

  // Update state when stepData changes (when data is loaded from server)
  useEffect(() => {
    if (stepData.employerScope) {
      setServesMultipleEmployers(
        stepData.employerScope.servesMultipleEmployers || false,
      );
    }
  }, [stepData.employerScope]);

  const onScopeChange = (value: boolean) => {
    onScopeChangeInternal(value, setServesMultipleEmployers, onScopeChangeProp);
  };

  return (
    <TooltipProvider>
      <Card className="shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-blue" />
              Employer Scope
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="size-6 text-accent-blue" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Choose your employer structure</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-muted-foreground font-light">
            Do you serve multiple employers?
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={servesMultipleEmployers ? "yes" : "no"}
            onValueChange={(value) => onScopeChange(value === "yes")}
            className="grid gap-3"
          >
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                servesMultipleEmployers
                  ? "border-primary bg-[#23919C]/10"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => onScopeChange(true)}
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="yes" id="scope-yes" />
                <div>
                  <Label
                    htmlFor="scope-yes"
                    className="cursor-pointer font-medium"
                  >
                    <p className="text-lg font-light">Yes</p>
                  </Label>
                  <div className="text-sm text-muted-foreground">
                    Enable multi-portal structure
                  </div>
                </div>
              </div>
            </div>
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                !servesMultipleEmployers
                  ? "border-primary bg-[#23919C]/10"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => onScopeChange(false)}
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="no" id="scope-no" />
                <div>
                  <Label
                    htmlFor="scope-no"
                    className="cursor-pointer font-medium"
                  >
                    <p className="text-lg font-light">No</p>
                  </Label>
                  <div className="text-sm text-muted-foreground">
                    Single employer setup
                  </div>
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
