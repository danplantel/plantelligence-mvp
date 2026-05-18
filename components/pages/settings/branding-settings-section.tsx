"use client";

import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Palette } from "lucide-react";
import { BrandingSetupCard } from "@/components/wizard/steps/sections/branding-setup-card/branding-setup-card";

interface BrandingSettingsSectionProps {
  isLoading: boolean;
  isSaving: boolean;
  brandingForm: any;
  formKey: number;
  onSave: () => Promise<void> | void;
}

export function BrandingSettingsSection({
  isLoading,
  isSaving,
  brandingForm,
  formKey,
  onSave,
}: BrandingSettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-accent-blue" />
              Branding Settings
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Customize your organization&apos;s branding and visual identity
            </p>
          </div>
          <Button onClick={onSave} disabled={isSaving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-32" />
                <div className="h-10 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <FormProvider {...brandingForm} key={`branding-form-${formKey}`}>
            <BrandingSetupCard
              data={brandingForm.watch()}
              onDataChange={(field, value) => {
                brandingForm.setValue(field as any, value, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              onFileUpload={(field, file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const result = e.target?.result as string;
                  brandingForm.setValue("logo", result, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  brandingForm.setValue("logoFileName", file.name, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                };
                reader.readAsDataURL(file);
              }}
              onFileRemove={(field) => {
                brandingForm.setValue("logo", "", {
                  shouldDirty: true,
                  shouldTouch: true,
                });
                brandingForm.setValue("logoFileName", "", {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              hideCard={true}
            />
          </FormProvider>
        )}
      </CardContent>
    </Card>
  );
}
