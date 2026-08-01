"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users as UsersIcon, FileText } from "lucide-react";
import { AddTeamMembersSection } from "@/components/wizard/steps/sections/add-team-members-section/add-team-members-section";
import { DisclaimersSettingsSection } from "@/components/pages/settings/disclaimers-settings-section";

interface TeamAndDisclaimersSectionProps {
  isLoading: boolean;
}

export function TeamAndDisclaimersSection({
  isLoading,
}: TeamAndDisclaimersSectionProps) {
  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-accent-blue" />
                Team Members
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
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
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-blue" />
                Disclaimers
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Manage compliance disclaimers
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <DisclaimersSettingsSection />
          )}
        </CardContent>
      </Card>
    </>
  );
}
