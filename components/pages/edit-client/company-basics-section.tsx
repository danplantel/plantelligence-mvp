"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown, ChevronUp, Building2, Palette } from "lucide-react";
import { CompanyBasicsData } from "@/types/new-client-wizard";
import { CompanyLogoSection } from "@/components/wizard/new-client-steps/sections/company-logo-section";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { ColorPicker } from "@/components/ui/color-picker";

interface CompanyBasicsSectionProps {
  companyData: CompanyBasicsData;
  onDataChange: (field: keyof CompanyBasicsData, value: any) => void;
  isOpen: boolean;
  onToggle: () => void;
  validationErrors?: Record<string, string[]>;
}

export function CompanyBasicsSection({
  companyData,
  onDataChange,
  isOpen,
  onToggle,
  validationErrors = {},
}: CompanyBasicsSectionProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Company Basics & Branding</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
          {/* Plan Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-blue" />
                Plan Type
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the type of plan you&apos;re creating
              </p>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={companyData.planType || "client"}
                onValueChange={(value) => onDataChange("planType", value)}
                className="grid gap-3"
              >
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    companyData.planType === "client" || !companyData.planType
                      ? "border-primary bg-[#23919C]/10"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => onDataChange("planType", "client")}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="client" id="plan-client" />
                    <div>
                      <Label
                        htmlFor="plan-client"
                        className="cursor-pointer font-medium"
                      >
                        <p className="text-sm font-medium">Client</p>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Active client with full access
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    companyData.planType === "prospect"
                      ? "border-primary bg-[#23919C]/10"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => onDataChange("planType", "prospect")}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="prospect" id="plan-prospect" />
                    <div>
                      <Label
                        htmlFor="plan-prospect"
                        className="cursor-pointer font-medium"
                      >
                        <p className="text-sm font-medium">Prospect</p>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Demo or draft plan for prospects
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-blue" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName" className="text-sm font-medium">
                    Company Name *
                  </Label>
                  <Input
                    id="companyName"
                    value={companyData.companyName}
                    onChange={(e) =>
                      onDataChange("companyName", e.target.value)
                    }
                    placeholder="Enter company name"
                    className={`mt-2 ${
                      validationErrors.companyName
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }`}
                  />
                  {validationErrors.companyName && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.companyName[0]}
                    </p>
                  )}
                </div>
                <div>
                  <Label
                    htmlFor="companyWebsite"
                    className="text-sm font-medium"
                  >
                    Company Website
                  </Label>
                  <Input
                    id="companyWebsite"
                    value={companyData.companyWebsite}
                    onChange={(e) =>
                      onDataChange("companyWebsite", e.target.value)
                    }
                    placeholder="example.com"
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brand Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent-blue" />
                Brand Colors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Color */}
                <div className="space-y-3 relative">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onDataChange(
                          "isPrimaryColorPickerOpen",
                          !companyData.isPrimaryColorPickerOpen,
                        )
                      }
                      className="h-10 px-3"
                    >
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ background: companyData.primaryColor }}
                      />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {companyData.primaryColor}
                    </span>
                  </div>
                  <ColorPicker
                    value={companyData.primaryColor}
                    onChange={(color) => onDataChange("primaryColor", color)}
                    isOpen={companyData.isPrimaryColorPickerOpen || false}
                    onOpenChange={(open) =>
                      onDataChange("isPrimaryColorPickerOpen", open || false)
                    }
                  />
                </div>

                {/* Secondary Color */}
                <div className="space-y-3 relative">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onDataChange(
                          "isSecondaryColorPickerOpen",
                          !companyData.isSecondaryColorPickerOpen,
                        )
                      }
                      className="h-10 px-3"
                    >
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ background: companyData.secondaryColor }}
                      />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {companyData.secondaryColor}
                    </span>
                  </div>
                  <ColorPicker
                    value={companyData.secondaryColor}
                    onChange={(color) => onDataChange("secondaryColor", color)}
                    isOpen={companyData.isSecondaryColorPickerOpen || false}
                    onOpenChange={(open) =>
                      onDataChange("isSecondaryColorPickerOpen", open || false)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Logo */}
          <CompanyLogoSection
            logoData={companyData.companyLogo}
            onLogoChange={(logoData) => onDataChange("companyLogo", logoData)}
            validationErrors={validationErrors.companyLogo}
          />

          {/* Brand Images */}
          <BrandImagesSection
            brandImages={companyData.brandImages}
            onBrandImagesChange={(brandImages) =>
              onDataChange("brandImages", brandImages)
            }
            validationErrors={validationErrors}
            logoUrl={companyData.companyLogo?.url}
            companyName={companyData.companyName}
          />
        </CardContent>
      )}
    </Card>
  );
}
