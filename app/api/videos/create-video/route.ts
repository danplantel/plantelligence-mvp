import { SYNTHESIA_TEMPLATE_ID } from "@/constants/app";
import prisma from "@/lib/prisma";
import axios from "axios";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

interface FormDataItem {
  name: string;
  value: string;
}

interface CreateVideoDto {
  script: string;
  userId: string;
  clientName: string;
  clientColor: string;
  videoParams: {
    automaticEnrollmentPercentage: string;
    automaticEnrollmentWaitPeriod: string;
    automaticIncreaseCap: string;
    automaticIncreasePercentage: string;
    recordKeeperName: string;
    recordKeeperPhone: string;
    recordKeeperWebsite: string;
    matchPercent: string;
    vestingPeriod: string;

    companyMatchPercentage: string;
    companyMatchAmount: string;
    nonElectiveContributionPercent: string;
    profitSharingPercent: string;
    entryDatePeriod: string;
    percentageLimit: string;
    discretionaryOrNonDiscretionary: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateVideoDto = await request.json();

    if (
      !body.script ||
      !body.clientName ||
      !body.clientColor ||
      // !body.image ||
      !body.userId ||
      !body.videoParams
      // Add other fields
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const synthesiaApiKey = process.env.NEXT_PUBLIC_SYNTHESIA_API_KEY;

    const params = body.videoParams;

    let payload = {
      templateId: SYNTHESIA_TEMPLATE_ID,
      title: `Plan Details for ${body.clientName}`,
      // title: `Shimano Plan Details`,
      description: "A personalized video based on your plan selections.",
      script: body.script,
      branding: {
        primary_color: body.clientColor,
      },
      templateData: {
        automatic_enrollment_percentage: params.automaticEnrollmentPercentage,
        automatic_enrollment_wait_period: params.automaticEnrollmentWaitPeriod,
        automatic_increase_cap: params.automaticIncreaseCap,
        automatic_increase_percentage: params.automaticIncreasePercentage,
        record_keeper_name: params.recordKeeperName,
        record_keeper_phone: params.recordKeeperPhone,
        record_keeper_website: params.recordKeeperWebsite,

        match_percent: params.matchPercent,
        vesting_period: params.vestingPeriod,

        company_match_percentage: params.companyMatchPercentage,
        company_match_amount: params.companyMatchAmount,
        non_elective_contribution_percent:
          params.nonElectiveContributionPercent,
        profit_sharing_percent: params.profitSharingPercent,
        entry_date_period: params.entryDatePeriod,
        percentage_limit: params.percentageLimit,
        discretionary_or_non_discretionary:
          params.discretionaryOrNonDiscretionary,
      },
    };
    // if(image) payload.branding.logo = image
    // Call Synthesia API to create the video using the template
    const synthesiaResponse = await axios.post(
      "https://api.synthesia.io/v2/videos/fromTemplate",
      payload,
      {
        headers: {
          Authorization: synthesiaApiKey,
          "Content-Type": "application/json",
        },
      },
    );
    const videoData = synthesiaResponse.data;

    // Save video details to the database
    // const newVideo = await prisma.video.create({
    //   data: {
    //     userId: new ObjectId(body.userId) as any,
    //     title: videoData.title,
    //     description: videoData.description,
    //     videoProvider: "synthesia",
    //     videoProviderId: videoData.id,
    //     data: videoData.data || [],
    //     clientColor: body.clientColor,
    //   },
    // });

    return NextResponse.json({});
  } catch (error: any) {
    console.error("Error creating video:", error);

    // Log error details for better debugging
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if (error.request) {
      console.error("Error request:", error.request);
    } else {
      console.error("Error message:", error.message);
    }

    // Send a detailed error message in the response
    const errorMessage =
      error.response?.data?.message || "Error creating video";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
