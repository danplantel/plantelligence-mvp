"use client";

import { useState, useEffect, useCallback } from "react";
import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette } from "lucide-react";
import { toFabricImageLoadUrl } from "@/lib/branding-image-url";
import { BrandingSetupCard } from "@/components/wizard/steps/sections/branding-setup-card/branding-setup-card";
import { BrandColorsSection } from "@/components/wizard/new-client-steps/sections/brand-colors-section";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import type { BrandImagesData, BrandImageData } from "@/types/new-client-wizard";
import { deleteFromR2 } from "@/lib/upload-to-r2";

// Upload a (cropped) background data URL to R2 at the advisor scope, matching the
// existing settings persistence model where backgroundImage is an R2 storage key.
async function uploadBackgroundToR2(
  dataUrl: string,
  fileName: string,
): Promise<string | null> {
  try {
    const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const mime = dataUrl.startsWith("data:image/png")
      ? "image/png"
      : "image/jpeg";
    const name = fileName || "background.jpg";
    const file = new File([blob], name, { type: mime });
    return await uploadFileToR2({
      file,
      purpose: "upload",
      subPath: "advisor/background",
      fileName: name,
    });
  } catch (error) {
    console.error("Failed to upload background image to R2:", error);
    return null;
  }
}

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
  const backgroundImage: string = watchedBranding?.backgroundImage || "";
  const backgroundFileName: string =
    watchedBranding?.backgroundFileName || "";

  // Full header image data driving the shared BrandImagesSection (matches the
  // new-client wizard Step 1 "Background Image" slot: crop + set image).
  const [headerImage, setHeaderImage] = useState<BrandImageData | null>(null);

  // Rebuild headerImage from the form value whenever it changes externally
  // (initial load, Reset, or the wizard sync effect). Keeps the shared section
  // in sync with the persisted R2 key / filename.
  useEffect(() => {
    setHeaderImage((prev) => {
      const currentUrl = prev?.url || "";
      if (currentUrl === backgroundImage) return prev;
      if (!backgroundImage) return null;
      return {
        url: backgroundImage,
        fileName: backgroundFileName,
        fileSize: 0,
        width: 0,
        height: 0,
        recommendedSize: "1920×1080 px",
        status: "ok",
        warnings: [],
      };
    });
  }, [backgroundImage, backgroundFileName]);

  const handleBrandImagesChange = useCallback(
    async (brandImages: BrandImagesData) => {
      const header = brandImages.header;
      if (!header) {
        // Removed — clear the form fields and drop the R2 object if one exists.
        const persistedKey = brandingForm.getValues(
          "backgroundImage",
        ) as string;
        setHeaderImage(null);
        brandingForm.setValue("backgroundImage", "", {
          shouldDirty: true,
          shouldTouch: true,
        });
        brandingForm.setValue("backgroundFileName", "", {
          shouldDirty: true,
          shouldTouch: true,
        });
        if (persistedKey) {
          deleteFromR2(persistedKey).catch(() => {});
        }
        return;
      }

      // Upload the (cropped) data URL to R2 and persist the storage key,
      // mirroring how the new-client wizard persists header brand images.
      let storedUrl = header.url;
      if (header.url.startsWith("data:")) {
        const r2Key = await uploadBackgroundToR2(header.url, header.fileName);
        if (r2Key) storedUrl = r2Key;
      }

      const next: BrandImageData = {
        ...header,
        url: storedUrl,
        previewUrl: header.url.startsWith("data:")
          ? header.url
          : header.previewUrl,
      };
      setHeaderImage(next);
      brandingForm.setValue("backgroundImage", storedUrl, {
        shouldDirty: true,
        shouldTouch: true,
      });
      brandingForm.setValue("backgroundFileName", header.fileName, {
        shouldDirty: true,
        shouldTouch: true,
      });
    },
    [brandingForm],
  );

  // BrandColorsSection loads the logo via Image() and can consume any reachable
  // URL. R2 keys (the persisted form value) are mapped to the same-origin proxy
  // URL (/api/r2/object?key=...) so previously saved logos are extractable too;
  // data URLs (fresh uploads / the captured preview) pass through unchanged.
  const logoDataUrl =
    logoPreviewDataUrl || (logo ? toFabricImageLoadUrl(logo) : undefined);

  return (
    <>
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
                // In Settings the subdomain is pre-populated from saved data — don't
                // run the availability check for the existing value on load, only
                // when the user edits the subdomain field.
                skipInitialSubdomainCheck
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
                hideBackgroundImage
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
                organizationName={watchedBranding?.organizationName || ""}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>

    {!isLoading && (
      <BrandImagesSection
        brandImages={{
          header: headerImage,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        }}
        onBrandImagesChange={handleBrandImagesChange}
        visibleSlots={["header"]}
        errorFields={[]}
      />
    )}
    </>
  );
}
