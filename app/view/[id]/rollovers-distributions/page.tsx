/* eslint-disable react/no-unescaped-entities */
"use client";

import { AnimatedSection, RevealText } from "@/components/pages/view-video/ViewPlanVideo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import Footer from "../401k-plan-materials/Footer";

export default function page() {
  return (
    <ScrollArea className="h-full">
      <div className="bg-[url(/plan-subpage/pexels-brittany-87812.jpg)] bg-cover bg-center">
        <div className="bg-black/40 pt-[60px] lg:pt-[140px] pb-[80px] px-[16px]">
          <motion.div
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.2,
            }}
            className="mx-auto max-w-[1047px] px-[16px] lg:px-[32px] py-[50px] bg-black/50 text-white"
          >
            <h1 className="dm-serif text-[32px] sm:text-[36px] md:text-[44px] lg:text-[52px] font-medium text-center leading-[1.1] text-[#DAC287]">
              Rollovers & Distributions
            </h1>
            <p className="mt-[20px] text-[18px] lg:text-[22px] text-center leading-tight">
              After deciding to change employers, another crucial choice arises:
              what to do with your retirement savings left behind. The decision
              you make regarding this transition could significantly impact the
              size of your nest egg and the quality of your retirement
              lifestyle.
            </p>
          </motion.div>
        </div>
      </div>
      <div className="relative bg-[#f2f2f2] px-[16px]">
        <div className="absolute inset-0 bg-[url(/plan-subpage/circle-1bg.png)] bg-no-repeat"></div>
        <div className="relative mx-auto max-w-[1260px] py-[80px]">
          <AnimatedSection delay={0.1} parallaxFactor={0.08}>
            <RevealText className="dm-serif text-[20px] md:text-[26px] lg:text-[32px] text-center font-medium pb-[40px] uppercase">
              Understanding Your Choices:
              <br />
              What's Next for Your Retirement Savings?
            </RevealText>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[20px] gap-y-[20px]">
            {[
              "Rollover to your new employer.",
              "Rollover into an IRA.",
              "Leave the money in the old plan.",
              "Take the money and cash out.",
            ]?.map((item, i) => (
              <AnimatedSection delay={0.1} parallaxFactor={0.08} key={i}>
                <div className="relative bg-[#28334e] text-white py-[20px] lg:py-[40px] px-[16px] lg:px-[30px]">
                  <div className="absolute top-[20px] right-[40px] dm-serif text-[80px] md:text-[120px] text-[#39435c] leading-none">
                    0{i + 1}
                  </div>
                  <div className="relative flex flex-col justify-between items-start h-[140px] lg:h-[190px] z-[10]">
                    <p className="dm-serif text-[20px] md:text-[24px] lg:text-[28px] font-medium">
                      {item}
                    </p>
                    <button className="h-[32px] px-[15px] rounded-[2px] bg-white text-black hover:bg-[#DAC287] transition-all uppercase">
                      explore this option
                    </button>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[url(/plan-subpage/financial-planning_meeting-scaled.jpg)] bg-cover bg-center">
        <AnimatedSection delay={0.1} parallaxFactor={0.08}>
          <div className="bg-black/60 px-[16px]">
            <div className="mx-auto max-w-[1047px]lg:px-[32px] py-[50px] text-white text-center">
              <h3 className="dm-serif text-[24px] md:text-[32px] lg:text-[40px] font-medium text-center">
                Need assistance navigating this process?
              </h3>
              <p className="mt-[24px] text-[16px] text-center leading-tight">
                We’re here to offer guidance and support, helping you make
                informed decisions that align with your financial goals.
              </p>
              <Button className="mx-auto mt-[24px] h-[42px] rounded-[4px] text-[16px] uppercase bg-[#dac287] text-black">
                Schedule Appointment
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </div>
      <Footer />
    </ScrollArea>
  );
}
