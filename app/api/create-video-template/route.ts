import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import prisma from "@/lib/prisma";
import { ObjectId } from "mongodb";
import { HEYGEN_API_KEY } from "@/constants/app";

interface TemplateVideoRequest {
  userId: string;
  clientName: string;
  clientColor: string;
  avatarId: string;
  voiceId: string;
  templateId: string;
  script?: string;
  templateData: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: TemplateVideoRequest = await request.json();


    if (
      !body.userId ||
      !body.clientName ||
      !body.avatarId ||
      !body.voiceId ||
      !body.templateId
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      console.error("HEYGEN_API_KEY is not set");
      return NextResponse.json(
        { error: "HeyGen API key not configured" },
        { status: 500 },
      );
    }

    // HeyGen v2 template endpoint
    // https://docs.heygen.com/docs/generate-video-from-template-v2-1
    const payload = {
      caption: false,
      title: `Plan Details for ${body.clientName}`,
      test: false, // Set to false for production
      variables: buildTemplateVariables(body.templateData),
    };


    const heygenResponse = await axios.post(
      `https://api.heygen.com/v2/template/${body.templateId}/generate`,
      payload,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );


    const videoData = heygenResponse.data;
    const videoId = videoData?.data?.video_id || videoData?.video_id;

    if (!videoId) {
      console.error("❌ HeyGen response missing video_id");
      console.error("Full response:", JSON.stringify(videoData, null, 2));
      return NextResponse.json(
        { error: "Failed to get video ID from HeyGen response" },
        { status: 500 },
      );
    }

    // Extract videoUrl from response if available
    const heygenData = videoData?.data || videoData;
    const videoUrl = 
      heygenData?.video_url || 
      heygenData?.url ||
      heygenData?.download_url ||
      heygenData?.video ||
      heygenData?.download ||
      heygenData?.result?.video_url ||
      heygenData?.result?.url ||
      null;

    // Only use videoUrl if it's valid (starts with http)
    const validVideoUrl = videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('http') 
      ? videoUrl 
      : null;

    if (validVideoUrl) {
    } else {
    }

    // Save to database
    const planObjectId = new ObjectId(body.userId) as any;


    // Build update/create data conditionally
    const videoUpdateData: any = {
      title: `Plan Details for ${body.clientName}`,
      description: "A personalized template video based on your plan selections.",
      videoProvider: "heygen",
      videoProviderId: videoId,
      videoStatus: "in_progress",
      thumbnail: null,
      image: null,
      data: videoData || {},
    };

    // Only include videoUrl if it exists
    if (validVideoUrl) {
      videoUpdateData.videoUrl = validVideoUrl;
    } else {
    }

    const videoCreateData: any = {
      planId: planObjectId,
      title: `Plan Details for ${body.clientName}`,
      description: "A personalized template video based on your plan selections.",
      videoProvider: "heygen",
      videoProviderId: videoId,
      videoStatus: "in_progress",
      data: videoData || {},
    };

    // Only include videoUrl if it exists
    if (validVideoUrl) {
      videoCreateData.videoUrl = validVideoUrl;
    }


    // Always create a new video instead of upsert to allow multiple videos per plan
    const newVideo = await prisma.video.create({
      data: videoCreateData,
    });


    return NextResponse.json({
      ...newVideo,
      debug: {
        videoId,
        videoUrl: validVideoUrl,
        planId: planObjectId.toString(),
        savedVideoId: newVideo.id,
        savedVideoProviderId: newVideo.videoProviderId,
        savedVideoUrl: newVideo.videoUrl,
      },
    });
  } catch (error: any) {
    console.error("Error creating template video:", error);

    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if (error.request) {
      console.error("Error request:", error.request);
    } else {
      console.error("Error message:", error.message);
    }

    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error?.message ||
      error.response?.data?.error ||
      error.message ||
      "Error creating template video";

    console.error("Final error message:", errorMessage);
    console.error(
      "Full error response:",
      JSON.stringify(error.response?.data, null, 2),
    );

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.response?.data,
      },
      { status: 500 },
    );
  }
}

/**
 * Build HeyGen template variables from old Synthesia templateData structure
 * Maps old field names to HeyGen template variable names
 */
function buildTemplateVariables(templateData: Record<string, any>): Record<string, {
  name: string;
  type: string;
  properties: any;
}> {
  // HeyGen template API expects variables in this format:
  // {
  //   "variable_name": {
  //     "name": "Variable Display Name",
  //     "type": "text" | "image" | "video" | "avatar",
  //     "properties": { /* type-specific properties */ }
  //   }
  // }
  
  const variables: Record<string, any> = {};

  // Map all text fields from old structure
  const textFields = [
    "plan_type",
    "plan_name",
    "plan_id",
    "age_requirement",
    "eligibility_requirement",
    "entry_date",
    "primary_contribution_title",
    "primary_contribution_detail1",
    "primary_contribution_detail2",
    "primary_contribution_vesting",
    "secondary_contribution_title",
    "secondary_contribution_detail1",
    "secondary_contribution_detail2",
    "secondary_contribution_vesting",
    "enrollment_option",
    "enrollment_option1",
    "enrollment_option2",
    "enrollment_option3",
    "enrollment_option4",
    "enrollment_option5",
    "plan_feature1",
    "plan_feature2",
    "plan_feature3",
    "plan_feature4",
    "plan_feature5",
    "plan_feature6",
    "plan_feature7",
    "match_category",
    "match_line1",
    "match_line2",
    "vesting_schedule",
    "ps_type",
    "ps_eligibility_title",
    "ps_eligibility_req",
    "ps_entry_title",
    "ps_entry_date",
    "ps_vesting_title",
    "ps_vesting",
    "ne_entry_title",
    "ne_entry_date",
    "ne_vesting_title",
    "ne_vesting",
    "ne_type",
    "ne_eligibility_title",
    "ne_eligibility_req",
    "investments",
    "contact1_title",
    "contact1_name",
    "contact1_email",
    "contact1_phone",
    "contact2_title",
    "contact2_name",
    "contact2_email",
    "contact2_phone",
    "contact3_title",
    "contact3_name",
    "contact3_email",
    "contact3_phone",
    "disclaimer",
  ];

  // Add disclaimer lines
  for (let i = 1; i <= 24; i++) {
    textFields.push(`disclaimer_line${i}`);
  }

  textFields.forEach((field) => {
    if (templateData[field] !== undefined) {
      variables[field] = {
        name: field,
        type: "text",
        properties: {
          content: String(templateData[field] || "-"),
        },
      };
    }
  });

  // Handle image fields if present
  if (templateData.logo) {
    variables.logo = {
      name: "logo",
      type: "image",
      properties: {
        url: templateData.logo,
        fit: "contain",
      },
    };
  }

  if (templateData.bg) {
    variables.bg = {
      name: "bg",
      type: "image",
      properties: {
        url: templateData.bg,
        fit: "cover",
      },
    };
  }

  if (templateData.qr) {
    variables.qr = {
      name: "qr",
      type: "image",
      properties: {
        url: templateData.qr,
        fit: "contain",
      },
    };
  }

  // Handle avatar if specified in template
  if (templateData.avatar) {
    variables.avatar = {
      name: "avatar",
      type: "avatar",
      properties: {
        avatar_id: templateData.avatar,
      },
    };
  }

  return variables;
}

