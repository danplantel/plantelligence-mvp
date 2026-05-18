import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Eye, Download, TrendingUp, BarChart2 } from "lucide-react";
import { useEffect, useState } from "react";

type InsightData = {
  videoViews: number;
  docDownloads: number;
  engagementRate: number;
  engagementChange: number;
};

export function InsightsPanel() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch("/api/insights");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch insights", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, []);

  const isEmpty =
    !data || (!data.videoViews && !data.docDownloads && !data.engagementRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-6 text-accent-blue" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 min-h-[150px] flex flex-col justify-center">
        {loading ? (
          <div className="w-full space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-2 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center text-muted-foreground gap-1 select-none">
            <BarChart2 className="size-6" />
            <p className="text-sm">No insights available</p>
            <p className="text-center max-w-sm text-xs">
              Once users start engaging with your materials, you&apos;ll see
              insights here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded">
                <div className="flex items-center justify-center gap-1 text-accent-blue mb-1">
                  <Eye className="size-6" />
                  <span className="text-lg font-bold">{data.videoViews}</span>
                </div>
                <p className="text-xs text-muted-foreground font-light">
                  Video Views
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded">
                <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                  <Download className="size-6" />
                  <span className="text-lg font-bold">{data.docDownloads}</span>
                </div>
                <p className="text-xs text-muted-foreground font-light">
                  Doc Downloads
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Engagement Rate</span>
                <span className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="size-6" />+{data.engagementChange}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-accent-blue h-2 rounded-full"
                  style={{ width: `${data.engagementRate}%` }}
                ></div>
              </div>
            </div>
            <Button variant="outline" className="w-full bg-transparent" asChild>
              <a href="/insights">
                <BarChart3 className="mr-2 size-6" />
                View Full Dashboard
              </a>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
