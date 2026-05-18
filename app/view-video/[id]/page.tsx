"use client";

import { ViewPlanVideo } from "@/components/pages/view-video/ViewPlanVideo";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function page() {
  return (
    <ScrollArea className="h-full">
      <div className="flex-1 p-4 pt-6 space-y-4 md:p-8">
        <ViewPlanVideo />
      </div>
    </ScrollArea>
  );
}
