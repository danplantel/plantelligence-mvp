"use client";

import { RefObject } from "react";
import { Download, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketingFlyerPreview } from "./flyer-preview";
import type { FlyerFields } from "../shared/types";

type MarketingPreviewPanelProps = {
  form: FlyerFields;
  previewRef: RefObject<HTMLDivElement>;
  heroImage?: string;
  sponsorLogoUrl?: string;
  advisorLogoUrl?: string;
  onGeneratePdf: () => void;
  onSaveToClient?: () => void;
  onLanguageChange: (language: "English" | "Spanish") => void;
  isSaving?: boolean;
};

export function MarketingPreviewPanel({
  form,
  previewRef,
  heroImage,
  sponsorLogoUrl,
  advisorLogoUrl,
  onGeneratePdf,
  onSaveToClient,
  onLanguageChange,
  isSaving = false,
}: MarketingPreviewPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Left-hand changes render instantly.
            </p>
          </div>
          <div className="flex gap-2">
            <Tabs
              value={form.language ?? "English"}
              onValueChange={(value) =>
                onLanguageChange(value as "English" | "Spanish")
              }
            >
              <TabsList>
                <TabsTrigger value="English">English</TabsTrigger>
                <TabsTrigger value="Spanish">Español</TabsTrigger>
              </TabsList>
            </Tabs>
            {onSaveToClient && (
              <Button
                onClick={onSaveToClient}
                variant="default"
                disabled={!form.planId || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                {isSaving ? "Saving..." : "Save to Client"}
              </Button>
            )}
            <Button onClick={onGeneratePdf}>
              <Download className="mr-2 size-4" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MarketingFlyerPreview
            ref={previewRef}
            form={form}
            heroImage={heroImage}
            sponsorLogoUrl={sponsorLogoUrl}
            advisorLogoUrl={advisorLogoUrl}
            language={form.language}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Downloads</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every export matches the preview pixel-for-pixel.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-slate-900">
                {form.planName || "Marketing Poster"}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF includes hero, messaging, and QR section.
              </p>
            </div>
            <Button size="sm" onClick={onGeneratePdf}>
              Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
