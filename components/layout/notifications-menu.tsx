"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock,
  FileText,
  UserPlus,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  useNotifications,
  type AppNotification,
} from "@/hooks/useNotifications";
import {
  documentNotificationKey,
  meetingNotificationKey,
  useDismissedNotifications,
} from "@/hooks/useDismissedNotifications";
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
 * One accordion per MESSAGE TYPE, all open on first paint.
 *
 * The menu listed Team, Meetings and Documents as three stacked blocks; folding is
 * what lets a reader with a long team feed get to their meeting reminders without
 * scrolling past it. All three start expanded so the menu still shows everything it
 * ever did until the reader chooses otherwise, and `type="multiple"` keeps each
 * type's fold independent of the others.
 */
const NOTIFICATION_GROUPS = ["team", "meetings", "documents"] as const;

/** Short "when" for a persisted notification. Rendered client-side only. */
function formatNotificationWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The fold control, drawn as a SIBLING of the accordion trigger.
 *
 * It cannot be a child of the trigger: the trigger is a real `<button>`, and these
 * header rows also carry the section's own action ("Mark all read"), so nesting one
 * button in another would be invalid markup — the parser hoists it out on hydration.
 * As a sibling it stays clickable, and its rotation follows the section's open state
 * (which is held here, so a fold survives closing and reopening the menu).
 */
function SectionFoldToggle({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${open ? "Collapse" : "Expand"} ${label} notifications`}
      aria-expanded={open}
      onClick={onToggle}
      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-black/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-white/10"
    >
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 transition-transform duration-200",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

/**
 * Header notifications bell. Renders upcoming meeting reminders and expiring
 * documents in one dropdown, folded by message type, with a combined count badge.
 */
export function NotificationsMenu() {
  const router = useRouter();
  const { meetings, documents, isLoading } = useHeaderNotifications();
  const { isDismissed, dismiss } = useDismissedNotifications();
  const {
    items: appNotifications,
    unreadCount,
    isLoading: appNotificationsLoading,
    markRead,
    markAllRead,
    remove: removeNotification,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  /** Which message types are expanded; see `NOTIFICATION_GROUPS`. */
  const [openGroups, setOpenGroups] = useState<string[]>([
    ...NOTIFICATION_GROUPS,
  ]);

  const toggleGroup = (group: string) => {
    setOpenGroups((previous) =>
      previous.includes(group)
        ? previous.filter((value) => value !== group)
        : [...previous, group],
    );
  };

  // Rows the user has closed are filtered out before anything is counted, so the
  // bell badge and the per-section counts always match what is actually listed.
  const visibleMeetings = useMemo(
    () =>
      meetings.filter(
        (reminder) => !isDismissed(meetingNotificationKey(reminder)),
      ),
    [meetings, isDismissed],
  );
  const visibleDocuments = useMemo(
    () =>
      documents.filter(
        (document) => !isDismissed(documentNotificationKey(document)),
      ),
    [documents, isDismissed],
  );

  const totalCount =
    visibleMeetings.length + visibleDocuments.length + unreadCount;
  // Show the loading state until BOTH sources have answered once, so the menu never
  // flashes "nothing needs your attention" before the persisted feed arrives.
  const loading = isLoading || appNotificationsLoading;

  const handleMeetingClick = (reminder: MeetingReminder) => {
    // Plan id FIRST, and deliberately on its own. The meetings page resolves a
    // `planId` only when no `client` name is present; if both are supplied it
    // takes the name branch and matches on the denormalized company name, which
    // can differ from Client.companyName and leave no plan selected. The name is
    // sent only as a fallback for legacy meetings that have no clientId.
    const params = new URLSearchParams();
    if (reminder.clientId) {
      params.set("planId", reminder.clientId);
    } else if (reminder.client) {
      params.set("client", reminder.client);
    }
    const query = params.toString();
    router.push(
      query ? `/communications/meetings?${query}` : "/communications/meetings",
    );
  };

  const handleDocumentClick = (document: ExpiringDocument) => {
    // Same id-first rule: the documents page resolves a valid `planId` via
    // resolveStickyPlanId and opens that plan.
    const params = new URLSearchParams();
    if (document.client.id) {
      params.set("planId", document.client.id);
    } else if (document.client.companyName) {
      params.set("company", document.client.companyName);
    }
    const query = params.toString();
    router.push(query ? `/documents?${query}` : "/documents");
  };

  /**
   * Row activation. Both handlers are wired to Radix's `onSelect`, not `onClick`:
   * a menu item dismisses on pointer-up/select, which unmounts the row's subtree
   * before a `click` event can be delivered — so an `onClick` handler on a
   * `DropdownMenuItem` is unreliable. `onSelect` also covers keyboard activation
   * (Enter/Space). The menu is closed explicitly so the UI is consistent either
   * way.
   */
  const handleMeetingSelect = (reminder: MeetingReminder) => {
    setOpen(false);
    handleMeetingClick(reminder);
  };

  const handleDocumentSelect = (document: ExpiringDocument) => {
    setOpen(false);
    handleDocumentClick(document);
  };

  const handleNotificationSelect = (notification: AppNotification) => {
    setOpen(false);
    if (!notification.readAt) markRead(notification.id);
    if (notification.href) router.push(notification.href);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {/* Scales down with the viewport (see the header's responsive note): 28px and a
            16px glyph below `xl`, full size at `xl` and up. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative h-7 w-7 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 dark:focus-visible:bg-white/10 xl:h-10 xl:w-10"
        >
          <Bell className="h-4 w-4 text-gray-700 dark:text-gray-200 dark:hover:text-white xl:h-5 xl:w-5" />
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center p-0 text-[10px] font-semibold xl:-right-1 xl:-top-1 xl:h-5 xl:w-5 xl:text-xs"
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

        {loading ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : totalCount === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Nothing needs your attention right now</p>
            <p className="text-xs mt-1">
              Team updates, meeting reminders and document expiration alerts will
              appear here
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] w-full min-w-0 overflow-y-auto overflow-x-hidden py-1">
            {/* One accordion per message type — see `NOTIFICATION_GROUPS`. */}
            <Accordion
              type="multiple"
              value={openGroups}
              onValueChange={setOpenGroups}
              className="w-full min-w-0"
            >
              {/* Team — persisted, per-user notifications (read state on the server). */}
              <AccordionItem value="team" className="border-0 px-2">
                {/* The action is a SIBLING of the trigger, never a child: the trigger
                    is a real <button>, and a button inside a button is invalid markup
                    (the parser hoists it out on hydration). The shared chevron is
                    hidden and drawn after the action, so the fold control still sits
                    at the far right. */}
                <div className="flex w-full min-w-0 items-center gap-2 px-2">
                  <div className="min-w-0 flex-1">
                    <AccordionTrigger className="w-full gap-2 py-1.5 hover:no-underline [&>svg]:hidden">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <UserPlus className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className={SECTION_LABEL_CLASS}>Team</span>
                      </span>
                    </AccordionTrigger>
                  </div>
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="shrink-0 text-[10px] font-medium text-accent-blue hover:underline"
                    >
                      Mark all read
                    </button>
                  ) : appNotifications.length > 0 ? (
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                      {appNotifications.length}
                    </span>
                  ) : null}
                  <SectionFoldToggle
                    label="Team"
                    open={openGroups.includes("team")}
                    onToggle={() => toggleGroup("team")}
                  />
                </div>
                <AccordionContent className="pb-2 pt-0">
                  {appNotifications.length === 0 ? (
                    <p className="px-2 text-xs text-muted-foreground">
                      No new team activity.
                    </p>
                  ) : (
                    appNotifications.map((notification) => (
                  // The row and its Delete are SIBLINGS, exactly as the meeting and document rows
                  // are: a button nested inside a `DropdownMenuItem` would also fire the item's
                  // `onSelect`, so deleting one would open it on the way out.
                  <div
                    key={notification.id}
                    className="flex w-full min-w-0 items-start"
                  >
                    <DropdownMenuItem
                      className="flex flex-1 min-w-0 items-start gap-2 p-3 cursor-pointer"
                      onSelect={() => handleNotificationSelect(notification)}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          notification.readAt ? "bg-transparent" : "bg-accent-blue",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm",
                            notification.readAt
                              ? "text-muted-foreground"
                              : "font-medium",
                          )}
                        >
                          {notification.title}
                        </p>
                        {notification.body ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatNotificationWhen(notification.createdAt)}
                        </p>
                      </div>
                    </DropdownMenuItem>
                    {/* Says "Delete", not "Close": this row really goes, and comes back only if
                        something new is addressed to the reader. The meeting and document rows
                        above keep "Close", because those are remarks about live plan state that
                        the next fetch would only recompute. */}
                    <button
                      type="button"
                      aria-label={`Delete notification: ${notification.title}`}
                      title="Delete"
                      onClick={() => removeNotification(notification.id)}
                      className="mr-1 mt-1.5 shrink-0 self-start rounded-md p-1 text-muted-foreground opacity-60 transition-colors hover:bg-black/5 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-white/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                    ))
                  )}
                </AccordionContent>
              </AccordionItem>

              <DropdownMenuSeparator />

              {/* Meetings */}
              <AccordionItem value="meetings" className="border-0 px-2">
                <div className="flex w-full min-w-0 items-center gap-2 px-2">
                  <div className="min-w-0 flex-1">
                    <AccordionTrigger className="w-full gap-2 py-1.5 hover:no-underline [&>svg]:hidden">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CalendarClock className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className={SECTION_LABEL_CLASS}>Meetings</span>
                      </span>
                    </AccordionTrigger>
                  </div>
                  {visibleMeetings.length > 0 && (
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                      {visibleMeetings.length}
                    </span>
                  )}
                  <SectionFoldToggle
                    label="Meetings"
                    open={openGroups.includes("meetings")}
                    onToggle={() => toggleGroup("meetings")}
                  />
                </div>
                <AccordionContent className="pb-2 pt-0">
                  {visibleMeetings.length === 0 ? (
                    <p className="px-2 text-xs text-muted-foreground">
                      No upcoming meetings.
                    </p>
                  ) : (
                    visibleMeetings.map((reminder) => {
                  const tier = MEETING_TIER_STYLES[reminder.reminderStatus];
                  const TierIcon = tier.icon;
                  return (
                    <div
                      key={reminder.id}
                      className="flex w-full min-w-0 items-start"
                    >
                    <DropdownMenuItem
                      className="flex flex-1 min-w-0 flex-col items-start p-3 cursor-pointer"
                      onSelect={() => handleMeetingSelect(reminder)}
                    >
                      <div className="flex w-full min-w-0 items-start gap-2">
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
                            <span className="min-w-0 text-xs text-muted-foreground truncate">
                              {formatMeetingReminderWhen(
                                reminder.dateKey,
                                reminder.time,
                                reminder.timezone,
                                reminder.reminderStatus,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <button
                      type="button"
                      aria-label={`Close notification: ${reminder.title}`}
                      title="Close"
                      onClick={() => dismiss(meetingNotificationKey(reminder))}
                      className="mr-1 mt-1.5 shrink-0 self-start rounded-md p-1 text-muted-foreground opacity-60 transition-colors hover:bg-black/5 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-white/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    </div>
                  );
                  })
                )}
                </AccordionContent>
              </AccordionItem>

              <DropdownMenuSeparator />

              {/* Documents */}
              <AccordionItem value="documents" className="border-0 px-2">
                <div className="flex w-full min-w-0 items-center gap-2 px-2">
                  <div className="min-w-0 flex-1">
                    <AccordionTrigger className="w-full gap-2 py-1.5 hover:no-underline [&>svg]:hidden">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className={SECTION_LABEL_CLASS}>Documents</span>
                      </span>
                    </AccordionTrigger>
                  </div>
                  {visibleDocuments.length > 0 && (
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                      {visibleDocuments.length}
                    </span>
                  )}
                  <SectionFoldToggle
                    label="Documents"
                    open={openGroups.includes("documents")}
                    onToggle={() => toggleGroup("documents")}
                  />
                </div>
                <AccordionContent className="pb-2 pt-0">
                  {visibleDocuments.length === 0 ? (
                    <p className="px-2 text-xs text-muted-foreground">
                      No expiring documents.
                    </p>
                  ) : (
                    visibleDocuments.map((document) => {
                  const tier = DOCUMENT_TIER_STYLES[document.status];
                  const TierIcon = tier.icon;
                  return (
                    <div
                      key={document.id}
                      className="flex w-full min-w-0 items-start"
                    >
                    <DropdownMenuItem
                      className="flex flex-1 min-w-0 flex-col items-start p-3 cursor-pointer"
                      onSelect={() => handleDocumentSelect(document)}
                    >
                      <div className="flex w-full min-w-0 items-start gap-2">
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
                            <span className="min-w-0 text-xs text-muted-foreground truncate">
                              {formatDocumentExpirationWhen(
                                document.dateKey,
                                document.status,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <button
                      type="button"
                      aria-label={`Close notification: ${document.title}`}
                      title="Close"
                      onClick={() => dismiss(documentNotificationKey(document))}
                      className="mr-1 mt-1.5 shrink-0 self-start rounded-md p-1 text-muted-foreground opacity-60 transition-colors hover:bg-black/5 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-white/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    </div>
                  );
                  })
                )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
