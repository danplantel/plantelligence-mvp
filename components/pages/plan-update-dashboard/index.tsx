"use client";

import Branding from "@/components/pages/create-dashboard-old/steps/Branding";
import PlanDetails from "@/components/pages/create-dashboard-old/steps/PlanDetails";
import Eligibility from "@/components/pages/create-dashboard-old/steps/Eligibility";
import MatchingVesting from "@/components/pages/create-dashboard-old/steps/MatchingVesting";
import Resources from "@/components/pages/create-dashboard-old/steps/Resources";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { videos } from "@/constants/data";
import type { InfoTypes } from "@/types/InfoTypes";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "sonner";

export const PlanUpdateDashboard = () => {
  const [info, setInfo] = useState<InfoTypes>({});
  const [activeTab, setActiveTab] = useState("branding");
  const { id } = useParams();
  const router = useRouter();
  const [isLoading, setLoading] = useState(true);
  const planId = +(id || 0) - videos?.length;

  useEffect(() => {
    const fetchPlanData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/plans/get-detail-plan`, {
          params: { id: planId },
        });
        setInfo(response?.data?.data?.rawData);
      } catch (error) {
        console.error("Error fetching plan data:", error);
      }
      setLoading(false);
    };

    fetchPlanData();
  }, [id]);

  const handleUpdateInfo = async (info: Partial<InfoTypes>) => {
    setInfo((prev) => ({ ...prev, ...info }));
  };

  const handleSaveData = async (finalInfo: InfoTypes) => {
    try {
      const payload = { ...info, ...finalInfo };
      if (payload?.clientLogo instanceof File) {
        const uploadRes = await axios.postForm(`/api/files/upload`, {
          file: payload?.clientLogo,
        });
        payload.clientLogo = uploadRes?.data?.url;
      }
      if (payload?.videoBackgroundImage instanceof File) {
        const uploadRes = await axios.postForm(`/api/files/upload`, {
          file: payload?.videoBackgroundImage,
        });
        payload.videoBackgroundImage = uploadRes?.data?.url;
      }
      const response = await axios.patch(`/api/plans/update-plan`, {
        ...payload,
        id: planId,
      });
      router.push(`/dashboard`);
      toast.success("Update plan successfully");
    } catch (error) {
      console.error("handleSaveData.update", error);
      toast.error("Update plan failed");
    }
  };

  if (isLoading) {
    return (
      <div className="h-[300px] flex justify-center items-center">
        <AiOutlineLoading3Quarters className="text-[40px] animate-spin" />
      </div>
    );
  }

  // Helper functions for step completion
  const handleStepComplete = (nextTab: string) => {
    setActiveTab(nextTab);
  };

  return (
    <div className="w-full pt-[20px]">
      <Tabs onValueChange={(value) => setActiveTab(value)} value={activeTab}>
        <TabsList className="flex items-center justify-between w-full overflow-x-auto">
          <TabsTrigger value="branding" className="w-full">
            Branding
          </TabsTrigger>
          <TabsTrigger value="planDetails" className="w-full">
            Plan Details
          </TabsTrigger>
          <TabsTrigger value="eligibility" className="w-full">
            Eligibility
          </TabsTrigger>
          <TabsTrigger value="matchingVesting" className="w-full">
            Matching & Vesting
          </TabsTrigger>
          <TabsTrigger value="resources" className="w-full">
            Resources
          </TabsTrigger>
        </TabsList>

        <div className="mt-[20px] w-full">
          <TabsContent value="branding">
            <Branding
              setActiveTab={() => handleStepComplete("planDetails")}
              updateInfo={handleUpdateInfo}
              info={info}
            />
          </TabsContent>

          <TabsContent value="planDetails">
            <PlanDetails
              updateInfo={handleUpdateInfo}
              info={info}
              onComplete={() => handleStepComplete("eligibility")}
            />
          </TabsContent>

          <TabsContent value="eligibility">
            <Eligibility
              updateInfo={handleUpdateInfo}
              info={info}
              onComplete={() => handleStepComplete("matchingVesting")}
            />
          </TabsContent>

          <TabsContent value="matchingVesting">
            <MatchingVesting
              updateInfo={handleUpdateInfo}
              info={info}
              onComplete={() => handleStepComplete("resources")}
            />
          </TabsContent>

          <TabsContent value="resources">
            <Resources
              updateInfo={handleUpdateInfo}
              info={info}
              onComplete={handleSaveData}
            />
          </TabsContent>
        </div>
        <p className="mt-[18px] text-center text-[12px] text-[#959595]">
          It may take 5-10 minutes for the video to process.
        </p>
      </Tabs>
    </div>
  );
};
