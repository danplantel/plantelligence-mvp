"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CompanyData } from "@/types/new-client-wizard";

interface MissionSectionProps {
  companyData: CompanyData;
  onDataChange: (field: keyof CompanyData, value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function MissionSection({
  companyData,
  onDataChange,
  isOpen,
  onToggle,
}: MissionSectionProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">
            Benefits Hub Welcome Statement
          </CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="missionHeadline" className="text-sm font-medium">
              Headline
            </Label>
            <Input
              id="missionHeadline"
              value={companyData.missionHeadline}
              onChange={(e) => onDataChange("missionHeadline", e.target.value)}
              placeholder="Enter mission headline"
              maxLength={60}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {companyData.missionHeadline.length}/60 characters
            </p>
          </div>

          <div>
            <Label htmlFor="missionBody" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="missionBody"
              value={companyData.missionBody}
              onChange={(e) => onDataChange("missionBody", e.target.value)}
              placeholder="Enter mission description"
              rows={4}
              className="mt-2"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
