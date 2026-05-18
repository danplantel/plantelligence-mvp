"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { ClientPortal } from "@/components/pages/client-portal/client-portal";
import {
  CompanyBasicsData,
  KeyContact,
  WelcomeStatementData,
} from "@/types/new-client-wizard";

interface EditClientPreviewProps {
  client: {
    companyName: string;
  };
  companyData: CompanyBasicsData;
  welcomeData: WelcomeStatementData;
  keyContacts: KeyContact[];
  onBackClick: () => void;
  onSave: () => void;
  saving: boolean;
}

export function EditClientPreview({
  client,
  companyData,
  welcomeData,
  keyContacts,
  onBackClick,
  onSave,
  saving,
}: EditClientPreviewProps) {
  return (
    <div className="min-h-screen">
      {/* Preview Header */}
      <div className="bg-white border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBackClick} className="p-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Client Portal Preview</h1>
              <p className="text-gray-600">{client.companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onBackClick}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Edit
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Client Portal Preview */}
      <div className="bg-gray-50 min-h-screen">
        <ClientPortal
          data={{
            companyData: {
              companyName: companyData.companyName,
              companyWebsite: companyData.companyWebsite,
              companyLogo: companyData.companyLogo?.url,
              brandColor: companyData.primaryColor,
              secondaryColor: companyData.secondaryColor,
              missionHeadline: (companyData as any).missionHeadline || "",
              missionBody: (companyData as any).missionBody || "",
              appointmentLink: companyData.appointmentLink,
              backgroundImg: companyData.brandImages.header?.url,
              backgroundImgName: companyData.brandImages.header?.fileName,
            },
            keyContacts: keyContacts,
          }}
          isPreview={true}
        />
      </div>
    </div>
  );
}
