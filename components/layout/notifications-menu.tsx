"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Calendar, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useHeaderNotifications,
  type MeetingReminder,
} from "@/hooks/useHeaderNotifications";
import {
  DOCUMENT_EXPIRATION_LABEL,
  formatDocumentExpirationWhen,
  type ExpiringDocument,
} from "@/lib/notifications/document-expirations";
import {
  MEETING_REMINDER_LABEL,
  formatMeetingReminderWhen,
  type MeetingReminderStatus,
} from "@/lib/notifications/meeting-reminders";

interface TierStyle {
  icon: ComponentType<{ className?: string }>;
  /** Icon-only color, matching the document reminders. */
  iconClassName: string;
  /** Urgency pill, matching the document reminders. */
  pillClassName: string;
}

/** Urgency tiers — identical colors to the document expiration reminders. */
const MEETING_TIER_STYLES: Record<MeetingReminderStatus, TierStyle> = {
  today: {
    icon: AlertTriangle,
    iconClassName: "text-red-500",
    pillClassName: "text-red-600 bg-red-50 border-red-200",
  },
  in_2days: {
    icon: Clock,
    iconClassName: "text-amber-500",
    pillClassName: "text-amber-600 bg-amber-50 border-amber-200",
  },
  in_week: {
    icon: Calendar,
    iconClassName: "text-blue-500",
    pillClassName: "text-blue-600 bg-blue-50 border-blue-200",
  },
};

const DOCUMENT_TIER_STYLES: Record<ExpiringDocument["status"], TierStyle> = {
  expiring_today: {
    icon: AlertTriangle,
    iconClassName: "text-red-500",
    pillClassName: "text-red-600 bg-red-50 border-red-200",
  },
  expiring_2days: {
    icon: Clock,
    iconClassName: "text-amber-500",
    pillClassName: "text-amber-600 bg-amber-50 border-amber-200",
  },
  expiring_week: {
    icon: Calendar,
    iconClassName: "text-blue-500",
    pillClassName: "text-blue-600 bg-blue-50 border-blue-200",
  },
};

const SECTION_LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

const TIER_PILL_CLASS =
  "mt-1 text-xs px-2 py-0.5 rounded border inline-block";

/**
 * Header notifications bell. Renders upcoming meeting reminders and expiring
 * documents in one dropdown, newest urgency first, with a combined count badge.
 */
export function NotificationsMenu() {
  const router = useRouter();
  const { meetings, documents, isLoading } = useHeaderNotifications();
  const [open, setOpen] = useState(false);

  const totalCount = meetings.length + documents.length;

  const handleMeetingClick = (reminder: MeetingReminder) => {
    const params = new URLSearchParams();
    if (reminder.clientId) params.set("planId", reminder.clientId);
    if (reminder.client) params.set("client", reminder.client);
    const query = params.toString();
    router.push(
      query ? `/communications/meetings?${query}` : "/communications/meetings",
    );
  };

  const handleDocumentClick = (document: ExpiringDocument) => {
    // Same shape as the meeting rows: plan-scoped first, company name as the
    // human-readable fallback for documents whose client row was removed.
    const params = new URLSearchParams();
    if (document.client.id) params.set("planId", document.client.id);
    if (document.client.companyName) {
      params.set("company", document.client.companyName);
    }
    const query = params.toString();
    router.push(query ? `/documents?${query}` : "/documents");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative h-10 w-10 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 dark:focus-visible:bg-white/10"
        >
          <Bell className="h-5 w-5 text-gray-700 dark:text-gray-200 dark:hover:text-white" />
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-semibold"
            >
              {totalCount > 9 ? "9+" : totalCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0">
              <span className="font-semibold">Notifications</span>
              {totalCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalCount}
                </Badge>
              )}
            </div>
            <button
              type="button"
              aria-label="Close notifications"
              title="Close"
              onClick={() => setOpen(false)}
              className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : totalCount === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Nothing needs your attention right now</p>
            <p className="text-xs mt-1">
              Meeting reminders and document expiration alerts will appear here
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto py-1">
            {/* Meetings */}
            <div className="px-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className={SECTION_LABEL_CLASS}>Meetings</span>
                {meetings.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {meetings.length}
                  </span>
                )}
              </div>
              {meetings.length === 0 ? (
                <p className="px-2 pb-2 text-xs text-muted-foreground">
                  No upcoming meetings.
                </p>
              ) : (
                meetings.map((reminder) => {
                  const tier = MEETING_TIER_STYLES[reminder.reminderStatus];
                  const TierIcon = tier.icon;
                  return (
                    <DropdownMenuItem
                      key={reminder.id}
                      className="flex flex-col items-start p-3 cursor-pointer"
                      onClick={() => handleMeetingClick(reminder)}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <TierIcon
                          className={cn("h-4 w-4 shrink-0", tier.iconClassName)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {reminder.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {reminder.client}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <div
                              className={cn(
                                TIER_PILL_CLASS,
                                tier.pillClassName,
                              )}
                            >
                              {MEETING_REMINDER_LABEL[reminder.reminderStatus]}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              {formatMeetingReminderWhen(
                                reminder.dateKey,
                                reminder.time,
                                reminder.timezone,
                                reminder.reminderStatus,
                              )}
                            </span>
                          </div>
                          {reminder.meetingType && (
                            <div className="mt-1 text-[10px] text-muted-foreground/70 truncate">
                              {reminder.meetingType}
                            </div>
                          )}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>

            <DropdownMenuSeparator />

            {/* Documents */}
            <div className="px-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className={SECTION_LABEL_CLASS}>Documents</span>
                {documents.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {documents.length}
                  </span>
                )}
              </div>
              {documents.length === 0 ? (
                <p className="px-2 pb-2 text-xs text-muted-foreground">
                  No expiring documents.
                </p>
              ) : (
                documents.map((document) => {
                  const tier = DOCUMENT_TIER_STYLES[document.status];
                  const TierIcon = tier.icon;
                  return (
                    <DropdownMenuItem
                      key={document.id}
                      className="flex flex-col items-start p-3 cursor-pointer"
                      onClick={() => handleDocumentClick(document)}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <TierIcon
                          className={cn("h-4 w-4 shrink-0", tier.iconClassName)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {document.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {document.client.companyName}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <div
                              className={cn(
                                TIER_PILL_CLASS,
                                tier.pillClassName,
                              )}
                            >
                              {DOCUMENT_EXPIRATION_LABEL[document.status]}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              {formatDocumentExpirationWhen(
                                document.dateKey,
                                document.status,
                              )}
                            </span>
                          </div>
                          {(document.category || document.type) && (
                            <div className="mt-1 text-[10px] text-muted-foreground/70 truncate">
                              {[document.category, document.type]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          </div>
        )}

        {meetings.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/communications/meetings")}
            >
              <span className="text-sm">View all meetings</span>
            </DropdownMenuItem>
          </>
        )}
        {documents.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/documents")}
            >
              <span className="text-sm">View all documents</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
