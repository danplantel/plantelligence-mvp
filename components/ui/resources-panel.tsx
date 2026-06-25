import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, Inbox } from "lucide-react";
import { useEffect, useState } from "react";

export function ResourcesPanel() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResources() {
      try {
        const res = await fetch("/api/resources");

        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch resources", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchResources();
  }, []);

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <FileText className="size-6 text-accent-blue" />
          Resources
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
            <div className="animate-pulse pt-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground select-none">
            <Inbox className="size-6" />
            <p className="text-sm">No data available</p>
            <p className="text-center max-w-xs text-xs">
              Looks like there&apos;s nothing here yet.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 w-full">
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a href="/clients/contacts">
                  <Users className="mr-2 size-6" />
                  Update Company Contacts
                </a>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a href="/documents/compliance">
                  <FileText className="mr-2 size-6" />
                  Update Plan & Compliance Docs
                </a>
              </Button>
            </div>
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                Keep your client information and compliance documents up to
                date.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
