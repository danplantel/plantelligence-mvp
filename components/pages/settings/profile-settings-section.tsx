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
}

export function ProfileSettingsSection({
  isLoading,
  isSaving,
  userSetupForm,
  onSave,
}: ProfileSettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-accent-blue" />
              User Profile
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Update your personal information and credentials
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
              showPrimaryServiceCategories={true}
            />
          </FormProvider>
        )}
      </CardContent>
    </Card>
  );
}
