"use client";

import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { Skeleton } from "@/components/ui/skeleton";
import { Save, Briefcase, Users, Building2 } from "lucide-react";
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
      {/* ── Team Members (hidden / disabled) ── */}
      {/* <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-accent-blue" />
                Team Members
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
                Manage your team members and their access
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <AddTeamMembersSection isVisible={true} hideCard={true} />
          )}
        </CardContent>
      </Card> */}

      {/* Organization Settings */}
      <Card>
        <CardHeader className="border-b">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-accent-blue" />
              Organization Settings
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
              Configure your organization type, services, and team information
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
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
                <div className="space-y-2">
                  <div className="h-6 bg-gray-300 rounded w-44 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-52 mb-4" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-8 bg-gray-200 rounded animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </>
  );
}
