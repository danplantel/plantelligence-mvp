"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanMeetingScheduleForm } from "@/components/meetings/plan-meeting-schedule-form";

export function PlanMeetingsSection({
  clientId,
  companyName,
  isOpen,
  onToggle,
}: {
  clientId?: string;
  companyName: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent-blue" />
            Plan meetings (Benefits Hub)
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal mt-1">
            Same scheduling workflow as Meetings — types, date, time, timezone,
            duration, Virtual/In-Person, RSVP URL, conflicts, and optional replay.
            Sessions are scoped to this plan only.
          </p>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
          {!clientId ? (
            <p className="text-sm text-muted-foreground">
              Save the client to manage meetings.
            </p>
          ) : (
            <PlanMeetingScheduleForm
              clientId={clientId}
              companyName={companyName || ""}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}
