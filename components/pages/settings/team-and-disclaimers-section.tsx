"use client";

import type { Ref } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import {
  DisclaimersSettingsSection,
  type DisclaimersSettingsSectionHandle,
} from "@/components/pages/settings/disclaimers-settings-section";

interface TeamAndDisclaimersSectionProps {
  isLoading: boolean;
  disclaimersRef?: Ref<DisclaimersSettingsSectionHandle>;
  onDisclaimersDirtyChange?: (dirty: boolean) => void;
}

export function TeamAndDisclaimersSection({
  isLoading,
  disclaimersRef,
  onDisclaimersDirtyChange,
}: TeamAndDisclaimersSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent-blue" />
              Disclaimers
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1 text-muted-foreground">
              Manage compliance disclaimers
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <DisclaimersSettingsSection
            ref={disclaimersRef}
            onDirtyChange={onDisclaimersDirtyChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
