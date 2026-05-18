"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  Book,
  CalendarCheck,
  ChevronsRight,
  DraftingCompass,
  Fingerprint,
  Map,
  SquareCheckBig,
} from "lucide-react";
import Footer from "../401k-plan-materials/Footer";
import {
  AnimatedSection,
  RevealText,
} from "@/components/pages/view-video/ViewPlanVideo";

export default function page() {
  return (
    <ScrollArea className="h-full">
      <div className="bg-[url(/plan-subpage/financial_planning_process_header_sm.jpg)] bg-cover bg-center">
        <div className="bg-black/40 lg:pt-[140px] lg:pb-[80px] lg:px-[16px]">
          <motion.div
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.2,
            }}
            className="mx-auto max-w-[1047px] px-[16px] md:px-[40px] py-[50px] bg-black/50 text-white"
          >
            <h1 className="dm-serif text-[24px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-medium text-center leading-[1.1]">
              Exclusive Benefits for{" "}
              <span className="text-[#DAC287]">
                [Your Company Name] 401(k) Profit Sharing Plan and Trust
              </span>{" "}
              Participants
            </h1>
            <p className="mt-[20px] text-[#DAC287] text-[20px] md:text-[22px] lg:text-[24px] text-center leading-[1.1]">
              Elevate your financial journey with Waypoint Financial Advisors’
              all-inclusive financial planning services, seamlessly integrated
              into your existing retirement benefits.
            </p>
          </motion.div>
        </div>
      </div>
      <div className="relative bg-[#f2f2f2] px-[16px]">
        <div className="absolute inset-0 bg-[url(/plan-subpage/circle-1bg.png)] bg-no-repeat"></div>
        <div className="relative mx-auto max-w-[1260px] lg:py-[60px] py-[50px]">
          <AnimatedSection delay={0.1} parallaxFactor={0.08}>
            <RevealText className="dm-serif text-[24px] text-center font-medium pb-[20px]">
              Financial Planning: Our Signature Process
            </RevealText>
          </AnimatedSection>
          <AnimatedSection delay={0.1} parallaxFactor={0.08}>
            <div className="grid lg:grid-cols-2 grid-cols-1">
              <img src="/plan-subpage/consultation-1024x683.jpg" alt="" />
              <div className="flex items-center pt-5 lg:pl-[10%] lg:pt-0">
                <div>
                  <h3 className="dm-serif text-[24px] sm:text-[32px] lg:text-[40px] font-medium">
                    Exploration
                  </h3>
                  <div className="mt-[16px] flex justify-between">
                    <Fingerprint className="w-[20px] h-[20px] text-[#DAC287]" />
                    <div className="mt-[-2px] w-[calc(100%-28px)]">
                      <p className="font-semibold">LISTEN to You.</p>
                      <p className="mt-[4px]">
                        Our first step is to learn as much as we can about you —
                        your goals, values and unique life situation. Our role
                        is to listen carefully, ask good questions and fully
                        understand what you want to accomplish in life.
                      </p>
                    </div>
                  </div>
                  <div className="mt-[16px] flex justify-between">
                    <Book className="w-[20px] h-[20px] text-[#DAC287]" />
                    <div className="mt-[-2px] w-[calc(100%-28px)]">
                      <p className="font-semibold">CONFIRM Your Financials.</p>
                      <p className="mt-[4px]">
                        Once we understand your life goals, we will work
                        together to gain a complete picture of your current
                        financial life, making sure we are on the same page and
                        ready to move forward.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <img
                src="/plan-subpage/financial-planning-goals-sm-1-1024x713.jpg"
                alt=""
                className="lg:hidden mt-5"
              />
              <div className="flex items-center pt-5 lg:pr-[10%] lg:pt-0">
                <div>
                  <h3 className="dm-serif text-[24px] sm:text-[32px] lg:text-[40px] font-medium">
                    Setting a path
                  </h3>
                  <div className="mt-[16px] flex justify-between">
                    <Map className="w-[20px] h-[20px] text-[#DAC287]" />
                    <div className="mt-[-2px] w-[calc(100%-28px)]">
                      <p className="font-semibold">DEVELOP Your Plan.</p>
                      <p className="mt-[4px]">
                        With your goals and current financial picture in mind,
                        we can now develop a personalized financial plan that
                        will help you overcome your financial challenges and
                        pursue your goals.
                      </p>
                    </div>
                  </div>
                  <div className="mt-[16px] flex justify-between">
                    <CalendarCheck className="w-[20px] h-[20px] text-[#DAC287]" />
                    <div className="mt-[-2px] w-[calc(100%-28px)]">
                      <p className="font-semibold">
                        EDUCATE You About Your Plan.
                      </p>
                      <p className="mt-[4px]">
                        Once we’ve developed your plan, we help you understand
                        your strategy and make you aware of any strengths or
                        weaknesses in your financial situation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <img
                src="/plan-subpage/financial-planning-goals-sm-1-1024x713.jpg"
                alt=""
                className="hidden lg:block"
              />
              <img
                src="/plan-subpage/financial-planning-map1-sm-1-1024x713.jpg"
                alt=""
                className="mt-5 lg:mt-0"
              />
              <div className="flex items-center pl-0 mt-5 lg:pl-[10%]">
                <div>
                  <h3 className="dm-serif text-[24px] sm:text-[32px] lg:text-[40px] font-medium">
                    Staying the course
                  </h3>
                  <div className="mt-[16px] flex justify-between">
                    <SquareCheckBig className="w-[20px] h-[20px] text-[#DAC287]" />
                    <div className="mt-[-2px] w-[calc(100%-28px)]">
                      <p className="font-semibold">IMPLEMENT Your Plan.</p>
                      <p className="mt-[4px]">
                        After getting educated about your plan, you are now
                        ready to implement. Together, we will work on overcoming
                        any challenges you may face along the way.
                      </p>
                    </div>
                  </div>
                  <div className="mt-[16px] flex justify-between">
                    <DraftingCompass className="w-[20px] h-[20px] text-[#DAC287]" />
                    <div className="mt-[-2px] w-[calc(100%-28px)]">
                      <p className="font-semibold">
                        MONITOR and Adjust Your Plan as Necessary.
                      </p>
                      <p className="mt-[4px]">
                        Because your life is always evolving and changing, your
                        financial plan will need to evolve and change too. We
                        will meet on a regular basis and continually monitor
                        your progress. We will help you identify potential
                        changes as challenges arise so that you can feel
                        confident that you are continuing to make progress
                        pursuing your financial goals.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
      <div className="px-[16px]">
        <AnimatedSection delay={0.1} parallaxFactor={0.08}>
          <div className="mx-auto max-w-[1260px] lg:py-[40px] flex items-center !flex-col lg:!flex-row">
            <div className="relative bg-[#28334e] px-[50px] py-[80px] w-full lg:w-[45%] lg:mr-[-5%] hidden lg:block">
              <p className="dm-serif text-[40px] font-medium text-white leading-tight">
                Understanding your financial future begins here!
              </p>
              <Button className="mt-[20px] h-[42px] rounded-[4px] text-[16px] uppercase bg-[#dac287] text-black">
                Register or login here
                <ChevronsRight />
              </Button>
            </div>
            <div className="w-full lg:w-[60%]">
              <img
                className="w-full"
                src="/plan-subpage/waypoint_sailing_sm-1024x713.jpg"
                alt=""
              />
            </div>
            <div className="relative bg-[#28334e] px-[20px] py-[60px] w-full lg:hidden">
              <p className="dm-serif text-[24px] sm:text-[32px] font-medium text-white leading-tight">
                Understanding your financial future begins here!
              </p>
              <Button className="mt-[20px] h-[42px] rounded-[4px] text-[12px] sm:text-[14px] uppercase bg-[#dac287] text-black">
                Register or login here
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </div>
      <Footer />
    </ScrollArea>
  );
}
