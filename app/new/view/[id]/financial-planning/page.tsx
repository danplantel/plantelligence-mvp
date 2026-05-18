"use client";

import { PlanMaterialsFooter } from "@/components/pages/client-portal/sections/plan-materials-footer";
import {
  AnimatedSection,
  RevealText,
} from "@/components/pages/view-video/ViewPlanVideo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { PageFade } from "@/components/animations/page-fade";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  Book,
  CalendarCheck,
  ChevronsRight,
  DraftingCompass,
  Fingerprint,
  Map,
  SquareCheckBig,
} from "lucide-react";

export default function FinancialPlanningPage() {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";
  const companyName = clientData?.companyName || "Your Company Name";

  return (
    <ScrollArea className="h-full">
      <PageFade>
        <div className="bg-[url(/plan-subpage/financial_planning_process_header_sm.jpg)] bg-cover bg-center">
          <div className="bg-black/40 lg:px-[16px] lg:pb-[80px] lg:pt-[140px]">
            <motion.div
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
              }}
              className="mx-auto max-w-[1047px] bg-black/50 px-[16px] py-[50px] text-white md:px-[40px]"
            >
              <h1 className="dm-serif text-center text-[48px] font-dm-serif font-medium leading-[1.1]">
                Exclusive Benefits for{" "}
                <span style={{ color: secondaryColor }}>
                  {companyName} 401(k) Profit Sharing Plan and Trust
                </span>{" "}
                Participants
              </h1>
              <p
                className="mt-[20px] text-center text-[24px] font-red-hat leading-[1.1]"
                style={{ color: secondaryColor }}
              >
                Elevate your financial journey with Waypoint Financial Advisors’
                all-inclusive financial planning services, seamlessly integrated
                into your existing retirement benefits.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="relative bg-[#f2f2f2] px-[16px]">
          <div className="absolute inset-0 bg-[url(/plan-subpage/circle-1bg.png)] bg-no-repeat" />
          <div className="relative mx-auto max-w-[1260px] py-[50px] lg:py-[60px]">
            <AnimatedSection delay={0.1} parallaxFactor={0.08}>
              <RevealText className="dm-serif pb-[20px] text-center text-[24px] font-medium">
                Financial Planning: Our Signature Process
              </RevealText>
            </AnimatedSection>

            <AnimatedSection delay={0.1} parallaxFactor={0.08}>
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, x: -100 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.2,
                  }}
                >
                  <img src="/plan-subpage/consultation-1024x683.jpg" alt="" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 100 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.3,
                  }}
                  className="flex items-center pt-5 lg:pl-[10%] lg:pt-0"
                >
                  <div>
                    <h3 className="dm-serif text-[24px] font-medium sm:text-[32px] lg:text-[40px]">
                      Exploration
                    </h3>
                    <div className="mt-[16px] flex justify-between">
                      <Fingerprint
                        className="h-[20px] w-[20px]"
                        style={{ color: brandColor }}
                      />
                      <div className="mt-[-2px] w-[calc(100%-28px)]">
                        <p className="font-semibold font-red-hat">
                          LISTEN to You.
                        </p>
                        <p className="mt-[4px] font-red-hat">
                          Our first step is to learn as much as we can about you
                          — your goals, values and unique life situation. Our
                          role is to listen carefully, ask good questions and
                          fully understand what you want to accomplish in life.
                        </p>
                      </div>
                    </div>
                    <div className="mt-[16px] flex justify-between">
                      <Book
                        className="h-[20px] w-[20px]"
                        style={{ color: brandColor }}
                      />
                      <div className="mt-[-2px] w-[calc(100%-28px)]">
                        <p className="font-semibold font-red-hat">
                          CONFIRM Your Financials.
                        </p>
                        <p className="mt-[4px] font-red-hat">
                          Once we understand your life goals, we will work
                          together to gain a complete picture of your current
                          financial life, making sure we are on the same page
                          and ready to move forward.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
                <img
                  src="/plan-subpage/financial-planning-goals-sm-1-1024x713.jpg"
                  alt=""
                  className="mt-5 lg:hidden"
                />
                <motion.div
                  initial={{ opacity: 0, x: -100 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.2,
                  }}
                  className="flex items-center pt-5 lg:pr-[10%] lg:pt-0"
                >
                  <div>
                    <h3 className="dm-serif text-[24px] font-medium sm:text-[32px] lg:text-[40px]">
                      Setting a path
                    </h3>
                    <div className="mt-[16px] flex justify-between">
                      <Map
                        className="h-[20px] w-[20px]"
                        style={{ color: brandColor }}
                      />
                      <div className="mt-[-2px] w-[calc(100%-28px)]">
                        <p className="font-semibold font-red-hat">
                          DEVELOP Your Plan.
                        </p>
                        <p className="mt-[4px] font-red-hat">
                          With your goals and current financial picture in mind,
                          we can now develop a personalized financial plan that
                          will help you overcome your financial challenges and
                          pursue your goals.
                        </p>
                      </div>
                    </div>
                    <div className="mt-[16px] flex justify-between">
                      <CalendarCheck
                        className="h-[20px] w-[20px]"
                        style={{ color: brandColor }}
                      />
                      <div className="mt-[-2px] w-[calc(100%-28px)]">
                        <p className="font-semibold font-red-hat">
                          EDUCATE You About Your Plan.
                        </p>
                        <p className="mt-[4px] font-red-hat">
                          Once we&apos;ve developed your plan, we help you
                          understand your strategy and make you aware of any
                          strengths or weaknesses in your financial situation.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 100 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.3,
                  }}
                  className="hidden lg:block"
                >
                  <img
                    src="/plan-subpage/financial-planning-goals-sm-1-1024x713.jpg"
                    alt=""
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -100 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.2,
                  }}
                  className="mt-5 lg:mt-0"
                >
                  <img
                    src="/plan-subpage/financial-planning-map1-sm-1-1024x713.jpg"
                    alt=""
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 100 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.3,
                  }}
                  className="mt-5 flex items-center pl-0 lg:pl-[10%]"
                >
                  <div>
                    <h3 className="dm-serif text-[24px] font-medium sm:text-[32px] lg:text-[40px]">
                      Staying the course
                    </h3>
                    <div className="mt-[16px] flex justify-between">
                      <SquareCheckBig
                        className="h-[20px] w-[20px]"
                        style={{ color: brandColor }}
                      />
                      <div className="mt-[-2px] w-[calc(100%-28px)]">
                        <p className="font-semibold font-red-hat">
                          IMPLEMENT Your Plan.
                        </p>
                        <p className="mt-[4px] font-red-hat">
                          After getting educated about your plan, you are now
                          ready to implement. Together, we will work on
                          overcoming any challenges you may face along the way.
                        </p>
                      </div>
                    </div>
                    <div className="mt-[16px] flex justify-between">
                      <DraftingCompass
                        className="h-[20px] w-[20px]"
                        style={{ color: brandColor }}
                      />
                      <div className="mt-[-2px] w-[calc(100%-28px)]">
                        <p className="font-semibold font-red-hat">
                          MONITOR and Adjust Your Plan as Necessary.
                        </p>
                        <p className="mt-[4px] font-red-hat">
                          Because your life is always evolving and changing,
                          your financial plan will need to evolve and change
                          too. We will meet on a regular basis and continually
                          monitor your progress.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </AnimatedSection>
          </div>
        </div>

        <div className="px-[16px]">
          <AnimatedSection delay={0.1} parallaxFactor={0.08}>
            <div className="mx-auto flex max-w-[1260px] !flex-col items-center lg:!flex-row lg:py-[40px]">
              <motion.div
                initial={{ opacity: 0, x: -100 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.2,
                }}
                className="relative z-10 hidden w-full rounded-none px-[50px] py-[80px] text-white lg:mr-[-5%] lg:block lg:w-[45%]"
                style={{ backgroundColor: secondaryColor }}
              >
                <p className="dm-serif text-[40px] font-medium leading-tight">
                  Understanding your financial future begins here!
                </p>
                <Button
                  className="mt-[20px] h-[42px] rounded-[4px] text-[16px] uppercase"
                  style={{ backgroundColor: brandColor, color: "#fff" }}
                >
                  Register or login here
                  <ChevronsRight />
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 100 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.3,
                }}
                className="z-0 w-full lg:w-[60%]"
              >
                <img
                  className="w-full"
                  src="/plan-subpage/waypoint_sailing_sm-1024x713.jpg"
                  alt=""
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -100 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.2,
                }}
                className="relative z-10 order-[-1] w-full px-[20px] py-[60px] text-white lg:order-none lg:hidden"
                style={{ backgroundColor: secondaryColor }}
              >
                <p className="dm-serif text-[24px] font-medium leading-tight sm:text-[32px]">
                  Understanding your financial future begins here!
                </p>
                <Button
                  className="mt-[20px] h-[42px] rounded-[4px] text-[12px] font-red-hat uppercase sm:text-[14px]"
                  style={{ backgroundColor: brandColor, color: "#fff" }}
                >
                  Register or login here
                  <ChevronsRight />
                </Button>
              </motion.div>
            </div>
          </AnimatedSection>
        </div>

        <PlanMaterialsFooter />
      </PageFade>
    </ScrollArea>
  );
}
