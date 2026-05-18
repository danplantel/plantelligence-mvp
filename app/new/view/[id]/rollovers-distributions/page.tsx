"use client";

import {
  AnimatedSection,
  RevealText,
} from "@/components/pages/view-video/ViewPlanVideo";
import { PlanMaterialsFooter } from "@/components/pages/client-portal/sections/plan-materials-footer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { PageFade } from "@/components/animations/page-fade";
import { useClientPortal } from "@/contexts/client-portal-context";

export default function RolloversDistributionsPage() {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  return (
    <ScrollArea className="h-full">
      <PageFade>
        <div className="bg-[url(/plan-subpage/pexels-brittany-87812.jpg)] bg-cover bg-center">
          <div className="bg-black/40 px-[16px] pb-[80px] pt-[60px] lg:pt-[140px]">
            <motion.div
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
              }}
              className="mx-auto max-w-[1047px] bg-black/50 px-[16px] py-[50px] text-white lg:px-[32px]"
            >
              <h1
                className="dm-serif text-center text-[32px] font-medium leading-[1.1] sm:text-[36px] md:text-[44px] lg:text-[52px]"
                style={{ color: secondaryColor }}
              >
                Rollovers & Distributions
              </h1>
              <p className="mt-[20px] max-w-[927px] mx-auto font-red-hat text-center text-[24px] leading-tight">
                After deciding to change employers, another crucial choice
                arises: what to do with your retirement savings left behind. The
                decision you make regarding this transition could significantly
                impact the size of your nest egg and the quality of your
                retirement lifestyle.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="relative bg-[#f2f2f2] px-[16px]">
          <div className="absolute inset-0 bg-[url(/plan-subpage/circle-1bg.png)] bg-no-repeat" />
          <div className="relative mx-auto max-w-[1260px] py-[80px]">
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
              }}
            >
              <h2 className="dm-serif pb-[40px] text-center text-[40px] font-dm-serif uppercase">
                Understanding Your Choices:
                <br />
                What&apos;s Next for Your Retirement Savings?
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 gap-x-[20px] gap-y-[20px] md:grid-cols-2">
              {options.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: i * 0.1,
                  }}
                >
                  <div
                    className="relative px-[16px] py-[20px] text-white lg:px-[30px] lg:py-[40px]"
                    style={{ backgroundColor: brandColor }}
                  >
                    <div className="absolute right-[40px] text-gray-500/45 top-[20px]">
                      <span className="dm-serif text-[80px] leading-none md:text-[120px]">
                        0{i + 1}
                      </span>
                    </div>
                    <div className="relative z-10 flex h-[100px] flex-col items-start justify-between">
                      <p className="dm-serif text-[20px] font-medium md:text-[24px] lg:text-[28px]">
                        {item}
                      </p>
                      <button
                        className="h-[32px] rounded-[2px] bg-white px-[15px] uppercase text-black transition-all"
                        style={{ color: brandColor }}
                      >
                        explore this option
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[url(/plan-subpage/financial-planning_meeting-scaled.jpg)] bg-cover bg-center">
          <div className="bg-black/60 px-[16px]">
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
              }}
              className="mx-auto max-w-[1047px] py-[50px] text-center text-white lg:px-[32px]"
            >
              <h3 className="dm-serif text-[24px] font-medium md:text-[32px] lg:text-[40px]">
                Need assistance navigating this process?
              </h3>
              <p className="mt-[24px] mx-auto font-red-hat text-center text-base leading-tight">
                We&apos;re here to offer guidance and support, helping you make
                informed decisions that align with your financial goals.
              </p>
              <Button
                className="mx-auto mt-[24px] h-[42px] rounded-[4px] text-[16px] font-red-hat uppercase"
                style={{ backgroundColor: brandColor, color: "#fff" }}
              >
                Schedule Appointment
              </Button>
            </motion.div>
          </div>
        </div>

        <PlanMaterialsFooter />
      </PageFade>
    </ScrollArea>
  );
}

const options = [
  "Rollover to your new employer.",
  "Rollover into an IRA.",
  "Leave the money in the old plan.",
  "Take the money and cash out.",
];
