import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, FileText, ExternalLink, Inbox } from "lucide-react";
import { useEffect, useState } from "react";

export function MarketingPanel() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarketing() {
      try {
        const res = await fetch("/api/marketing");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch marketing data", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMarketing();
  }, []);

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <Megaphone className="size-6 text-accent-blue" />
          Marketing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 min-h-[150px] flex flex-col justify-center items-center">
        {loading ? (
          <div className="w-full space-y-3">
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground select-none">
            <Inbox className="size-6" />
            <p className="text-sm">No marketing data available</p>
            <p className="text-center max-w-xs text-xs">
              There are no marketing materials to show yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3 w-full">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/new/marketing#portal">
                <FileText className="mr-2 size-6" />
                Flyers & Posters
                <Badge variant="secondary" className="ml-auto">
                  PDF Templates
                </Badge>
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/new/marketing#announcements">
                <Megaphone className="mr-2 size-6" />
                Announcement Banners
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/new/marketing#qr">
                <ExternalLink className="mr-2 size-6" />
                QR Codes / Links
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
