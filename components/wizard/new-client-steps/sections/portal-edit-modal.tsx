"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadInput } from "@/components/ui/upload-input";
import { CompanyData } from "@/types/new-client-wizard";
import {
  Edit,
  Palette,
  Type,
  Building,
  Globe,
  Calendar,
  Image,
} from "lucide-react";

interface PortalEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CompanyData>) => void;
  onLogoFileUpload?: (file: File) => void;
  onLogoFileRemove?: () => void;
  onBackgroundImgUpload?: (file: File) => void;
  onBackgroundImgRemove?: () => void;
  companyData: CompanyData;
}

export function PortalEditModal({
  isOpen,
  onClose,
  onSave,
  onLogoFileUpload,
  onLogoFileRemove,
  onBackgroundImgUpload,
  onBackgroundImgRemove,
  companyData,
}: PortalEditModalProps) {
  const [editData, setEditData] = useState<Partial<CompanyData>>({
    companyName: companyData.companyName || "",
    companyWebsite: companyData.companyWebsite || "",
    appointmentLink: companyData.appointmentLink || "",
    missionHeadline: companyData.missionHeadline || "",
    missionBody: companyData.missionBody || "",
    brandColor: companyData.brandColor || "#1F3A60",
    secondaryColor: companyData.secondaryColor || "#6B7280",
    companyLogo: companyData.companyLogo || "",
    logoFileName: companyData.logoFileName || "",
    backgroundImg: companyData.backgroundImg || "",
    backgroundImgName: companyData.backgroundImgName || "",
  });

  const handleSave = () => {
    onSave(editData);
    onClose();
  };

  const handleCancel = () => {
    // Reset to original data
    setEditData({
      companyName: companyData.companyName || "",
      companyWebsite: companyData.companyWebsite || "",
      appointmentLink: companyData.appointmentLink || "",
      missionHeadline: companyData.missionHeadline || "",
      missionBody: companyData.missionBody || "",
      brandColor: companyData.brandColor || "#1F3A60",
      secondaryColor: companyData.secondaryColor || "#6B7280",
      companyLogo: companyData.companyLogo || "",
      logoFileName: companyData.logoFileName || "",
      backgroundImg: companyData.backgroundImg || "",
      backgroundImgName: companyData.backgroundImgName || "",
    });
    onClose();
  };

  const updateField = (field: keyof CompanyData, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLogoFileUpload) {
      onLogoFileUpload(file);
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onBackgroundImgUpload) {
      onBackgroundImgUpload(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="size-5" />
            Edit Portal Content
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building className="size-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Type className="size-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="colors" className="flex items-center gap-2">
              <Palette className="size-4" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center gap-2">
              <Image className="size-4" />
              Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={editData.companyName || ""}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <Label htmlFor="companyWebsite">Company Website *</Label>
                <Input
                  id="companyWebsite"
                  value={editData.companyWebsite || ""}
                  onChange={(e) =>
                    updateField("companyWebsite", e.target.value)
                  }
                  placeholder="example.com, www.example.com, or https://example.com"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="appointmentLink">
                  Appointment Scheduling *
                </Label>
                <Input
                  id="appointmentLink"
                  value={editData.appointmentLink || ""}
                  onChange={(e) =>
                    updateField("appointmentLink", e.target.value)
                  }
                  placeholder="Enter email or scheduling URL"
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  Enter an email address or scheduling URL for plan participants
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="missionHeadline">
                  Benefits Hub Welcome Statement Headline *
                </Label>
                <Input
                  id="missionHeadline"
                  value={editData.missionHeadline || ""}
                  onChange={(e) =>
                    updateField("missionHeadline", e.target.value)
                  }
                  placeholder="We care about people. We value teamwork. We deliver results."
                  maxLength={60}
                />
                <div className="flex justify-end">
                  <span className="mt-1 text-[14px] text-gray-500">
                    {(editData.missionHeadline || "").length}/60
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="missionBody">
                  Benefits Hub Welcome Statement Body *
                </Label>
                <Textarea
                  id="missionBody"
                  value={editData.missionBody || ""}
                  onChange={(e) => updateField("missionBody", e.target.value)}
                  placeholder="At <COMPANY_NAME>, this employee benefits portal..."
                  rows={4}
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  (you can customize your message here as needed. Click on Ai
                  Assistant below to generate a custom message from plan sponsor
                  website.)
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="colors" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="brandColor">Brand Color *</Label>
                <div className="flex items-center space-x-3">
                  <input
                    id="brandColor"
                    type="color"
                    value={editData.brandColor || "#1F3A60"}
                    onChange={(e) => updateField("brandColor", e.target.value)}
                    className="w-9 h-9 border border-gray-300 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={editData.brandColor || "#1F3A60"}
                    onChange={(e) => updateField("brandColor", e.target.value)}
                    placeholder="#1F3A60"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondaryColor">Secondary Color *</Label>
                <div className="flex items-center space-x-3">
                  <input
                    id="secondaryColor"
                    type="color"
                    value={editData.secondaryColor || "#6B7280"}
                    onChange={(e) =>
                      updateField("secondaryColor", e.target.value)
                    }
                    className="w-9 h-9 border border-gray-300 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={editData.secondaryColor || "#6B7280"}
                    onChange={(e) =>
                      updateField("secondaryColor", e.target.value)
                    }
                    placeholder="#6B7280"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Color Preview</h4>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: editData.brandColor }}
                    />
                    <span className="text-sm">Brand Color</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: editData.secondaryColor }}
                    />
                    <span className="text-sm">Secondary Color</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="companyLogo">Company Logo *</Label>
                <UploadInput
                  id="company-logo-upload"
                  value={editData.companyLogo || ""}
                  fileName={editData.logoFileName || ""}
                  onChange={handleLogoUpload}
                  onRemove={onLogoFileRemove || (() => {})}
                  placeholder="Upload Logo (2MB limit)"
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  Use a square logo. SVG recommended.
                </p>
              </div>

              <div>
                <Label htmlFor="backgroundImg">
                  Background Image (optional)
                </Label>
                <UploadInput
                  id="background-image-upload"
                  value={editData.backgroundImg || ""}
                  fileName={editData.backgroundImgName || ""}
                  accept=".png,.jpg,.jpeg"
                  onChange={handleBackgroundUpload}
                  onRemove={onBackgroundImgRemove || (() => {})}
                  placeholder="Upload Background (PNG, JPG, JPEG, 1920x1080px)"
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  Recommended dimensions: 1920x1080px. Supported formats: PNG,
                  JPG, JPEG. WebP is not supported.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
