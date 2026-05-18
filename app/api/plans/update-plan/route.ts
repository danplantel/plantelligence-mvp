import { SYNTHESIA_API_KEY, SYNTHESIA_TEMPLATE_ID } from "@/constants/app";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { InfoTypes } from "@/types/InfoTypes";
import axios from "axios";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Auth required");
  }

  const body: InfoTypes & { id: string } = await req.json();
  const id = body?.id;
  try {
    let payload = {
      templateId: SYNTHESIA_TEMPLATE_ID,
      title: `Plan Details for ${body.clientName}`,
      // title: `Shimano Plan Details`,
      description: "A personalized video based on your plan selections.",
      script: body.script,
      branding: {
        primary_color: body.videoThemeColor,
      },
      templateData: {
        automatic_enrollment_percentage: body.automaticEnrollmentPercentage,
        automatic_enrollment_wait_period: body.automaticEnrollmentWaitPeriod,
        automatic_increase_cap: body.automaticIncreaseCap,
        automatic_increase_percentage: body.automaticIncreasePercentage,
        record_keeper_name: body.recordKeeperName,
        record_keeper_phone: body.recordKeeperPhone,
        record_keeper_website: body.recordKeeperWebsite,
        match_percent: body?.matchPercentage,
        vesting_period:
          body.vestingScheduleRadio !== "default"
            ? body.vestingScheduleRadio
            : "Immediate",

        company_match_percentage: body.matchPercentage,
        company_match_amount: body.matchType,
        non_elective_contribution_percent: body.nonElectivePercentage,
        profit_sharing_percent: body.profitSharingPercentage,
        entry_date_period: body.entryDates,
        percentage_limit: body.automaticIncreaseCap,
        discretionary_or_non_discretionary: body.nonElectiveType,
      },
    };

    const synthesiaResponse = await axios.post(
      "https://api.synthesia.io/v2/videos/fromTemplate",
      payload,
      {
        headers: {
          Authorization: SYNTHESIA_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    const videoData = synthesiaResponse.data;

    // const result = await prisma.$transaction(async (prisma) => {
    // });
    const idQuery = /^\d+$/g.test(id)
      ? {
        idIndex: +id,
        user: {
          email: session?.user?.email || "",
        },
      }
      : {
        id: new ObjectId(body.id) as any,
        user: {
          email: session?.user?.email || "",
        },
      };

    await prisma.plan.updateMany({
      where: idQuery,
      data: {
        clientName: body?.clientName,
        clientLogo: body?.clientLogo as string,
        videoThemeColor: body?.videoThemeColor,
        videoAvatar: body?.videoAvatar,
        videoBackgroundMusic: body?.videoBackgroundMusic,
        videoBackgroundImage: body?.videoBackgroundImage as string,
        buildSpanishVideo: body?.buildSpanishVideo,
      },
    });
    await prisma.plan.updateMany({
      data: {
        clientName: body?.clientName,
        clientLogo: body?.clientLogo as string,
        videoThemeColor: body?.videoThemeColor,
        videoAvatar: body?.videoAvatar,
        videoBackgroundMusic: body?.videoBackgroundMusic,
        videoBackgroundImage: body?.videoBackgroundImage as string,
        buildSpanishVideo: body?.buildSpanishVideo,
      },
    });
    await prisma.plan.updateMany({
      where: idQuery,
      data: {
        recordkeeper: body?.recordkeeper,
        recordKeeperId: body?.recordKeeperId,
        companyName: body?.companyName,
        addressCode: body?.addressCode,
        companyContact: body?.companyContact,
        contactName: body?.contactName,
        displayAdvisorInfoHeader: body?.displayAdvisorInfoHeader,
        educationalVideos: body?.educationalVideos,
        email: body?.email,
        isDisplayRecodeKeeper: body?.isDisplayRecodeKeeper,
        onlineEnrollment: body?.onlineEnrollment,
        phoneNumber: body?.phoneNumber,
        phoneNumberExtension: body?.phoneNumberExtension,
        planAdvisor: body?.planAdvisor,
        planDocumentsLinks: body?.planDocumentsLinks,
        providerLogo: body?.providerLogo,
        providerName: body?.providerName,
        providerPhoneNumber: body?.providerPhoneNumber,
        providerPhoneNumberExtension: body?.providerPhoneNumberExtension,
        recordKeeperPhoneExtension: body?.recordKeeperPhoneExtension,
        title: body?.title,
        tpa: body?.tpa,
        tpaEmail: body?.tpaEmail,
        tpaName: body?.tpaName,
        tpaPhoneNumber: body?.tpaPhoneNumber,
        tpaPhoneNumberExtension: body?.tpaPhoneNumberExtension,
        website: body?.website,
      } as any,
    });

    await prisma.video.updateMany({
      where: {
        plan: idQuery,
      },
      data: {
        title: videoData.title,
        description: videoData.description,
        videoProvider: "synthesia",
        videoProviderId: videoData.id,
        videoStatus: "in_progress",
        data: videoData.data || [],
      },
    });

    const result = { result: "success" };

    return NextResponse.json({
      message: "Plan saved successfully",
      data: result,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}
