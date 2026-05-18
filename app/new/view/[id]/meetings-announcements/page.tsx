"use client";

import { PlanMaterialsFooter } from "@/components/pages/client-portal/sections/plan-materials-footer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";
import { PageFade } from "@/components/animations/page-fade";
import { useClientPortal } from "@/contexts/client-portal-context";

export default function MeetingsAnnouncementsPage() {
  const [openIndex, setOpenIndex] = useState(-1);
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  return (
    <ScrollArea className="h-full">
      <PageFade>
        <div className="bg-[url(/plan-subpage/Money100s-scaled.jpg)] bg-cover bg-center">
          <div className="bg-black/70 px-[16px] pb-[100px] pt-[80px]">
            <div className="mx-auto max-w-[1047px] text-white lg:px-[40px]">
              <img
                className="mx-auto block w-[204px]"
                src="/plan-subpage/Waypoint-WEB-Logos_185x93.png"
                alt="Waypoint logo"
              />
              <h1 className="dm-serif mt-[20px] text-center text-[28px] font-medium">
                Group Sessions & Webinars
              </h1>
              <p className="mt-[12px] text-center">
                Nothing scheduled at this time - please click below to schedule
                a 1-on-1 consultation.
              </p>
              <div className="mx-auto mt-[40px] max-w-[550px] bg-white p-[16px] text-black md:p-[30px]">
                <div className="flex items-center">
                  <CalendarDays
                    className="mr-[12px] h-[35px] w-[35px] sm:mr-[24px]"
                    style={{ color: brandColor }}
                  />
                  <span className="dm-serif text-[18px] font-medium sm:text-[20px] md:text-[24px]">
                    15 min one-on-one meeting
                  </span>
                </div>
                <p className="mt-[20px] text-[14px] md:text-[16px]">
                  Topics to discuss include how to enroll into the 401(k) plan,
                  consolidate outside 401(k) plans, review portfolio/investments
                  or a personalized financial plan.
                </p>
                <Button
                  className="mt-[20px] h-[42px] rounded-[4px] text-[14px] font-semibold uppercase"
                  style={{ backgroundColor: brandColor, color: "#fff" }}
                >
                  <span className="hidden sm:inline">CLICK HERE TO </span>
                  RESERVE YOUR SPOT
                </Button>
              </div>
              <p className="dm-serif mt-[80px] text-center text-[24px] font-medium leading-[1.1] sm:text-[28px]">
                Announcements & Videos
              </p>
              <div className="mt-[40px] flex flex-wrap items-center justify-center gap-[16px]">
                {videos.map((item, i) => (
                  <button
                    key={item.thumbnail}
                    className="relative cursor-pointer"
                    onClick={() => setOpenIndex(i)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      viewBox="0 0 512 512"
                      className="absolute left-1/2 top-1/2 h-[50%] w-[50%] -translate-x-1/2 -translate-y-1/2"
                    >
                      <g>
                        <path
                          d="M256 0C114.616 0 0 114.616 0 256s114.616 256 256 256c141.394 0 256-114.616 256-256S397.394 0 256 0zm0 460.8c-112.927 0-204.8-91.873-204.8-204.8S143.073 51.2 256 51.2 460.8 143.073 460.8 256 368.927 460.8 256 460.8z"
                          fill="#ffffff"
                        />
                        <path
                          d="m349.112 238.08-124.15-71.68c-17.07-9.851-31.037-1.792-31.037 17.92v143.36c0 19.712 13.967 27.781 31.037 17.92l124.15-71.68c17.07-9.851 17.07-25.989 0-35.84z"
                          fill="#ffffff"
                        />
                      </g>
                    </svg>
                    <img
                      className="mx-auto block w-[290px]"
                      src={item.thumbnail}
                      alt=""
                    />
                  </button>
                ))}
              </div>
              <Lightbox
                open={openIndex >= 0}
                close={() => setOpenIndex(-1)}
                index={openIndex}
                plugins={[Video]}
                slides={videos.map((item) => ({
                  type: "video",
                  width: 1280,
                  height: 720,
                  poster: item.thumbnail,
                  sources: [
                    {
                      src: item.video,
                      type: "video/mp4",
                    },
                  ],
                }))}
              />
            </div>
          </div>
        </div>

        <PlanMaterialsFooter hideBackToHome />
      </PageFade>
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
