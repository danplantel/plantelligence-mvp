"use client";

import { useState } from "react";
import { MarketingPdfBuilderPage } from "@/components/pages/marketing/pdf-builder/page";
import { MarketingSpanishPdfBuilderPage } from "@/components/pages/marketing/meeting-flyer/page";
import { MarketingMissingRetirementBuilderPage } from "@/components/pages/marketing/missing-retirement/page";
import { MarketingPdfManagerPage } from "@/components/pages/marketing/pdf-manager/page";
import { MarketingFlyerGeneratorPage } from "@/components/pages/marketing/flyer-generator/page";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function MarketingPage() {
  const { setTitle } = usePageTitleContext();
  const [activeTab, setActiveTab] = useState("pdf-builder");

  useEffect(() => {
    setTitle("Marketing");
  }, [setTitle]);

  return (
    <div className="space-y-6 px-6 py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pdf-builder">PDF Builder</TabsTrigger>
          <TabsTrigger value="spanish-pdf-builder">Meeting Flyer</TabsTrigger>
          <TabsTrigger value="missing-retirement">
            Missing Retirement
          </TabsTrigger>
          <TabsTrigger value="flyer-generator">Hub flyers</TabsTrigger>
          <TabsTrigger value="pdf-manager">Manage PDFs</TabsTrigger>
        </TabsList>

        <TabsContent value="pdf-builder" className="mt-6">
          <MarketingPdfBuilderPage />
        </TabsContent>

        <TabsContent value="spanish-pdf-builder" className="mt-6">
          <MarketingSpanishPdfBuilderPage />
        </TabsContent>

        <TabsContent value="missing-retirement" className="mt-6">
          <MarketingMissingRetirementBuilderPage />
        </TabsContent>

        <TabsContent value="flyer-generator" className="mt-6">
          <MarketingFlyerGeneratorPage />
        </TabsContent>

        <TabsContent value="pdf-manager" className="mt-6">
          <MarketingPdfManagerPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
