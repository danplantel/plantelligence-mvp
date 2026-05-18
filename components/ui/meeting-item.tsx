import { Badge } from "@/components/ui/badge";
import { formatUsDate } from "@/lib/date";
import { Clock, Calendar } from "lucide-react";

interface MeetingItemProps {
  title: string;
  date: string;
  time: string;
  timezone?: string;
  type: string;
}

export function MeetingItem({ title, date, time, timezone, type }: MeetingItemProps) {
  const formatDate = (dateString: string) => {
    return formatUsDate(dateString);
  };

  const formatTime = (timeString: string, timezone?: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const timezoneLabel = timezone ? 
      (timezone === 'America/New_York' ? 'ET' :
       timezone === 'America/Chicago' ? 'CT' :
       timezone === 'America/Denver' ? 'MT' :
       timezone === 'America/Los_Angeles' ? 'PT' :
       timezone === 'America/Anchorage' ? 'AT' :
       timezone === 'Pacific/Honolulu' ? 'HT' : '') : '';
    return `${hour12}:${minutes} ${ampm}${timezoneLabel ? ` (${timezoneLabel})` : ''}`;
  };

  return (
    <div className="flex items-center justify-between bg-muted/50 rounded h-16 px-3">
      <div className="space-y-1.5">
        <div className="text-sm font-light">{title}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 font-light">
          <div className="flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDate(date)}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatTime(time, timezone)}
          </div>
        </div>
      </div>
      <Badge
        variant="outline"
        className="border-2 border-gray-300 bg-gray-50 text-gray-700"
      >
        {type}
      </Badge>
    </div>
  );
}
