"use client";

import { Controller, FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrimaryServiceCategoriesSelect } from "@/components/ui/primary-service-categories-select";
// import { Skeleton } from "@/components/ui/skeleton";
import { Save, Briefcase, Users, Building2, Layers } from "lucide-react";
import { UserProfileSection } from "@/components/wizard/steps/sections/user-profile-section/user-profile-section";
import { TeamSizeSection } from "@/components/wizard/steps/sections/team-size-section/team-size-section";
// import { AddTeamMembersSection } from "@/components/wizard/steps/sections/add-team-members-section/add-team-members-section";

interface OrganizationSettingsSectionProps {
  isLoading: boolean;
  isSaving: boolean;
  organizationForm: any;
  onSave: () => Promise<void> | void;
}

export function OrganizationSettingsSection({
  isLoading,
  isSaving,
  organizationForm,
  onSave,
}: OrganizationSettingsSectionProps) {
  return (
    <>
      {/* Organization Settings */}
      <Card>
        <CardHeader className="border-b">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-accent-blue" />
              Organization Settings
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
              Configure your organization type, services, team information, and disclaimers.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-6">
              {/* Categories row first, then the two-column pair — the same shape the loaded
                  state renders, so the reveal is a fade rather than a relayout. */}
              <div className="space-y-2">
                <div className="h-6 bg-gray-300 rounded w-56" />
                <div className="h-4 bg-gray-200 rounded w-48" />
                <div className="flex flex-wrap gap-2 pt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-8 w-28 rounded bg-gray-200 animate-pulse"
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-6 w-full grid-cols-1 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-6 bg-gray-300 rounded w-48 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-56 mb-4" />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-10 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="h-6 bg-gray-300 rounded w-52 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
                    <div className="h-10 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Primary Service Categories — its own full-width row, FIRST.
               *
               * It moved here from the Profile tab because it is not a personal setting: it
               * describes what the ORGANIZATION offers, it seeds a new plan's benefit visibility
               * (Create Benefit Step 1) and it decides which benefits an advisor is expected to
               * publish — the same reading the Browse Benefits strip takes.
               *
               * Full width and above the other two, rather than a third half-width column: the
               * control is a wrapping list of category chips with its own helper text, which reads
               * badly at half width beside two single-input fields, and "what does this
               * organization offer?" is the question that is answered before "what type is it?".
               *
               * Bound through `organizationForm.control` rather than a `FormProvider` child,
               * because the select is a plain controlled component and this is the one field on the
               * tab that has no wizard-section wrapper of its own. */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-accent-blue" />
                  Primary Service Categories
                </h3>
                <p className="text-sm text-muted-foreground">
                  The benefits your organization offers.
                </p>
                <Controller
                  name="primaryServiceCategories"
                  control={organizationForm.control}
                  render={({ field }) => (
                    <PrimaryServiceCategoriesSelect
                      selectedValues={field.value || []}
                      onSelectionChange={field.onChange}
                      helperText="Select 1–4 categories. Same categories as in Step 2."
                      maxSelections={4}
                    />
                  )}
                />
              </div>

              {/* The two remaining fields stay side by side: each is a single input, so they pair
                  naturally and the row does not grow tall. */}
              <div className="grid gap-6 w-full grid-cols-1 lg:grid-cols-2">
                <div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-accent-blue" />
                      Organization Type
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      What type of organization are you?
                    </p>
                    <FormProvider {...organizationForm}>
                      <UserProfileSection hideCard={true} disableAutoSave={true} />
                    </FormProvider>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5 text-accent-blue" />
                        Team Size / Role Scope
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        How many users need access?
                      </p>
                      <FormProvider {...organizationForm}>
                        <TeamSizeSection hideCard={true} disableAutoSave={true} />
                      </FormProvider>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
