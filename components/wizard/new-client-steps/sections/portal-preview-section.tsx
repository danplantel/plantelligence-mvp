"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { ClientPortal } from "@/components/pages/client-portal/client-portal";
import { PortalEditModal } from "./portal-edit-modal";
import { Edit } from "lucide-react";

export default function PortalPreviewSection() {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const portalData = {
    companyData: stepData?.clientInfo?.companyData,
    keyContacts: stepData?.clientInfo?.keyContacts || [],
  };

  const handleSaveEdit = async (updatedData: any) => {
    if (stepData?.clientInfo?.companyData) {
      const updatedCompanyData = {
        ...stepData.clientInfo.companyData,
        ...updatedData,
      };

      const updatedClientInfo = {
        ...stepData.clientInfo,
        companyData: updatedCompanyData,
      };

      await saveStepDataLocally("clientInfo", updatedClientInfo);
    }
  };

  const handleLogoFileUpload = async (file: File) => {
    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (stepData?.clientInfo?.companyData) {
        const updatedCompanyData = {
          ...stepData.clientInfo.companyData,
          companyLogo: base64,
          logoFileName: file.name,
        };

        const updatedClientInfo = {
          ...stepData.clientInfo,
          companyData: updatedCompanyData,
        };

        await saveStepDataLocally("clientInfo", updatedClientInfo);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileRemove = async () => {
    if (stepData?.clientInfo?.companyData) {
      const updatedCompanyData = {
        ...stepData.clientInfo.companyData,
        companyLogo: "",
        logoFileName: "",
      };

      const updatedClientInfo = {
        ...stepData.clientInfo,
        companyData: updatedCompanyData,
      };

      await saveStepDataLocally("clientInfo", updatedClientInfo);
    }
  };

  const handleBackgroundImgUpload = async (file: File) => {
    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (stepData?.clientInfo?.companyData) {
        const updatedCompanyData = {
          ...stepData.clientInfo.companyData,
          backgroundImg: base64,
          backgroundImgName: file.name,
        };

        const updatedClientInfo = {
          ...stepData.clientInfo,
          companyData: updatedCompanyData,
        };

        await saveStepDataLocally("clientInfo", updatedClientInfo);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundImgRemove = async () => {
    if (stepData?.clientInfo?.companyData) {
      const updatedCompanyData = {
        ...stepData.clientInfo.companyData,
        backgroundImg: "",
        backgroundImgName: "",
      };

      const updatedClientInfo = {
        ...stepData.clientInfo,
        companyData: updatedCompanyData,
      };

      await saveStepDataLocally("clientInfo", updatedClientInfo);
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Portal Preview</CardTitle>
            <CardDescription>
              This is how your client&apos;s portal will look to participants
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Edit className="size-4" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <div className="h-screen overflow-y-auto">
        <ClientPortal data={portalData} isPreview={true} />
      </div>

      <PortalEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEdit}
        onLogoFileUpload={handleLogoFileUpload}
        onLogoFileRemove={handleLogoFileRemove}
        onBackgroundImgUpload={handleBackgroundImgUpload}
        onBackgroundImgRemove={handleBackgroundImgRemove}
        companyData={
          stepData?.clientInfo?.companyData || {
            companyName: "",
            companyWebsite: "",
            companyLogo: "",
            logoFileName: "",
            brandColor: "#1F3A60",
            secondaryColor: "#6B7280",
            missionHeadline: "",
            missionBody: "",
            appointmentLink: "",
            backgroundImg: "",
            backgroundImgName: "",
          }
        }
      />
    </Card>
  );
}
