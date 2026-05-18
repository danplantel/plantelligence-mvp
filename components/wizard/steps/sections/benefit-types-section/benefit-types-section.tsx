"use client";

import { BenefitType } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Heart } from "lucide-react";
import { benefitOptions } from "./benefit-types-section.funcs";

interface BenefitTypesSectionProps {
  selectedBenefits: BenefitType[];
  onBenefitToggle: (benefit: BenefitType) => void;
  isRetirementSelected?: boolean;
}

export function BenefitTypesSection({
  selectedBenefits,
  onBenefitToggle,
  isRetirementSelected = false,
}: BenefitTypesSectionProps) {
  return (
    <Card className="shadow-none h-full flex flex-col">
      <CardHeader className="space-y-4">
        <div className="flex justify-between items-center gap-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <Heart className="w-5 h-5 text-accent-blue" />
            Benefit Types
          </CardTitle>
          <Tooltip>
            <TooltipTrigger>
              <Info className="size-6 text-accent-blue" />
            </TooltipTrigger>
            <TooltipContent>
              <p>What benefit types do you support?</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-muted-foreground font-light">
          What benefit types do you support?
        </p>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <div className="grid grid-cols-2 gap-3">
          {benefitOptions.map((option) => {
            const is401k = option.value === "401k";
            const isDisabled = is401k && isRetirementSelected;

            return (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`benefit-${option.value}`}
                  checked={selectedBenefits.includes(option.value)}
                  onCheckedChange={() => onBenefitToggle(option.value)}
                  disabled={isDisabled}
                />
                <label
                  htmlFor={`benefit-${option.value}`}
                  className={`cursor-pointer ${
                    isDisabled ? "text-muted-foreground" : ""
                  }`}
                >
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
