"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UploadInput } from "@/components/ui/upload-input";
import { Sparkles } from "lucide-react";
import { CompanyData } from "@/types/new-client-wizard";
import { Button } from "@/components/ui/button";

interface CompanyInformationSectionProps {
  data: CompanyData;
  appointmentType: "email" | "url" | "invalid" | "";
  onDataChange: (field: keyof CompanyData, value: any) => void;
  onLogoFileUpload: (file: File) => void;
  onLogoFileRemove: () => void;
  onBackgroundImgUpload: (file: File) => void;
  onBackgroundImgRemove: () => void;
}

export function CompanyInformationSection({
  data,
  appointmentType,
  onDataChange,
  onLogoFileUpload,
  onLogoFileRemove,
  onBackgroundImgUpload,
  onBackgroundImgRemove,
}: CompanyInformationSectionProps) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">Company Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Company Name */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Company Name *
              </label>
              <Input
                value={data.companyName}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 65);
                  onDataChange("companyName", value);
                }}
                placeholder="Enter company name"
                maxLength={65}
              />
            </div>

            {/* Company Website */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Company website *
              </label>
              <Input
                value={data.companyWebsite}
                onChange={(e) => onDataChange("companyWebsite", e.target.value)}
                placeholder="example.com, www.example.com, or https://example.com"
              />
            </div>

            {/* Company Logo */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Company Logo *
              </label>
              <UploadInput
                id="company-logo-upload"
                value={data.companyLogo}
                fileName={data.logoFileName}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLogoFileUpload(file);
                }}
                onRemove={onLogoFileRemove}
                placeholder="Upload Logo (2MB limit)"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Use a square logo. SVG recommended.
              </p>
            </div>

            {/* Appointment Scheduling */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                How do plan participants schedule an appointment? *
              </label>
              <Input
                type="text"
                value={data.appointmentLink}
                onChange={(e) =>
                  onDataChange("appointmentLink", e.target.value)
                }
                placeholder="Enter email or scheduling URL"
              />
              {appointmentType === "invalid" && (
                <p className="mt-1 text-red-500 text-xs">
                  Please enter a valid email or scheduling URL.
                </p>
              )}

              {appointmentType === "email" && (
                <p className="mt-1 text-green-600 text-xs">
                  Email detected — we will generate a scheduling form.
                </p>
              )}

              {appointmentType === "url" && (
                <p className="mt-1 text-green-600 text-xs">
                  URL detected — we will use this scheduling link.
                </p>
              )}
            </div>

            {/* Background Image */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Background image (optional)
              </label>
              <UploadInput
                id="background-image-upload"
                value={data.backgroundImg}
                fileName={data.backgroundImgName}
                accept=".png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) onBackgroundImgUpload(file);
                }}
                onRemove={onBackgroundImgRemove}
                placeholder="Upload Background (PNG, JPG, JPEG, 1920x1080px)"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Recommended dimensions: 1920x1080px. Supported formats: PNG,
                JPG, JPEG. WebP is not supported.
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Brand Color */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Brand color *
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={data.brandColor}
                  onChange={(e) => onDataChange("brandColor", e.target.value)}
                  className="w-9 h-9 border border-gray-300 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={data.brandColor}
                  onChange={(e) => onDataChange("brandColor", e.target.value)}
                  placeholder="#1F3A60"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Secondary color *
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={data.secondaryColor}
                  onChange={(e) =>
                    onDataChange("secondaryColor", e.target.value)
                  }
                  className="w-9 h-9 border border-gray-300 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={data.secondaryColor}
                  onChange={(e) =>
                    onDataChange("secondaryColor", e.target.value)
                  }
                  placeholder="#6B7280"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Welcome Statement Headline */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Benefits Hub Welcome Statement Headline *
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                This message introduces your firm to employers and participants
                via the branded benefits hub. Keep it clear, welcoming, and
                aligned with your brand voice
              </p>
              <Input
                value={data.missionHeadline}
                onChange={(e) =>
                  onDataChange("missionHeadline", e.target.value)
                }
                placeholder="We care about people. We value teamwork. We deliver results."
                maxLength={60}
              />
              <div className="flex justify-end">
                <span className="mt-1 text-[14px] text-gray-500">
                  {data.missionHeadline.length}/60
                </span>
              </div>
            </div>

            {/* Welcome Statement Body */}
            <div>
              <label className="block mb-2 font-medium text-sm">
                Benefits Hub Welcome Statement Body *
              </label>
              <Textarea
                value={data.missionBody}
                onChange={(e) => onDataChange("missionBody", e.target.value)}
                placeholder="At <COMPANY_NAME>, this employee benefits portal..."
                className="min-h-[120px]"
              />
              <p className="mt-1 text-muted-foreground text-xs">
                (you can customize your message here as needed. Click on Ai
                Assistant below to generate a custom message from plan sponsor
                website.)
              </p>
            </div>

            {/* AI Assistant button */}
            <div>
              <Button onClick={() => {}} className="w-auto h-10 px-4">
                <Sparkles className="mr-2 w-4 h-4" />
                AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
