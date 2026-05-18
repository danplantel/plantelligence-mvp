"use client";

import { useRef, useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import { FormError } from "@/components/ui/form-error";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import {
  UserSetupData,
  onTitleChange,
  onHeadshotChange,
  formatPhoneNumber,
  normalizePhoneNumber,
  getRelevantDesignations,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";
import { PrimaryServiceCategoriesSelect } from "@/components/ui/primary-service-categories-select";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import { OrganizationType } from "@/types/wizard";
import { User, Mail, Phone, Briefcase } from "lucide-react";
import { normalizeExtension } from "@/lib/phone-utils";

interface UserSetupSectionProps {
  data: UserSetupData;
  errorFields?: string[];
  onDataChange: (field: keyof UserSetupData, value: any) => void;
  onBackgroundImageChange?: (imageData: string, fileName: string) => void;
  hideCard?: boolean;
  /** Show Primary Service Categories (e.g. in Settings). Hidden in Step 4 onboarding. */
  showPrimaryServiceCategories?: boolean;
}

export function UserSetupSection({
  data,
  errorFields = [],
  onDataChange,
  onBackgroundImageChange,
  hideCard = false,
  showPrimaryServiceCategories = false,
}: UserSetupSectionProps) {
  const {
    name,
    email,
    phone,
    phoneExtension,
    title,
    designations,
    headshot,
    headshotFileName,
    backgroundImage,
    backgroundFileName,
  } = data;

  // Get organization type from wizard store
  const { stepData, validateCurrentStepFields, setErrorFields } =
    useOnboardingWizardStore();

  // Use the parent form context instead of creating a new form
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<UserSetupData>();

  const watchedTitle = watch("title");
  const watchedName = watch("name");
  const watchedDesignations = watch("designations") || [];
  const watchedHeadshotData = watch("headshotData");

  // Get relevant designations based on title
  const relevantDesignations = getRelevantDesignations(watchedTitle);

  const content = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Row 1: Name & Title */}
      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Your Name <span className="text-red-500">*</span>
        </label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              icon={<User className="h-4 w-4" />}
              onChange={(e) => {
                field.onChange(e);
              }}
              onBlur={async (e) => {
                field.onBlur();
                const value = e.target.value;
                onDataChange("name", value);
                try {
                  const { validateCurrentStep } = await import(
                    "@/lib/wizard-validation"
                  );
                  const currentStepData = {
                    ...stepData,
                    userSetup: {
                      ...stepData.userSetup,
                      name: value,
                    },
                  };
                  const validationResult = await validateCurrentStep(
                    4,
                    currentStepData,
                  );

                  if (
                    !validationResult.isValid &&
                    validationResult.errorFields
                  ) {
                    setErrorFields(validationResult.errorFields);
                  } else {
                    setErrorFields([]);
                  }
                } catch (validationError) {
                  console.error(
                    "Error validating current step:",
                    validationError,
                  );
                }
              }}
              placeholder="Enter your full name"
              required
              data-field="name"
              destructive={errorFields.includes("name")}
            />
          )}
        />
        <FormError message={errors.name?.message} />
        <p className="mt-1 text-muted-foreground text-xs">
          Pre-filled from your registration, but you can change it
        </p>
      </div>

      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Your Title <span className="text-red-500">*</span>
        </label>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              icon={<Briefcase className="h-4 w-4" />}
              onChange={(e) => {
                field.onChange(e);
              }}
              onBlur={async (e) => {
                field.onBlur();
                const value = e.target.value;
                onTitleChange(value, onDataChange);
                try {
                  const { validateCurrentStep } = await import(
                    "@/lib/wizard-validation"
                  );
                  const currentStepData = {
                    ...stepData,
                    userSetup: { ...stepData.userSetup, title: value },
                  };
                  const validationResult = await validateCurrentStep(
                    4,
                    currentStepData,
                  );

                  if (
                    !validationResult.isValid &&
                    validationResult.errorFields
                  ) {
                    setErrorFields(validationResult.errorFields);
                  } else {
                    setErrorFields([]);
                  }
                } catch (validationError) {
                  console.error(
                    "Error validating current step:",
                    validationError,
                  );
                }
              }}
              placeholder="Enter your professional title"
              required
              data-field="title"
              destructive={errorFields.includes("title")}
            />
          )}
        />
        <FormError message={errors.title?.message} />
      </div>

      {showPrimaryServiceCategories && (
        <Controller
          name="primaryServiceCategories"
          control={control}
          render={({ field }) => (
            <PrimaryServiceCategoriesSelect
              selectedValues={field.value || []}
              onSelectionChange={(values) => {
                field.onChange(values);
                onDataChange("primaryServiceCategories", values);
              }}
              placeholder="Select service categories..."
              label="Primary Service Categories"
              helperText="Select 1–4 categories. Same categories as in Step 2."
              maxSelections={4}
            />
          )}
        />
      )}

      {/* Row 2: Email & Headshot */}
      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Your Email <span className="text-red-500">*</span>
        </label>
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              type="email"
              icon={<Mail className="h-4 w-4" />}
              onChange={(e) => {
                field.onChange(e);
              }}
              onBlur={async (e) => {
                field.onBlur();
                const value = e.target.value;
                onDataChange("email", value);
                try {
                  const { validateCurrentStep } = await import(
                    "@/lib/wizard-validation"
                  );
                  const currentStepData = {
                    ...stepData,
                    userSetup: {
                      ...stepData.userSetup,
                      email: value,
                    },
                  };
                  const validationResult = await validateCurrentStep(
                    4,
                    currentStepData,
                  );

                  if (
                    !validationResult.isValid &&
                    validationResult.errorFields
                  ) {
                    setErrorFields(validationResult.errorFields);
                  } else {
                    setErrorFields([]);
                  }
                } catch (validationError) {
                  console.error(
                    "Error validating current step:",
                    validationError,
                  );
                }
              }}
              placeholder="your.email@example.com"
              required
              data-field="email"
              destructive={errorFields.includes("email")}
            />
          )}
        />
        <FormError message={errors.email?.message} />
        <p className="mt-1 text-muted-foreground text-xs">
          Pre-filled from your registration, but you can change it
        </p>
      </div>

      <div className="space-y-2">
        <label className="block font-medium text-sm text-left">
          Your Headshot{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Controller
          name="headshot"
          control={control}
          render={({ field }) => (
            <div className="flex items-start gap-4" data-field="headshot">
              <div className="flex-1">
                <UniversalImageEditorModal
                  value={field.value || ""}
                  fileName={headshotFileName || ""}
                  onChange={(value, fileName, headshotDataFromModal) => {
                    field.onChange(value);
                    onDataChange("headshot", value);
                    onDataChange("headshotFileName", fileName);
                    if (headshotDataFromModal != null) {
                      onDataChange("headshotData", headshotDataFromModal);
                    }
                  }}
                  onRemove={async () => {
                    await deleteFromR2(field.value);
                    field.onChange("");
                    onDataChange("headshot", "");
                    onDataChange("headshotFileName", "");
                    onDataChange("headshotData", null);
                  }}
                  placeholder="Upload Headshot"
                  modalTitle="Edit Headshot"
                  modalDescription="Upload a clear, front-facing photo. Keep your face inside the circle guide for best results."
                  saveButtonText="Save Headshot"
                  type="headshot"
                  autoSizeOnOpen={true}
                />
              </div>
              <div className="-mt-2">
                <Headshot
                  src={field.value || undefined}
                  monogramName={watchedName}
                  alt="Current headshot"
                  wrapperClassName="w-20 h-20 rounded-full border-2 border-gray-200"
                />
              </div>
            </div>
          )}
        />
      </div>

      {/* Row 3: Phone & Background Image */}
      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Your Phone Number <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="tel"
                icon={<Phone className="h-4 w-4" />}
                value={field.value ? formatPhoneNumber(field.value) : ""}
                onChange={(e) => {
                  const normalized = normalizePhoneNumber(e.target.value);
                  if (normalized.length > 11) return;
                  field.onChange(normalized);
                }}
                onBlur={async (e) => {
                  field.onBlur();
                  const normalized = normalizePhoneNumber(e.target.value);
                  onDataChange("phone", normalized);

                  if (normalized.length >= 7) {
                    try {
                      const { validateCurrentStep } = await import(
                        "@/lib/wizard-validation"
                      );
                      const currentStepData = {
                        ...stepData,
                        userSetup: {
                          ...stepData.userSetup,
                          phone: normalized,
                        },
                      };

                      const validationResult = await validateCurrentStep(
                        4,
                        currentStepData,
                      );

                      if (
                        !validationResult.isValid &&
                        validationResult.errorFields
                      ) {
                        setErrorFields(validationResult.errorFields);
                      } else {
                        setErrorFields([]);
                      }
                    } catch (validationError) {
                      console.error(
                        "Error validating current step:",
                        validationError,
                      );
                    }
                  } else {
                    setErrorFields([]);
                  }
                }}
                placeholder="(555) 123-4567"
                required
                data-field="phone"
                destructive={errorFields.includes("phone")}
              />
            )}
          />
          <Controller
            name="phoneExtension"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ""}
                onChange={(e) => {
                  const normalized = normalizeExtension(e.target.value);
                  field.onChange(normalized);
                }}
                onBlur={(e) => {
                  onDataChange("phoneExtension", e.target.value);
                }}
                placeholder="Ext."
                className="w-24"
              />
            )}
          />
        </div>
        <FormError message={errors.phone?.message} />
      </div>

      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Background Image (Optional)
        </label>
        <Controller
          name="backgroundImage"
          control={control}
          render={({ field }) => (
            <SimpleImageEditorModal
              value={field.value || ""}
              fileName={backgroundFileName || ""}
              onChange={(value, fileName) => {
                field.onChange(value);
                if (onBackgroundImageChange) {
                  onBackgroundImageChange(value, fileName);
                } else {
                  onDataChange("backgroundImage", value);
                  onDataChange("backgroundFileName", fileName);
                }
              }}
              onRemove={async () => {
                await deleteFromR2(field.value);
                field.onChange("");
                if (onBackgroundImageChange) {
                  onBackgroundImageChange("", "");
                } else {
                  onDataChange("backgroundImage", "");
                  onDataChange("backgroundFileName", "");
                }
              }}
              placeholder="Upload Background Image"
              modalTitle="Background Image"
              modalDescription="Upload a background image. Adjust and fit it into the preview dimensions for best results."
              saveButtonText="Save Background Image"
              canvasWidth={640}
              canvasHeight={640}
              guidelineWidth={580}
              guidelineHeight={240}
              showGuidelines={true}
              autoSizeOnOpen={true}
              guidelinesTitle="Background Image Guidelines"
              guidelinesContent={
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    Resize your Background Image so it fits inside the dashed
                    line.
                  </li>
                  <li>
                    The dashed line marks the recommended Background Image area
                    (for best display on all devices).
                  </li>
                  <li>
                    The solid border line marks the safe zone – anything beyond
                    it may be cropped or hidden.
                  </li>
                </ul>
              }
            />
          )}
        />
      </div>

      {/* Row 4: Designations & Save as Contact */}
      <div className="md:col-start-1">
        {relevantDesignations.length > 0 && (
          <div className="space-y-2">
            <label className="block font-medium text-sm">
              Designations (Optional)
            </label>
            <MultiSelectDropdown
              options={relevantDesignations}
              selectedValues={watchedDesignations || []}
              onSelectionChange={(values) => {
                setValue("designations", values);
                onDataChange("designations", values);
              }}
              placeholder="Select designations..."
              allowCustomInput
              customInputPlaceholder="Add custom designation"
              data-field="designations"
              maxSelections={5}
              displayMode="chips"
            />
          </div>
        )}
      </div>

      <div className="md:col-start-2 flex items-start space-x-2 pt-2">
        <Controller
          name="saveAsContact"
          control={control}
          defaultValue={data.saveAsContact ?? true}
          render={({ field }) => (
            <Checkbox
              id="saveAsContact"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                onDataChange("saveAsContact", checked);
              }}
            />
          )}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="saveAsContact"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Save me as a contact for future plans
          </Label>
          <p className="text-sm text-muted-foreground">
            You will appear in the &apos;Saved Contacts&apos; list when creating
            new clients.
          </p>
        </div>
      </div>
    </div>
  );

  if (hideCard) {
    return content;
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <User className="w-5 h-5 text-accent-blue" />
          User Setup
        </CardTitle>
        <p className="text-muted-foreground">
          Tell us about yourself to personalize your experience
        </p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
