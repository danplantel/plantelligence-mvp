"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { PageFade } from "@/components/animations/page-fade";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { PlanMaterialsFooter } from "@/components/pages/client-portal/sections/plan-materials-footer";

export default function NotFoundPage() {
  const { clientData } = useClientPortal();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const brandColor = clientData?.brandColor || "#C5A15E";
  const companyName = clientData?.companyName || "Waypoint Financial Advisors";

  return (
    <ScrollArea className="h-full">
      <PageFade>
        <section className="relative h-[600px] md:h-[750px] w-full">
          <Image
            src="/plan-subpage/waypoint_sailing_sm-1024x713.jpg"
            alt="Sailing"
            fill
            priority
            className="object-cover"
          />

          <div className="absolute inset-0 bg-black/40" />

          <div className="absolute inset-0 flex flex-col max-w-[1260px] mx-auto items-start justify-center px-4 text-center text-white">
            <h1 className="dm-serif text-[40px] md:text-[56px] lg:text-[64px] font-medium mb-4">
              The page can&apos;t be found
            </h1>

            <p className="font-red-hat text-[18px] md:text-[22px] mb-8 opacity-90">
              It looks like nothing was found at this location.
            </p>

            <Button
              onClick={() => router.push(`/${clientId}`)}
              className="h-[50px] rounded-md px-8 text-[16px] font-red-hat uppercase"
              style={{
                backgroundColor: brandColor,
                color: "#000",
                fontWeight: 600,
              }}
            >
              Go to {companyName} Home Page
            </Button>
          </div>
        </section>
        <PlanMaterialsFooter />
      </PageFade>
    </ScrollArea>
  );
}
