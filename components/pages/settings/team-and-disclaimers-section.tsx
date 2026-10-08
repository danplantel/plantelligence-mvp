"use client";

import { useState, type Ref } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import {
  DisclaimersSettingsSection,
  type DisclaimersSettingsSectionHandle,
} from "@/components/pages/settings/disclaimers-settings-section";
import { DisclaimerLedger } from "@/components/pages/settings/disclaimer-ledger";

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
  // Bumped after a save/attestation so the ledger re-reads the new revision.
  const [ledgerKey, setLedgerKey] = useState(0);

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-blue" />
                Disclosures
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1 text-muted-foreground">
                Manage compliance disclosures
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
              onSaved={() => setLedgerKey((key) => key + 1)}
            />
          )}
        </CardContent>
      </Card>

      {/* Read-only revision history, refreshed after each save/attestation. */}
      <DisclaimerLedger key={ledgerKey} />
    </>
  );
}
