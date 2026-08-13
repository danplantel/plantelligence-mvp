"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette } from "lucide-react";
import { toFabricImageLoadUrl } from "@/lib/branding-image-url";
import { BrandingSetupCard } from "@/components/wizard/steps/sections/branding-setup-card/branding-setup-card";
import { BrandColorsSection } from "@/components/wizard/new-client-steps/sections/brand-colors-section";

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
  // Preview DataURL of the logo — captured on upload/editor save so the shared
  // BrandColorsSection can extract colors from it (matching the new-client
  // wizard behavior). When no data URL is available (e.g. a previously saved R2
  // logo), extraction falls back to the company website.
  const [logoPreviewDataUrl, setLogoPreviewDataUrl] = useState<string>("");
  const [isPrimaryColorPickerOpen, setIsPrimaryColorPickerOpen] =
    useState(false);
  const [isSecondaryColorPickerOpen, setIsSecondaryColorPickerOpen] =
    useState(false);

  const watchedBranding = brandingForm.watch();
  const logo: string = watchedBranding?.logo || "";
  const website: string = watchedBranding?.website || "";
  const primaryColor: string = watchedBranding?.primaryColor || "";
  const secondaryColor: string = watchedBranding?.secondaryColor || "";

  // BrandColorsSection loads the logo via Image() and can consume any reachable
  // URL. R2 keys (the persisted form value) are mapped to the same-origin proxy
  // URL (/api/r2/object?key=...) so previously saved logos are extractable too;
  // data URLs (fresh uploads / the captured preview) pass through unchanged.
  const logoDataUrl =
    logoPreviewDataUrl || (logo ? toFabricImageLoadUrl(logo) : undefined);

  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent-blue" />
            Branding Settings
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
            Customize your organization branding and visual identity
          </p>
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
          <>
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
                  // Drop the captured preview so color extraction no longer
                  // uses the removed logo.
                  setLogoPreviewDataUrl("");
                }}
                onLogoPreview={async (dataUrl) =>
                  setLogoPreviewDataUrl(dataUrl)
                }
                hideCard={true}
                // Colors are managed by the dedicated BrandColorsSection
                // below (same "Extract Colors" flow as the new-client wizard),
                // so hide the card's built-in color pickers and don't
                // auto-populate colors from the logo on upload.
                hideColors
                disableAutoColorExtraction
              />
            </FormProvider>

            {/* Brand Colors — shared extraction UI (matches new-client wizard) */}
            <div className="mt-6">
              <BrandColorsSection
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                onPrimaryChange={(color) =>
                  brandingForm.setValue("primaryColor", color, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
                onSecondaryChange={(color) =>
                  brandingForm.setValue("secondaryColor", color, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
                isPrimaryPickerOpen={isPrimaryColorPickerOpen}
                isSecondaryPickerOpen={isSecondaryColorPickerOpen}
                onPrimaryPickerOpenChange={setIsPrimaryColorPickerOpen}
                onSecondaryPickerOpenChange={setIsSecondaryColorPickerOpen}
                logoDataUrl={logoDataUrl}
                websiteUrl={website}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
