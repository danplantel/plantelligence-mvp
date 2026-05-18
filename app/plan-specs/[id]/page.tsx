"use client"

import PlanSpecs from "@/components/pages/plan-specs";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function page() {
  return (
    <ScrollArea className="h-full bg-[white] text-[black]">
      <div className="flex justify-center items-center">
        <PlanSpecs />
      </div>
    </ScrollArea>
  );
}
