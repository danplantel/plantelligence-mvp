"use client";
import React, { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { useParams } from "next/navigation";
import { useEducationPlans } from "@/lib/education-video";
import { listEducationPlans } from "../content-library";
import { Icons } from "@/components/icons";
import { useTheme } from "next-themes";
import { videos } from "@/constants/data";
import { Briefcase, KeyIcon } from "lucide-react";
import axios from "axios";

interface VideoItem {
  videoUrl?: string;
  title: string;
  image: string;
  data: Array<{
    icon?: React.ElementType;
    title: string;
    subTitle: string;
    email?: string;
    website?: string;
    phone: string;
    planId?: string;
    image: string;
  }>;
}

interface CurrentVideo {
  id: string;
  title: string;
  videoUrl: string;
  clientColor?: string;
  logo: string;
  status: string;
}

interface EducationPlanItem {
  value: string;
  label: string;
  subLabel: string;
  image: string;
  icon?: keyof typeof Icons;
  placeholderTitle?: string;
}

const SynthesiaVideo = () => {
  const { theme = 'system' } = useTheme();
  const params = useParams();
  const selectedEducationPlans = useEducationPlans();
  const id = params?.id;
  const [currentVideo, setCurrentVideo] = useState<CurrentVideo | null>(null);
  const [displayRight, setDisplayRight] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [activePlan, setActivePlan] = useState("");

  const listSelectedEducationPlans = listEducationPlans.filter((item) =>
    selectedEducationPlans.includes(item.value),
  ) as EducationPlanItem[];

  useEffect(() => {
    const fetchVideo = async () => {
      setIsLoading(true);
      try {
        const responseVideo = await axios.get("/api/videos/get-detail-video", {
          params: {
            id,
          },
        });

        const videoData = responseVideo?.data?.data;
        if (videoData) {
          setCurrentVideo({
            id: videoData.id,
            title: videoData.title,
            videoUrl: videoData?.synthesia?.download,
            clientColor: videoData?.clientColor,
            logo: "",
            status: videoData?.synthesia?.status,
          });
        }
      } catch (error) {
        console.error("Error fetching video:", error);
      }
      setIsLoading(false);
    };

    fetchVideo();
  }, [id]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!currentVideo) {
    return <div>Video Not found</div>;
  }

  if (currentVideo?.status === "in_progress") {
    return (
      <div className="py-[80px]">
        <img
          className="max-w-[300px] block mx-auto"
          src="/images/project_complete.svg"
          alt=""
        />
        <p className="text-center text-[28px] mt-[16px]">Video In Progress</p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto md:mx-8">
      <div
        className={`flex items-start flex-col lg:!flex-row ${
          displayRight ? "gap-[20px]" : "gap-[20px]"
        }`}
      >
        <div className="w-full mt-3 mb-4 md:mt-0">
          <video className="w-full h-full" controls autoPlay muted>
            <source
              src={currentVideo.videoUrl}
              type="video/mp4"
            />
          </video>
          <Separator />
          <div className="flex md:items-center justify-between mt-[12px] mb-[8px] flex-col md:!flex-row items-start gap-[12px]">
            <div className="inline-flex flex-1 gap-[8px] items-center">
              <img
                src={
                  currentVideo.logo ||
                  "https://img.freepik.com/free-photo/education-day-arrangement-table-with-copy-space_23-2148721266.jpg"
                }
                alt="Logo"
                className="w-[60px] object-cover rounded-[4px]"
              />
              <p className="font-bold text-[24px] md:text-[18px] truncate max-w-[320px] md:max-w-none">
                {currentVideo.title || "Default Title"}
              </p>
            </div>
            <div className="flex justify-center gap-[8px] ml-2 md:ml-0">
              <Link href={"/"} target="_blank">
                <div className=" text-[12px] cursor-pointer underline text-[#959595]">
                  View in Spanish (En Español)
                </div>
              </Link>
            </div>
          </div>
          <Separator />
        </div>
        <div
          className={`${
            displayRight ? "w-full lg:w-[30%]" : "w-full lg:w-[30%]"
          }`}
        >
          <Separator />
          <div className="inline-flex items-center justify-between w-full mt-[12px]">
            <p className="font-bold text-md">Education</p>
            {listSelectedEducationPlans.length > 0 && (
              <p
                className="cursor-pointer text-[14px] md:text-[12px] underline text-[#959595]"
                onClick={() => setDisplayRight(!displayRight)}
              >
                {displayRight ? "Hide" : "Show"}
              </p>
            )}
          </div>
          {displayRight && (
            <div className="mt-[12px] w-full overflow-auto max-h-[500px] md:max-h-[860px]">
              {listSelectedEducationPlans.map((item, index) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.arrowRight;
                return (
                  <div
                    className="flex items-center w-full gap-[12px] p-[2px] rounded-[4px] cursor-pointer mb-[12px]"
                    key={index}
                    onClick={() => setActivePlan(item.label)}
                  >
                    <div className="aspect-video relative w-[60%] flex gap-[0px] rounded-[4px] border-solid border-[1px] border-gray-200 shadow-sm dark:border-[#1a1a1a] overflow-hidden">
                      <div
                        className="text-[10px] leading-tight uppercase w-[54%] text-semibold text-center bg-black dark:bg-white text-white flex items-center justify-center p-[8px]"
                        style={{ backgroundColor: currentVideo?.clientColor }}
                      >
                        {item.placeholderTitle}
                      </div>
                      <div className="flex items-center justify-center flex-1 bg-white">
                        <Icon
                          className="w-[50px] h-[50px]"
                          style={{ color: currentVideo?.clientColor }}
                        />
                      </div>
                      {activePlan === item.label && (
                        <>
                          <div className="absolute w-full h-full rounded-[8px] flex items-center justify-center backdrop-blur-[2px] bg-white/20" />
                          <Icons.play className="absolute text-white transform -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2" />
                        </>
                      )}
                    </div>
                    <div className="w-[40%]">
                      <p className="font-bold leading-tight text-[18px] md:text-[14px]">
                        {item.label}
                      </p>
                      <p className="text-[16px] md:text-[12px] text-[#959595]">
                        {item.subLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Separator className="mt-[12px]" />
      <div className="mt-[24px] text-[#959595]">
        <p className="text-[12px]">
          This material was created for educational and informational purposes
          only and is not intended as ERISA, tax, legal or investment advice. If
          you are seeking investment advice specific to your needs, such advice
          services must be obtained on your own separate from this educational
          material. Information has been obtained from sources believed to be
          reliable but is not guaranteed as to accuracy. Please refer to the
          Summary Plan Description for more information.
        </p>
        <p className="text-[12px] mt-2">
          Securities and advisory services offered through LPL Financial, a
          registered investment advisor, Member
          <a
            href="https://www.finra.org"
            target="_blank"
            className="ml-1 text-blue-400"
          >
            FINRA/SIPC
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default SynthesiaVideo;