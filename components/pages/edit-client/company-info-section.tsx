"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadInput } from "@/components/ui/upload-input";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CompanyBasicsData } from "@/types/new-client-wizard";

interface CompanyInfoSectionProps {
  companyData: CompanyBasicsData;
  onDataChange: (field: keyof CompanyBasicsData, value: any) => void;
  onFileUpload: (
    file: File,
    type:
      | "logo"
      | "background"
      | "header"
      | "thumbnail"
      | "secondaryBanner"
      | "favicon",
  ) => void;
  onFileRemove: (
    type:
      | "logo"
      | "background"
      | "header"
      | "thumbnail"
      | "secondaryBanner"
      | "favicon",
  ) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function CompanyInfoSection({
  companyData,
  onDataChange,
  onFileUpload,
  onFileRemove,
  isOpen,
  onToggle,
}: CompanyInfoSectionProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Company Information</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="companyName" className="text-sm font-medium">
                Company Name *
              </Label>
              <Input
                id="companyName"
                value={companyData.companyName}
                onChange={(e) => onDataChange("companyName", e.target.value)}
                placeholder="Enter company name"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="companyWebsite" className="text-sm font-medium">
                Company Website
              </Label>
              <Input
                id="companyWebsite"
                value={companyData.companyWebsite}
                onChange={(e) => onDataChange("companyWebsite", e.target.value)}
                placeholder="example.com"
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="brandColor" className="text-sm font-medium">
                Primary Color
              </Label>
              <div className="flex items-center gap-3 mt-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={companyData.primaryColor}
                  onChange={(e) => onDataChange("primaryColor", e.target.value)}
                  className="w-12 h-10 p-1 rounded border"
                />
                <Input
                  value={companyData.primaryColor}
                  onChange={(e) => onDataChange("primaryColor", e.target.value)}
                  placeholder="#1F3A60"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="secondaryColor" className="text-sm font-medium">
                Secondary Color
              </Label>
              <div className="flex items-center gap-3 mt-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={companyData.secondaryColor}
                  onChange={(e) =>
                    onDataChange("secondaryColor", e.target.value)
                  }
                  className="w-12 h-10 p-1 rounded border"
                />
                <Input
                  value={companyData.secondaryColor}
                  onChange={(e) =>
                    onDataChange("secondaryColor", e.target.value)
                  }
                  placeholder="#6B7280"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Company Logo</Label>
            <div className="mt-2">
              <UploadInput
                id="logo-upload"
                value={companyData.companyLogo?.url || ""}
                fileName={companyData.companyLogo?.fileName || ""}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file, "logo");
                }}
                onRemove={() => onFileRemove("logo")}
                placeholder="Upload Logo (2MB limit)"
                accept="image/*"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Use a square logo. SVG recommended.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">
              Background Header Image (Hero)
            </Label>
            <div className="mt-2">
              <UploadInput
                id="header-upload"
                value={companyData.brandImages?.header?.url || ""}
                fileName={companyData.brandImages?.header?.fileName || ""}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file, "header");
                }}
                onRemove={() => onFileRemove("header")}
                placeholder="Upload Header Image (5MB limit)"
                accept="image/*"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Recommended: 1920x1080px or higher
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Square Thumbnail</Label>
            <div className="mt-2">
              <UploadInput
                id="thumbnail-upload"
                value={companyData.brandImages?.thumbnail?.url || ""}
                fileName={companyData.brandImages?.thumbnail?.fileName || ""}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file, "thumbnail");
                }}
                onRemove={() => onFileRemove("thumbnail")}
                placeholder="Upload Thumbnail (2MB limit)"
                accept="image/*"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Recommended: 400x400px or higher
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Secondary Banner</Label>
            <div className="mt-2">
              <UploadInput
                id="secondary-banner-upload"
                value={companyData.brandImages?.secondaryBanner?.url || ""}
                fileName={
                  companyData.brandImages?.secondaryBanner?.fileName || ""
                }
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file, "secondaryBanner");
                }}
                onRemove={() => onFileRemove("secondaryBanner")}
                placeholder="Upload Secondary Banner (5MB limit)"
                accept="image/*"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Optional: Additional banner image
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Favicon</Label>
            <div className="mt-2">
              <UploadInput
                id="favicon-upload"
                value={companyData.brandImages?.favicon?.url || ""}
                fileName={companyData.brandImages?.favicon?.fileName || ""}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file, "favicon");
                }}
                onRemove={() => onFileRemove("favicon")}
                placeholder="Upload Favicon (1MB limit)"
                accept="image/*"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Recommended: 32x32px or 64x64px
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="appointmentLink" className="text-sm font-medium">
              Appointment Link
            </Label>
            <Input
              id="appointmentLink"
              value={companyData.appointmentLink}
              onChange={(e) => onDataChange("appointmentLink", e.target.value)}
              placeholder="Enter email or scheduling URL"
              className="mt-2"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
