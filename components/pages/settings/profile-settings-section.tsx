"use client";

import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, User } from "lucide-react";
import { UserSetupSection } from "@/components/wizard/steps/sections/user-setup-section/user-setup-section";

interface ProfileSettingsSectionProps {
  isLoading: boolean;
  isSaving: boolean;
  userSetupForm: any;
  onSave: () => Promise<void> | void;
  /** Auth provider (e.g. "google") — Google accounts have no password to change. */
  authProvider?: string;
  /** Hide the Designations row entirely (a Collaborator's Profile has no use for it). */
  hideDesignations?: boolean;
}

export function ProfileSettingsSection({
  isLoading,
  isSaving,
  userSetupForm,
  onSave,
  authProvider,
  hideDesignations = false,
}: ProfileSettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-accent-blue" />
            User Profile
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Update your personal information and credentials
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-24" />
                <div className="h-10 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <FormProvider {...userSetupForm}>
            <UserSetupSection
              data={userSetupForm.watch()}
              onDataChange={(field, value) => {
                userSetupForm.setValue(field as any, value, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              hideCard={true}
              // Settings → Profile leads with the photo, before "Your Name". This section is
              // Settings-only, so the flag is set here rather than plumbed as a prop; onboarding
              // Step 4 renders the same component without it and keeps the original order.
              headshotFirst={true}
              // Primary Service Categories moved to the Organization tab — for EVERY profile, not
              // just a teammate's: they describe the organization rather than the person who
              // happened to be filling the form. See organization-settings-section.tsx, where the
              // control and its save now live.
              emailChangeMode={true}
              // Show Designations even when the reader's title suggests none: the field is optional
              // and free-form, so "no suggestion" must not mean "no field". See the prop's doc.
              alwaysShowDesignations={true}
              // A Collaborator completes someone else's plan rather than describing their own
              // practice, so the designations list is hidden for them (Settings → Profile).
              hideDesignations={hideDesignations}
              authProvider={authProvider}
            />
          </FormProvider>
        )}
      </CardContent>
    </Card>
  );
}
