"use client";

import { useMemo } from "react";
import {
  AnimatedSection,
  RevealText,
} from "@/components/pages/view-video/ViewPlanVideo";
import { PlanMaterialsFooter } from "@/components/pages/client-portal/sections/plan-materials-footer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PageFade } from "@/components/animations/page-fade";
import { useClientPortal } from "@/contexts/client-portal-context";
import { Skeleton } from "@/components/ui/skeleton";

interface PortalDocument {
  id: string;
  title: string;
  fileName: string;
  fileUrl?: string;
  storageKey?: string;
  type?: string;
  shortDescription?: string;
  language?: string;
  category?: string;
  uploadedAt: string | Date;
}

export default function PlanMaterialsPage() {
  const { clientData, loading } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#DAC287";

  // Documents come from the client portal context (fetched via /api/clients/[id]?forPortal=1)
  const documents: PortalDocument[] = (clientData?.documents as PortalDocument[]) ?? [];
  const isLoading = loading;

  // Build a map: for each document title, find the ES version
  const esDocByTitle = useMemo(() => {
    const map = new Map<string, PortalDocument>();
    if (!documents.length) return map;
    documents.forEach((doc) => {
      if ((doc.language ?? "EN") === "ES") {
        map.set(doc.title.toLowerCase(), doc);
      }
    });
    return map;
  }, [documents]);

  // Only show English documents in the grid; Spanish docs are paired via the "Descargar en español" button
  const enDocuments = useMemo(
    () => documents.filter((doc) => (doc.language ?? "EN") === "EN"),
    [documents]
  );

  return (
    <ScrollArea className="h-full">
      <PageFade>
        <div className="bg-[url(/plan-subpage/wp_team_1_sm.jpg)] bg-cover bg-center">
          <div className="bg-black/40 px-0 py-0 pt-0 lg:px-[16px] lg:pb-[80px] lg:pt-[140px]">
            <motion.div
              className="mx-auto flex max-w-[1047px] items-center justify-between bg-black/50 p-[10px] text-white !flex-col lg:!flex-row lg:px-[40px] lg:py-[40px]"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
              }}
            >
              <div className="w-full border-0 p-[10px] lg:w-[60%] lg:border-r lg:border-white">
                <h1 className="dm-serif text-[40px] font-medium">
                  401(k) Plan Materials
                </h1>
                <p className="dm-serif mt-[8px] text-[20px] font-medium">
                  How do I access my account?
                </p>
                <Button
                  className="mt-[20px] h-[42px] rounded-[4px] text-[16px] uppercase"
                  style={{ backgroundColor: brandColor, color: "#fff" }}
                >
                  Register or login here
                </Button>
                <ul className="mt-[20px] list-disc pl-[40px] font-light">
                  <li>Update beneficiaries</li>
                  <li>Request a loan</li>
                  <li>
                    Update your investment options and/or withholding amount
                  </li>
                </ul>
              </div>
              <div className="w-full p-[10px] font-light lg:w-[36%]">
                <p>Recordkeeper Contact information:</p>
                <p>email@recordkeeper.com</p>
                <p>(888) 555-1212</p>
                <p className="mt-[24px]">Employer / HR Contact Information:</p>
                <p>email@company.com</p>
                <p>(877) 555-1234</p>
                <p className="mt-[24px]">Retirement Plan Advisor Contact:</p>
                <p>email@financialadvisory.com</p>
                <p>(888) 555-5555</p>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="relative bg-[#f2f2f2] px-[16px]">
          <div className="absolute inset-0 bg-[url(/plan-subpage/circle-1bg.png)] bg-no-repeat" />
          <div className="relative mx-auto max-w-[1260px] py-[40px] lg:py-[80px]">
            <AnimatedSection delay={0.1} parallaxFactor={0.08}>
              <RevealText className="text-center text-[1.5rem] font-bold uppercase text-black dark:text-black lg:pb-[40px] lg:text-[40px]">
                Your Company Logo
              </RevealText>
            </AnimatedSection>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-x-[16px] gap-y-[24px] md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="border-b-[4px] bg-white pt-[10px] px-[15px] pb-[30px] lg:h-[260px] lg:p-[30px]"
                    style={{ borderBottomColor: brandColor }}
                  >
                    <Skeleton className="h-[45px] w-[45px]" />
                    <Skeleton className="h-6 w-3/4 mt-[20px]" />
                    <div className="mt-[20px] flex flex-col gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : enDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <p className="text-gray-500 text-lg">No plan materials available yet.</p>
                <p className="text-gray-400 text-sm mt-2">Documents will appear here once they are uploaded.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-[16px] gap-y-[24px] md:grid-cols-2 lg:grid-cols-3">
                {enDocuments.map((doc, index) => {
                  const esDoc = esDocByTitle.get(doc.title.toLowerCase());
                  const hasSpanish = !!esDoc && esDoc.id !== doc.id;
                  const docUrl = `/api/documents/${doc.id}/view?t=${doc.uploadedAt}`;
                  return (
                    <AnimatedSection
                      key={doc.id}
                      delay={0.1 * index}
                      parallaxFactor={0.08}
                    >
                      <div
                        className="border-b-[4px] bg-white pt-[10px] px-[15px] pb-[30px] lg:h-[260px] lg:p-[30px] flex flex-col"
                        style={{ borderBottomColor: brandColor }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          height="512"
                          width="512"
                          viewBox="0 0 512 512"
                          className="h-[45px] w-[45px]"
                          style={{ fill: brandColor }}
                        >
                          <path d="m433.798 106.268-96.423-91.222c-10.256-9.703-23.68-15.046-37.798-15.046h-183.577c-30.327 0-55 24.673-55 55v402c0 30.327 24.673 55 55 55h280c30.327 0 55-24.673 55-55v-310.778c0-15.049-6.27-29.612-17.202-39.954zm-29.137 13.732h-74.661c-2.757 0-5-2.243-5-5v-70.364zm-8.661 362h-280c-13.785 0-25-11.215-25-25v-402c0-13.785 11.215-25 25-25h179v85c0 19.299 15.701 35 35 35h91v307c0 13.785-11.215 25-25 25z"></path>
                          <path d="m363 200h-220c-8.284 0-15 6.716-15 15s6.716 15 15 15h220c8.284 0 15-6.716 15-15s-6.716-15-15-15z"></path>
                          <path d="m363 280h-220c-8.284 0-15 6.716-15 15s6.716 15 15 15h220c8.284 0 15-6.716 15-15s-6.716-15-15-15z"></path>
                          <path d="m215.72 360h-72.72c-8.284 0-15 6.716-15 15s6.716 15 15 15h72.72c8.284 0 15-6.716 15-15s-6.716-15-15-15z"></path>
                        </svg>
                        <p className="dm-serif mt-[20px] text-[20px] font-medium text-black lg:text-[24px] min-h-[3.5rem] line-clamp-2">
                          {doc.title}
                        </p>
                        <div className="mt-auto pt-[20px] flex flex-col gap-2">
                          <a
                            href={docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                            style={{ color: secondaryColor }}
                          >
                            <span className="font-medium uppercase">Download</span>
                            <ArrowRight />
                          </a>
                          {hasSpanish && esDoc && (
                            <a
                              href={`/api/documents/${esDoc.id}/view?t=${esDoc.uploadedAt}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                              style={{ color: secondaryColor }}
                            >
                              <span className="font-medium uppercase">Descargar en español</span>
                              <ArrowRight />
                            </a>
                          )}
                        </div>
                      </div>
                    </AnimatedSection>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <PlanMaterialsFooter />
      </PageFade>
    </ScrollArea>
  );
}
