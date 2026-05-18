"use client";

import { useState, useEffect } from "react";
import { Bell, AlertTriangle, Clock, Calendar } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ExpiringDocument {
  id: string;
  title: string;
  client: {
    id: string;
    companyName: string;
  };
  expirationDate: string;
  daysUntilExpiration: number;
  status: "expiring_week" | "expiring_2days" | "expiring_today";
}

export function DocumentExpirationNotifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<ExpiringDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/documents/expiring");
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setNotifications(result.data || []);
          }
        }
      } catch (error) {
        console.error("Error fetching expiring documents:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const totalCount = notifications.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "expiring_today":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "expiring_2days":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "expiring_week":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string, days: number) => {
    switch (status) {
      case "expiring_today":
        return "Expires today";
      case "expiring_2days":
        return `Expires in ${days} day${days !== 1 ? "s" : ""}`;
      case "expiring_week":
        return `Expires in ${days} day${days !== 1 ? "s" : ""}`;
      default:
        return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "expiring_today":
        return "text-red-600 bg-red-50 border-red-200";
      case "expiring_2days":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "expiring_week":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "";
    }
  };

  const handleDocumentClick = (doc: ExpiringDocument) => {
    const searchParams = new URLSearchParams({
      company: doc.client.companyName,
    });
    router.push(`/new/documents?${searchParams.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 hover:bg-gray-100 transition-colors"
        >
          <Bell className="h-5 w-5 text-gray-700" />
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
          <div className="flex items-center justify-between">
            <span className="font-semibold">Document Expiration Alerts</span>
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalCount}
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No expiring documents</p>
            <p className="text-xs mt-1">
              You&apos;ll receive alerts when documents are expiring soon
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((doc) => (
              <DropdownMenuItem
                key={doc.id}
                className="flex flex-col items-start p-3 cursor-pointer"
                onClick={() => handleDocumentClick(doc)}
              >
                <div className="flex items-start gap-2 w-full">
                  {getStatusIcon(doc.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.client.companyName}
                    </p>
                    <div
                      className={cn(
                        "mt-1 text-xs px-2 py-0.5 rounded border inline-block",
                        getStatusColor(doc.status),
                      )}
                    >
                      {getStatusText(doc.status, doc.daysUntilExpiration)}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/new/documents")}
            >
              <span className="text-sm">View all documents</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
