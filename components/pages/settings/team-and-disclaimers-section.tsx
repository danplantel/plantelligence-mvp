"use client";

import { useState, type Ref } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import {
  DisclaimersSettingsSection,
  type DisclaimersSettingsSectionHandle,
} from "@/components/pages/settings/disclaimers-settings-section";
import { DisclaimerLedger } from "@/components/pages/settings/disclaimer-ledger";

interface TeamAndDisclaimersSectionProps {
  /**
   * No `isLoading` any more: `DisclaimersSettingsSection` owns its own read and its own
   * skeleton, so it must MOUNT immediately rather than wait for the page's profile read. The
   * Organization tab is force-mounted by Settings, which means that read starts alongside the
   * page's initial load instead of when the tab is first opened.
   */
  disclaimersRef?: Ref<DisclaimersSettingsSectionHandle>;
  onDisclaimersDirtyChange?: (dirty: boolean) => void;
}

export function TeamAndDisclaimersSection({
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
          {/* Mounted unconditionally: the section fetches /api/profile itself and renders its
              own skeleton while that read is in flight. Gating it on the page's `isLoading`
              delayed the mount — and therefore the fetch — until the page had finished, which
              is what made the Disclosures skeleton show up when the tab was opened. */}
          <DisclaimersSettingsSection
            ref={disclaimersRef}
            onDirtyChange={onDisclaimersDirtyChange}
            onSaved={() => setLedgerKey((key) => key + 1)}
          />
        </CardContent>
      </Card>

      {/* Read-only revision history, refreshed after each save/attestation. */}
      <DisclaimerLedger key={ledgerKey} />
    </>
  );
}
