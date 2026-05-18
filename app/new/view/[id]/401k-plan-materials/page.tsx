"use client";

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

export default function PlanMaterialsPage() {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#DAC287";

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

            <div className="grid grid-cols-1 gap-x-[16px] gap-y-[24px] md:grid-cols-2 lg:grid-cols-3">
              {documents.map((item, index) => (
                <AnimatedSection
                  key={item}
                  delay={0.1 * index}
                  parallaxFactor={0.08}
                >
                  <div
                    className="border-b-[4px] bg-white pt-[10px] px-[15px] pb-[30px] lg:h-[260px] lg:p-[30px]"
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
                    <p className="dm-serif mt-[20px] text-[20px] font-medium text-black lg:text-[24px]">
                      {item}
                    </p>
                    <div
                      className="mt-[20px] flex items-center"
                      style={{ color: secondaryColor }}
                    >
                      <span className="font-medium uppercase">Download</span>
                      <ArrowRight />
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>

        <PlanMaterialsFooter />
      </PageFade>
    </ScrollArea>
  );
}

const documents = [
  "Enrollment Booklet",
  "Enrollment Worksheet",
  "Qualified Default Investment Alternative Notice",
  "Automatic Enrollment Contribution Notice",
  "Participant Fee Disclosure",
  "Beneficiary Form",
  "Incoming Rollover Form",
  "Summary Plan Description",
  "Summary Annual Report",
];
