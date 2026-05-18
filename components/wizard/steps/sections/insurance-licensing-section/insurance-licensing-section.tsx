"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface InsuranceLicensingSectionProps {
  offersInsurance: boolean;
  onInsuranceToggle: (value: boolean) => void;
}

export function InsuranceLicensingSection({
  offersInsurance,
  onInsuranceToggle,
}: InsuranceLicensingSectionProps) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex justify-between items-center gap-2">
          <CardTitle className="text-xl">Insurance Licensing</CardTitle>
          <Tooltip>
            <TooltipTrigger>
              <Info className="size-6 text-accent-blue" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Required if you offer insurance products</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-muted-foreground font-light">
          Do you offer insurance products (e.g., life, health, or group
          benefits)?
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={offersInsurance ? "yes" : "no"}
          onValueChange={(value) => onInsuranceToggle(value === "yes")}
          className="grid gap-3"
        >
          <div
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              offersInsurance === true
                ? "border-primary bg-[#23919C]/10"
                : "hover:bg-muted/50"
            }`}
            onClick={() => onInsuranceToggle(true)}
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="yes" id="yes" />
              <Label
                htmlFor="yes"
                className="cursor-pointer text-base font-medium"
              >
                Yes
              </Label>
            </div>
          </div>
          <div
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              offersInsurance === false
                ? "border-primary bg-[#23919C]/10"
                : "hover:bg-muted/50"
            }`}
            onClick={() => onInsuranceToggle(false)}
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="no" id="no" />
              <Label
                htmlFor="no"
                className="cursor-pointer text-base font-medium"
              >
                No
              </Label>
            </div>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
