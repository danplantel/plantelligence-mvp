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
import { ChipTypeahead } from "@/components/ui/chip-typeahead";
import {
  UserSetupData,
  onTitleChange,
  onHeadshotChange,
  formatPhoneNumber,
  normalizePhoneNumber,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";
import {
  designationAcronym,
  designationLabel,
  getDesignationOptions,
  getRelevantDesignations,
} from "@/config/onboarding/designations";
import { EmailChangeSection } from "@/components/pages/settings/email-change-section";
import { PasswordChangeSection } from "@/components/pages/settings/password-change-section";
import { GoogleAccountSection } from "@/components/pages/settings/google-account-section";
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
  /**
   * Called when the user leaves a required field, so the parent can validate just
   * that field ("leaves a field" half of the validation-timing rule). Optional —
   * Settings renders this section without it.
   */
  onFieldBlur?: (field: keyof UserSetupData) => void;
  hideCard?: boolean;
  /** Show Primary Service Categories (e.g. in Settings). Hidden in Step 4 onboarding. */
  showPrimaryServiceCategories?: boolean;
  /** When true, replaces the plain email input with a verified email-change flow (Settings page). */
  emailChangeMode?: boolean;
  /**
   * Render the Designations field even when this reader's title maps to none for it.
   *
   * `getRelevantDesignations` returns `[]` for two very different situations — a title that
   * carries no designations by design (relationship / success / plan / compliance roles), and a
   * title that is simply empty or unrecognised. The field was rendered only when that list was
   * non-empty, so in Settings anybody with no title saved (an invited teammate, before the seat
   * pre-fill reached them) or one of those roles saw NO Designations section at all, with no way
   * to record a designation they actually hold.
   *
   * Settings always shows the field, offering the full list when the title suggests nothing.
   * Onboarding keeps the curated behaviour: there the title has just been chosen and it is what
   * drives the suggestions.
   */
  alwaysShowDesignations?: boolean;
  /** Auth provider (e.g. "google", "credentials") — Google accounts have no password to change. */
  authProvider?: string;
  /**
   * Render the Headshot before "Your Name" instead of after the email fields.
   *
   * Settings → Profile wants the photo first: it is the one field that cannot be typed, so it
   * reads as the identity the rest of the form describes. Onboarding Step 4 keeps the original
   * order (name, title, email, then photo), so this is opt-in rather than a reorder of the shared
   * component.
   */
  headshotFirst?: boolean;
  /**
   * Never render the Designations field, whatever the title suggests.
   *
   * A Collaborator is a guest completing an assigned section of someone else's plan, so a
   * professional-designation list is not theirs to fill in — Settings → Profile hides the
   * row for them. Onboarding, and an owner's or a Team Member's Settings, keep it.
   */
  hideDesignations?: boolean;
}

export function UserSetupSection({
  data,
  errorFields = [],
  onDataChange,
  onFieldBlur,
  hideCard = false,
  showPrimaryServiceCategories = false,
  emailChangeMode = false,
  alwaysShowDesignations = false,
  authProvider,
  headshotFirst = false,
  hideDesignations = false,
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
  } = data;

  // Get organization type from wizard store
  const { stepData, loadAllWizardData } = useOnboardingWizardStore();

  // Use the parent form context instead of creating a new form
  const {
    control,
    watch,
    setValue,
    formState: { errors, touchedFields },
  } = useFormContext<UserSetupData>();

  const watchedTitle = watch("title");
  const watchedName = watch("name");
  const watchedDesignations = watch("designations") || [];
  const watchedHeadshotData = watch("headshotData");

  // Get relevant designations based on title
  const relevantDesignations = getRelevantDesignations(watchedTitle);

  // What the picker offers: the title's own suggestions when it has any, otherwise the full list —
  // which is what `alwaysShowDesignations` (Settings) needs, since "no suggestion for this title"
  // must not mean "no field". See the prop's doc.
  const designationOptions =
    relevantDesignations.length > 0
      ? relevantDesignations
      : getDesignationOptions();

  // Defined once and positioned by `headshotFirst`: Settings renders it first (above "Your Name"),
  // onboarding keeps it after the email fields. One definition means the two placements cannot
  // drift apart.
  const headshotField = (
    <div className="space-y-2">
      <label className="block font-medium text-sm text-left">
        Your Headshot{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </label>
      <Controller
        name="headshot"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-4" data-field="headshot">
            <div>
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
                modalTitle="Headshot"
                modalDescription="Upload a clear, front-facing photo. Keep your face inside the circle guide for best results."
                saveButtonText="Save Headshot"
                type="headshot"
                autoSizeOnOpen={true}
              />
            </div>
          </div>
        )}
      />
    </div>
  );

  const content = (
    <div className="grid grid-cols-1 gap-6">
      {/* Settings → Profile leads with the photo, before the name it depicts. */}
      {headshotFirst && headshotField}

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
                onFieldBlur?.("name");
              }}
              placeholder="Enter your full name"
              required
              data-field="name"
              destructive={errorFields.includes("name")}
            />
          )}
        />
        <FormError message={errors.name?.message} />
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
                // Persist title change immediately so validation on "Next"
                // sees the current value even if user didn't blur first
                onDataChange("title", e.target.value);
              }}
              onBlur={async (e) => {
                field.onBlur();
                const value = e.target.value;
                onTitleChange(value, onDataChange);
                onFieldBlur?.("title");
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

      {/* Row 2: Email — a verified email-change flow in Settings, Organization Email in onboarding.
          The Headshot is rendered separately (see `headshotField`) so its position can differ. */}
      {emailChangeMode ? (
        <EmailChangeSection
          currentEmail={data.email || ""}
          onEmailChanged={async (newEmail) => {
            setValue("email", newEmail);
            onDataChange("email", newEmail);
            // Refresh wizard store from server so the UI stays in sync
            // with the DB update that verify-email-change just performed.
            try {
              await loadAllWizardData(true);
            } catch {
              // Silently fail — form value is already correct locally
            }
          }}
        />
      ) : (
        // Onboarding Step 4: capture the Organization Email. This is separate
        // from the login/account email (User.email) — it is intentionally NOT
        // pre-populated with the user's login email. Blank = advisor contact
        // cards fall back to the login email.
        <div className="space-y-2">
          <label className="block font-medium text-sm">
            Organization Email <span className="text-red-500">*</span>
          </label>
          <Controller
            name="organizationEmail"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="email"
                value={field.value || ""}
                onChange={(e) => {
                  field.onChange(e);
                }}
                onBlur={(e) => {
                  field.onBlur();
                  onDataChange("organizationEmail", e.target.value);
                  onFieldBlur?.("organizationEmail");
                }}
                placeholder="your.organization@example.com"
                data-field="organizationEmail"
                destructive={errorFields.includes("organizationEmail")}
                icon={<Mail className="h-4 w-4" />}
              />
            )}
          />
          <p className="text-sm text-muted-foreground">
            A business email shown on your advisor contact cards. This can be the
            same as your sign-up email
            {data.email ? ` (${data.email})` : ""}.
          </p>
          <FormError message={errors.organizationEmail?.message} />
        </div>
      )}

      {/* Change Password / Google account (only in settings mode) */}
      {emailChangeMode &&
        (authProvider === "google" ? (
          <GoogleAccountSection />
        ) : (
          <PasswordChangeSection />
        ))}

      {/* Organization Email (Settings mode) — a separate business/contact email
          shown on the advisor's pre-populated contact cards (e.g. Create Plan
          Step 3). This is NOT used for login; it can differ from the login email
          above (blank = contact cards fall back to the login email). Onboarding
          Step 4 also captures this field via the non-emailChangeMode branch. */}
      {emailChangeMode && (
        <div className="space-y-2">
          <label className="block font-medium text-sm">
            Organization Email <span className="text-red-500">*</span>
          </label>
          <Controller
            name="organizationEmail"
            control={control}
            rules={{
              required: "Organization email is required",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Please enter a valid organization email",
              },
            }}
            render={({ field }) => (
              <Input
                {...field}
                type="email"
                value={field.value || ""}
                onChange={(e) => {
                  field.onChange(e);
                }}
                onBlur={(e) => {
                  field.onBlur();
                  onDataChange("organizationEmail", e.target.value);
                }}
                placeholder="your.organization@example.com"
                data-field="organizationEmail"
                destructive={errorFields.includes("organizationEmail")}
                icon={<Mail className="h-4 w-4" />}
              />
            )}
          />
          <p className="text-sm text-muted-foreground">
            A business email shown on your advisor contact cards. This can be the
            same as your login email
            {data.email ? ` (${data.email})` : ""}.
          </p>
          <FormError message={errors.organizationEmail?.message} />
        </div>
      )}

      {/* Onboarding keeps the photo here, after the email fields; Settings renders it at the top
          through the `headshotFirst` block above. */}
      {!headshotFirst && headshotField}

      {/* Row 3: Phone */}
      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Your Phone Number <span className="text-red-500">*</span>
        </label>
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
                if (normalized.length > 10) return;
                field.onChange(normalized);
              }}
              onBlur={async (e) => {
                field.onBlur();
                const normalized = normalizePhoneNumber(e.target.value);
                onDataChange("phone", normalized);
                onFieldBlur?.("phone");
              }}
              placeholder="(555) 123-4567"
              required
              data-field="phone"
              // errorFields is cleared on mount and only populated by explicit
              // validation, so it is safe (and consistent with the other required
              // fields in this step) to drive the red border directly from it.
              // The touched/errors check remains as a fallback for RHF validation.
              destructive={
                errorFields.includes("phone") ||
                (!!touchedFields.phone && !!errors.phone)
              }
            />
          )}
        />
        <FormError message={errors.phone?.message} />
      </div>

      {/* Row 4: Phone Extension */}
      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Phone Extension <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
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
            />
          )}
        />
      </div>
<div className="space-y-2">
         <div className="flex items-start space-x-2">
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

       {/* Row 5: Designations */}
       <div>
        {!hideDesignations &&
          (alwaysShowDesignations || relevantDesignations.length > 0) && (
          <div className="space-y-2">
            <label className="block font-medium text-sm dark:text-gray-200">
              Designations (Optional)
            </label>
            <ChipTypeahead
              // `keywords` lets a typed query match the acronym too, so "shrm cp"
              // resolves to SHRM-CP® (recognized entries normalize through config).
              options={designationOptions.map((o) => ({
                value: o.value,
                // Match list shows acronym + full name; the selected pill shows
                // the acronym only.
                label: `${o.acronym} – ${o.label}`,
                keywords: [o.acronym, o.value, o.label],
              }))}
              selectedValues={watchedDesignations || []}
              valueLabel={designationLabel}
              chipLabel={designationAcronym}
              onChange={(values) => {
                setValue("designations", values);
                onDataChange("designations", values);
              }}
              placeholder="Type a designation, e.g. CFP…"
              allowCustom
              customOptionLabel={(query) =>
                `Add as custom designation: “${query}”`
              }
              maxSelections={5}
              dataField="designations"
            />
            <p className="text-xs text-muted-foreground">
              Add up to 5. They display in this order. Drag to reorder.
            </p>
          </div>
        )}
      </div>

      
    </div>
  );

  if (hideCard) {
    return content;
  }

  return (
    <Card className="shadow-none dark:bg-gray-800">
      <CardHeader>
        <p className="text-muted-foreground">
          Tell us about yourself to personalize your experience
        </p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
