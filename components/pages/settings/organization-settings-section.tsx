"use client";

import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Briefcase, Users, Building2 } from "lucide-react";
import { UserProfileSection } from "@/components/wizard/steps/sections/user-profile-section/user-profile-section";
import { TeamSizeSection } from "@/components/wizard/steps/sections/team-size-section/team-size-section";
import { ServicesSection } from "@/components/wizard/steps/sections/services-section/services-section";

interface OrganizationSettingsSectionProps {
  isLoading: boolean;
  isSaving: boolean;
  organizationForm: any;
  servicesForm: any;
  onSave: () => Promise<void> | void;
}

export function OrganizationSettingsSection({
  isLoading,
  isSaving,
  organizationForm,
  servicesForm,
  onSave,
}: OrganizationSettingsSectionProps) {
  return (
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
              <div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-accent-blue" />
                    Services Provided
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    What services do you provide?
                  </p>
                  <FormProvider {...servicesForm}>
                    <ServicesSection
                      selectedServices={servicesForm.watch("services")}
                      onServiceToggle={(service) => {
                        const currentServices =
                          servicesForm.getValues("services");
                        const newServices = currentServices.includes(service)
                          ? currentServices.filter((s: any) => s !== service)
                          : [...currentServices, service];
                        servicesForm.setValue("services", newServices, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }}
                      customService={servicesForm.watch("customService")}
                      onCustomServiceChange={(value) => {
                        servicesForm.setValue("customService", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }}
                      hideCard={true}
                    />
                  </FormProvider>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
