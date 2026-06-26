import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatePresence, motion } from "framer-motion";
import { InfoDialog } from "@/components/ui/info-dialog";
import { Check, ChevronsUpDown, Upload, X, Info } from "lucide-react";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import { ErrorMessage, Errors, IPlanFormData, TouchedFields } from "../..";
import { useState, useEffect } from "react";
import { colorData, ColorData } from "@/constants/color-data";

interface ColorImage extends ColorData {
  id: string;
}

interface AvatarOptions {
  value: string;
  label: string;
  img: string;
  avatarId: string;
}

interface BrandingSectionProps {
  formData: IPlanFormData;
  handleBlur: any;
  handleFileUpload: any;
  touched: TouchedFields;
  errors: Errors;
  fileInputRef: any;
  backgroundFileInputRef: any;
  avatarOptions: Array<AvatarOptions>;
  showAllAvatars: boolean;
  handlePreview: () => void;
  handleInputChange: (section: string, field: string, value: any) => void;
  setShowAllAvatars: React.Dispatch<React.SetStateAction<boolean>>;
}

export const BrandingSection = (props: BrandingSectionProps) => {
  const {
    formData,
    handleBlur,
    handleFileUpload,
    touched,
    errors,
    fileInputRef,
    backgroundFileInputRef,
    avatarOptions,
    showAllAvatars,
    handlePreview,
    handleInputChange,
    setShowAllAvatars,
  } = props;

  const [showAllColors, setShowAllColors] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoDialogConfig, setInfoDialogConfig] = useState({ title: "", description: "" });
  const [colorImages, setColorImages] = useState<ColorImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchColors = async () => {
      try {
        const data: ColorImage[] = colorData.map((item, idx) => ({
          ...item,
          id: (item as any).id ?? `color-${idx}`,
        }));
        setColorImages(data);
      } catch (error) {
        console.error("Failed to fetch colors:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchColors();
  }, []);

  const handleColorChange = (hexCode: string) => {
    const selectedColor = colorImages.find((c) => c.hexCode === hexCode);
    handleInputChange("branding", "accentColor", hexCode);
    if (selectedColor) {
      handleInputChange("branding", "accentColorImage", selectedColor.s3Url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="company-name"
            value={formData.branding.companyName}
            onChange={(e) =>
              handleInputChange("branding", "companyName", e.target.value)
            }
            onBlur={() => handleBlur("branding", "companyName")}
            placeholder="Enter company name"
            className={
              touched.branding.companyName && errors.branding.companyName
                ? "border-red-500"
                : ""
            }
          />
          {touched.branding.companyName && (
            <ErrorMessage error={errors.branding.companyName} />
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Company Logo <span className="text-red-500">*</span>
            <button
              type="button"
              onClick={() => {
                setInfoDialogConfig({ title: "Company Logo", description: "Upload your company's logo for branding purposes." });
                setInfoDialogOpen(true);
              }}
              className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </Label>
          <div className="flex items-center space-x-4">
            <UniversalImageEditorModal
              type="logo"
              value={formData.branding.companyLogo || ""}
              fileName=""
              onChange={(value, fileName) => {
                handleInputChange("branding", "companyLogo", value);
              }}
              onRemove={() => {
                handleInputChange("branding", "companyLogo", "");
              }}
              placeholder="Upload Company Logo"
            />
            {formData.branding.companyLogo && (
              <div className="relative h-16 w-16">
                <Headshot
                  src={formData.branding.companyLogo}
                  alt="Company Logo"
                  objectFit="contain"
                  wrapperClassName="h-full w-full rounded"
                  className="rounded"
                />
              </div>
            )}
          </div>
          {touched.branding.companyLogo && (
            <ErrorMessage error={errors.branding.companyLogo} />
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recommended dimensions: 400x200px. Supported formats: PNG, JPG,
            JPEG, WebP.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="plan-name">Plan Name</Label>
          <Input
            id="plan-name"
            value={formData.branding.planName}
            onChange={(e) =>
              handleInputChange("branding", "planName", e.target.value)
            }
            placeholder="Enter plan name"
            className={
              touched.branding.planName && errors.branding.planName
                ? "border-red-500"
                : ""
            }
          />
          {touched.branding.planName && (
            <ErrorMessage error={errors.branding.planName} />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="accent-color">Accent Color</Label>
          {loading ? (
            <div className="grid grid-cols-4 gap-2 w-full">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 w-full">
                {colorImages.slice(0, 8).map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={`relative flex items-center justify-center rounded-lg border transition-all focus:outline-none select-none w-full h-full min-h-[64px] p-1 ${
                      formData.branding.accentColor === color.hexCode
                        ? "border-[2.5px] border-[#005F73] ring-2 ring-[#005F73] bg-[#f8fafc]"
                        : "border-[1.5px] border-gray-200 dark:border-[#1c1c1c] hover:border-[#005F73]/40"
                    }`}
                    onClick={() => handleColorChange(color.hexCode)}
                    aria-label={color.name}
                  >
                    <img
                      src={color.s3Url}
                      alt={color.name}
                      className="absolute inset-0 w-full h-full rounded-lg object-cover"
                    />
                    {formData.branding.accentColor === color.hexCode && (
                      <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-[#005F73] flex items-center justify-center z-10 shadow">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <span className="flex absolute right-0 bottom-0 left-0 z-10 justify-center items-center w-full h-1/2 text-xs font-medium text-white rounded-b-lg opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 bg-black/60">
                      {color.name}
                    </span>
                  </button>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {showAllColors && (
                  <motion.div
                    key="extra-colors"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="grid grid-cols-4 gap-2 mt-2 w-full"
                  >
                    {colorImages.slice(8).map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        className={`relative flex items-center justify-center rounded-lg border transition-all focus:outline-none select-none w-full h-full min-h-[64px] p-1 ${
                          formData.branding.accentColor === color.hexCode
                            ? "border-[2.5px] border-[#005F73] ring-2 ring-[#005F73] bg-[#f8fafc]"
                            : "border-[1.5px] border-gray-200 dark:border-[#1c1c1c] hover:border-[#005F73]/40"
                        }`}
                        onClick={() => handleColorChange(color.hexCode)}
                        aria-label={color.name}
                      >
                        <img
                          src={color.s3Url}
                          alt={color.name}
                          className="absolute inset-0 w-full h-full rounded-lg object-cover"
                        />
                        {formData.branding.accentColor === color.hexCode && (
                          <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-[#005F73] flex items-center justify-center z-10 shadow">
                            <Check className="w-3 h-3 text-white" />
                          </span>
                        )}
                        <span className="flex absolute right-0 bottom-0 left-0 z-10 justify-center items-center w-full h-1/2 text-xs font-medium text-white rounded-b-lg opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 bg-black/60">
                          {color.name}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                className="flex relative justify-center items-center my-6 mt-6 w-full group"
                onClick={() => setShowAllColors((prev) => !prev)}
                style={{ background: "none", border: "none", padding: 0 }}
              >
                <span className="flex items-center w-full">
                  <span className="flex-1 border-t border-gray-300 dark:border-[#1c1c1c]" />
                  <span className="flex items-center mx-4 text-sm font-medium text-gray-600 select-none">
                    {showAllColors ? "Show less" : "Show more"}
                    <ChevronsUpDown className="ml-2 w-5 h-5" />
                  </span>
                  <span className="flex-1 border-t border-gray-300 dark:border-[#1c1c1c]" />
                </span>
              </button>
            </>
          )}
          {touched.branding.accentColor && (
            <ErrorMessage error={errors.branding.accentColor} />
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Background Image
            <button
              type="button"
              onClick={() => {
                setInfoDialogConfig({ title: "Background Image", description: "Upload a background image that will appear behind your content." });
                setInfoDialogOpen(true);
              }}
              className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </Label>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => backgroundFileInputRef.current?.click()}
              className="flex items-center border-2 border-gray-300 transition-colors hover:border-gray-400"
            >
              <Upload className="mr-2 w-4 h-4" /> Upload
            </Button>
            <input
              type="file"
              ref={backgroundFileInputRef}
              className="hidden"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => handleFileUpload(e, "backgroundImage")}
            />
            {formData.branding.backgroundImage && (
              <div className="overflow-hidden relative w-20 h-12 rounded border">
                <img
                  src={formData.branding.backgroundImage}
                  alt="Background"
                  className="object-cover w-full h-full"
                />
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recommended dimensions: 1920x1080px. Supported formats: PNG, JPG,
            JPEG. WebP is not supported.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Avatar Selection</Label>
          <div className="grid overflow-visible grid-cols-3 gap-4 mt-2 mb-1">
            {avatarOptions.slice(0, 6).map((avatar) => (
              <div
                key={avatar.value}
                className={`relative rounded-lg p-2 cursor-pointer transition-all overflow-visible
                    ${
                      formData.branding.avatarChoice === avatar.value
                        ? "border-[2.5px] border-[#005F73]"
                        : "border-[1.5px] dark:border-[#1c1c1c] border-gray-200 hover:border-[#005F73]/40"
                    }
                  `}
                onClick={() =>
                  handleInputChange("branding", "avatarChoice", avatar.value)
                }
                tabIndex={0}
                role="button"
                aria-pressed={formData.branding.avatarChoice === avatar.value}
              >
                <img
                  src={avatar.img}
                  alt={avatar.label}
                  className="w-full h-auto rounded"
                />
                <div className="mt-2 text-sm font-medium text-center">
                  {avatar.label}
                </div>
                {formData.branding.avatarChoice === avatar.value && (
                  <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-[#005F73] flex items-center justify-center z-10 shadow">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>
            ))}
            <AnimatePresence initial={false}>
              {showAllAvatars &&
                avatarOptions.slice(6).map((avatar) => (
                  <motion.div
                    key={avatar.value}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className={`relative rounded-lg p-2 cursor-pointer transition-all overflow-visible
                      ${
                        formData.branding.avatarChoice === avatar.value
                          ? "border-[2.5px] border-[#005F73]"
                          : "border-[1.5px] dark:border-[#1c1c1c] border-gray-200 hover:border-[#005F73]/40"
                      }
                    `}
                    onClick={() =>
                      handleInputChange(
                        "branding",
                        "avatarChoice",
                        avatar.value,
                      )
                    }
                    tabIndex={0}
                    role="button"
                    aria-pressed={
                      formData.branding.avatarChoice === avatar.value
                    }
                  >
                    <img
                      src={avatar.img}
                      alt={avatar.label}
                      className="w-full h-auto rounded"
                    />
                    <div className="mt-2 text-sm font-medium text-center">
                      {avatar.label}
                    </div>
                    {formData.branding.avatarChoice === avatar.value && (
                      <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[#005F73] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
          {/* Preload last 3 avatar images for instant reveal */}
          <div style={{ display: "none" }} aria-hidden="true">
            <img src="/images/maria.png" alt="Maria" />
            <img src="/images/scott.png" alt="Scott" />
            <img src="/images/custom.png" alt="Custom" />
          </div>
          <button
            type="button"
            className="flex relative justify-center items-center my-6 mt-6 w-full group"
            onClick={() => setShowAllAvatars((prev) => !prev)}
            style={{ background: "none", border: "none", padding: 0 }}
          >
            <span className="flex items-center w-full">
              <span className="flex-1 border-t border-gray-300 dark:border-[#1c1c1c]" />
              <span className="flex items-center mx-4 text-sm font-medium text-gray-600 select-none">
                {showAllAvatars ? "Show less" : "Show more"}
                <ChevronsUpDown className="ml-2 w-5 h-5" />
              </span>
              <span className="flex-1 border-t border-gray-300 dark:border-[#1c1c1c]" />
            </span>
          </button>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <Button
          onClick={handlePreview}
          className="transition-all duration-200 hover:scale-105 bg-[#005F73] hover:bg-[#004D5E]"
        >
          Preview
        </Button>
      </div>
      <InfoDialog
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        title={infoDialogConfig.title}
        description={infoDialogConfig.description}
      />
    </div>
  );
};

export default BrandingSection;
