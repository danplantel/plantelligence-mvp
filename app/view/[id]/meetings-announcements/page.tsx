"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";
import Footer from "../401k-plan-materials/Footer";

export default function page() {
  const [openIndex, setOpenIndex] = useState(-1);

  return (
    <ScrollArea className="h-full">
      <div className="bg-[url(/plan-subpage/Money100s-scaled.jpg)] bg-cover bg-center">
        <div className="bg-black/70 pt-[80px] pb-[100px] px-[16px]">
          <div className="mx-auto max-w-[1047px] lg:px-[40px] text-white">
            <img
              className="mx-auto block w-[204px]"
              src="/plan-subpage/Waypoint-WEB-Logos_185x93.png"
              alt=""
            />
            <h1 className="mt-[20px] dm-serif text-[28px] font-medium text-center">
              Group Sessions & Webinars
            </h1>
            <p className="mt-[12px] text-center">
              Nothing scheduled at this time - please click below to schedule a
              1-on-1 consultation.
            </p>
            <div className="mx-auto mt-[40px] max-w-[550px] p-[16px] md:p-[30px] bg-white text-black">
              <div className="flex items-center">
                <CalendarDays className="w-[35px] h-[35px] mr-[12px] sm:mr-[24px] text-[#dac287]" />
                <span className="dm-serif text-[18px] sm:text-[20px] md:text-[24px] font-medium">
                  15 min one-on-one meeting
                </span>
              </div>
              <p className="mt-[20px] text-[14px] md:text-[16px]">
                Topics to discuss include how to enroll into the 401(k) plan,
                consolidate outside 401(k) plans, review portfolio/investments
                or a personalized financial plan.
              </p>
              <Button className="mt-[20px] h-[42px] rounded-[4px] text-[14px] uppercase bg-[#dac287] text-black font-semibold">
                <span className="hidden sm:inline">CLICK HERE TO </span>RESERVE
                YOUR SPOT
              </Button>
            </div>
            <p className="mt-[80px] dm-serif text-[24px] sm:text-[28px] text-center font-medium leading-[1.1]">
              Announcements & Videos
            </p>
            <div className="mt-[40px] flex justify-center items-center space-x-[16px]">
              {videos?.map((item, i) => (
                <div
                  key={i}
                  className="relative cursor-pointer"
                  onClick={() => setOpenIndex(i)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    width={512}
                    height={512}
                    x="0"
                    y="0"
                    viewBox="0 0 512 512"
                    xmlSpace="preserve"
                    className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[50%] h-[50%]"
                  >
                    <g>
                      <path
                        d="M256 0C114.616 0 0 114.616 0 256s114.616 256 256 256c141.394 0 256-114.616 256-256S397.394 0 256 0zm0 460.8c-112.927 0-204.8-91.873-204.8-204.8S143.073 51.2 256 51.2 460.8 143.073 460.8 256 368.927 460.8 256 460.8z"
                        fill="#ffffff"
                        opacity="1"
                      ></path>
                      <path
                        d="m349.112 238.08-124.15-71.68c-17.07-9.851-31.037-1.792-31.037 17.92v143.36c0 19.712 13.967 27.781 31.037 17.92l124.15-71.68c17.07-9.851 17.07-25.989 0-35.84z"
                        fill="#ffffff"
                        opacity="1"
                      ></path>
                    </g>
                  </svg>
                  <img
                    className="mx-auto block w-[290px]"
                    src={item?.thumbnail}
                    alt=""
                  />
                </div>
              ))}
            </div>
            <Lightbox
              open={openIndex >= 0}
              close={() => setOpenIndex(-1)}
              index={openIndex}
              plugins={[Video]}
              slides={videos?.map((item) => ({
                type: "video",
                width: 1280,
                height: 720,
                poster: item?.thumbnail,
                sources: [
                  {
                    src: item?.video,
                    type: "video/mp4",
                  },
                ],
              }))}
            />
          </div>
        </div>
      </div>
      <Footer hideBackToHome />
    </ScrollArea>
  );
}

const videos = [
  {
    thumbnail:
      "https://waypointfas.com/wp-content/uploads/2024/05/BLACKOUT-NOTICE-_ENGLISH.jpg",
    video:
      "https://waypointfas.com/wp-content/uploads/2024/05/Ayres-FINAL-Blackout-Notice_EV-05.07.25.mp4",
  },
  {
    thumbnail:
      "https://waypointfas.com/wp-content/uploads/2024/05/BLACKOUT-NOTICE-_SPANISH.jpg",
    video:
      "https://waypointfas.com/wp-content/uploads/2024/05/ES-Ayres-FINAL-Blackout-Notice_EV-05.02.25.mp4",
  },
];
