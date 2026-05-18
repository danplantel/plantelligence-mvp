import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MeetingItem } from "@/components/ui/meeting-item";
import { Calendar, CalendarX2 } from "lucide-react";
import { useEffect, useState } from "react";

type Meeting = {
  id: string;
  meeting: string;
  meetingType: string;
  date: string;
  time: string;
  timezone?: string;
  status: string;
};

export function MeetingsPanel() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch("/api/meetings");
        const json = await res.json();

        if (json.success) {
          // Filter scheduled and in-progress meetings and sort by date
          const upcomingMeetings = json.data
            .filter((meeting: Meeting) => {
              const isCorrectStatus =
                meeting.status === "Scheduled" ||
                meeting.status === "In Progress";
              const meetingDate = new Date(meeting.date);
              const now = new Date();
              const isUpcoming = meetingDate >= now;

              // Show "In Progress" meetings regardless of date, but "Scheduled" only if upcoming
              if (meeting.status === "In Progress") {
                return true;
              }
              return isCorrectStatus && isUpcoming;
            })
            .sort(
              (a: Meeting, b: Meeting) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            )
            .slice(0, 3); // Get only 3 nearest meetings

          setMeetings(upcomingMeetings);
        } else {
          setMeetings([]);
        }
      } catch (error) {
        console.error("Failed to fetch meetings", error);
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    }

    fetchMeetings();

    // Auto-refresh every 5 minutes to update meeting statuses
    const interval = setInterval(fetchMeetings, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="size-6 text-accent-blue" />
          Meetings & Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 min-h-[150px] flex flex-col justify-center">
        {loading ? (
          <div className="w-full space-y-3">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center text-muted-foreground gap-1 select-none">
            <CalendarX2 className="size-6" />
            <p className="text-sm">No meetings scheduled yet</p>
            <p className="text-center max-w-sm text-xs">
              You don&apos;t have any upcoming meetings or events.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                Upcoming (Next 3)
              </div>
              <div className="space-y-2">
                {meetings.map((meeting) => (
                  <MeetingItem
                    key={meeting.id}
                    title={meeting.meeting}
                    date={meeting.date}
                    time={meeting.time}
                    timezone={meeting.timezone}
                    type={meeting.meetingType}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <Button
          className="w-full bg-accent-blue font-semibold text-white mt-4"
          asChild
        >
          <a href="/new/meetings/create">
            <Calendar className="mr-2 size-6" />
            Create Meeting/Event
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
