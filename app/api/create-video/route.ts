import { NextResponse } from "next/server";
import axios from "axios";
import prisma from "@/lib/prisma";
import { ObjectId } from "mongodb";
import { HEYGEN_API_KEY } from "@/constants/app";
import { buildHeygenVideoInputs } from "@video-steps/video-inputs";

interface FormDataItem {
  name: string;
  value: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const formDataArray: FormDataItem[] = Array.from(formData.entries()).map(
      ([name, value]) => ({
        name,
        value: value.toString(),
      }),
    );

    const reqBody = formDataArray.reduce(
      (acc, { name, value }) => {
        acc[name] = value;
        return acc;
      },
      {} as { [key: string]: string },
    );


    const {
      script,
      clientName,
      clientColor,
      image,
      userId,
      planId, // Add planId to extract from request
      automaticEnrollmentPercentage,
      automaticEnrollmentWaitPeriod,
      automaticIncreaseCap,
      automaticIncreasePercentage,
      recordKeeperName,
      recordKeeperPhone,
      recordKeeperWebsite,
      matchPercent,
      vestingPeriod,
    } = reqBody;

    if (
      !script ||
      !clientName ||
      !clientColor ||
      // !image ||
      !userId ||
      !automaticEnrollmentPercentage ||
      !automaticEnrollmentWaitPeriod ||
      !automaticIncreaseCap ||
      !automaticIncreasePercentage ||
      !recordKeeperName ||
      !recordKeeperPhone ||
      !recordKeeperWebsite ||
      !matchPercent ||
      !vestingPeriod
      // Add other fields
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Try to get API key from environment variable directly as fallback
    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;
    
    if (!apiKey) {
      console.error("HEYGEN_API_KEY is not set");
      console.error("Environment check:", {
        hasEnvVar: !!process.env.HEYGEN_API_KEY,
        envVarLength: process.env.HEYGEN_API_KEY?.length || 0,
        hasConstant: !!HEYGEN_API_KEY,
        constantLength: HEYGEN_API_KEY?.length || 0,
      });
      return NextResponse.json(
        { 
          error: "HeyGen API key is not configured. Please set HEYGEN_API_KEY in your .env file and restart the server." 
        },
        { status: 500 },
      );
    }

    // Get avatar ID and voice ID from request (should be passed from step 2)
    const avatarId = reqBody.avatarId || "Daisy-inskirt-20220818"; // Default avatar if not provided
    const voiceId = reqBody.voiceId || reqBody.selectedVoice || "elevenlabs-premium-01"; // Default to recommended ElevenLabs voice

    // Use planId if provided, otherwise fallback to userId (for backward compatibility)
    const planIdToUse = planId || userId;
    if (!planIdToUse) {
      return NextResponse.json(
        { error: "planId or userId is required" },
        { status: 400 },
      );
    }
    
    // Validate that planId is a valid ObjectId format
    if (!ObjectId.isValid(planIdToUse)) {
      return NextResponse.json(
        { error: "Invalid planId format" },
        { status: 400 },
      );
    }


    // Get webhook URL from environment or construct it
    const baseUrl = process.env.NEXTAUTH_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/videos/heygen-webhook`;

    // HeyGen API v2 payload structure according to documentation
    // https://docs.heygen.com/reference/create-an-avatar-video-v2
    const placeholderVideoInputs = buildHeygenVideoInputs({
      defaultAvatarId: avatarId,
      defaultVoiceId: voiceId,
      fallbackColor: clientColor || "#1F3A60",
    });

    if (placeholderVideoInputs.length > 0) {
      placeholderVideoInputs.forEach((scene, index) => {
        
      });
    } else {
      
    }

    const payload = {
      video_inputs:
        placeholderVideoInputs.length > 0
          ? placeholderVideoInputs
          : [
              {
                character: {
                  type: "avatar",
                  avatar_id: avatarId,
                  avatar_style: "normal",
                },
                voice: {
                  type: "text",
                  input_text: script,
                  voice_id: voiceId, // Use selected voice from step 2
                },
                background: {
                  type: "color",
                  value: clientColor || "#1F3A60",
                },
              },
            ],
      dimension: {
        width: 1280,
        height: 720,
      },
      caption: "false", // Disable captions by default
      // Add callback_url for webhook if needed (HeyGen will call this URL with status updates)
      // callback_url: webhookUrl,
    };

    
    // Use correct HeyGen API v2 endpoint
    const endpoint = "https://api.heygen.com/v2/video/generate";
    
    
    const heygenResponse = await axios.post(
      endpoint,
      payload,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      },
    );
    
    
    
    const videoData = heygenResponse.data;
    
    // HeyGen API response structure: { data: { video_id: "..." } }
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

    // Note: Webhook should be registered separately using /api/videos/register-webhook
    // This ensures webhook is registered once and reused for all videos
    // Webhook endpoint: /api/videos/heygen-webhook

    // Always create a new video to allow multiple videos per plan
    const planObjectId = new ObjectId(planIdToUse) as any;
    
    
    // Check if videos already exist for this planId
    const existingVideos = await prisma.video.findMany({
      where: {
        planId: planObjectId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    
    if (existingVideos.length > 0) {
    } else {
    }

    const videoCreateData: any = {
      planId: planObjectId,
      title: `Plan Details for ${clientName}`,
      description: "A personalized video based on your plan selections.",
      videoProvider: 'heygen',
      videoProviderId: videoId,
      videoStatus: 'in_progress',
      data: videoData || {},
    };

    // Only include videoUrl if it exists
    if (validVideoUrl) {
      videoCreateData.videoUrl = validVideoUrl;
    } else {
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
      error.response?.data?.message || 
      error.response?.data?.error?.message ||
      error.response?.data?.error ||
      error.message || 
      "Error creating video";
    
    console.error("Final error message:", errorMessage);
    console.error("Full error response:", JSON.stringify(error.response?.data, null, 2));
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.response?.data 
    }, { status: 500 });
  }
}

// import { NextResponse } from 'next/server';
// import axios from 'axios';
// import prisma from '@/lib/prisma';

// interface FormDataItem {
//     name: string;
//     value: string;
// }

// export async function POST(request: Request) {
//     try {
//         const formData = await request.formData();
//         const formDataArray: FormDataItem[] = Array.from(formData.entries()).map(([name, value]) => ({
//             name,
//             value: value.toString()
//         }));

//         const reqBody = formDataArray.reduce((acc, { name, value }) => {
//             acc[name] = value;
//             return acc;
//         }, {} as { [key: string]: string });

//         const {
//             script,
//             clientName,
//             clientColor,
//             image,
//             userId,
//             automaticEnrollmentPercentage,
//             automaticEnrollmentWaitPeriod,
//             automaticIncreaseCap,
//             automaticIncreasePercentage,
//             recordKeeperName,
//             recordKeeperPhone,
//             recordKeeperWebsite,
//         } = reqBody;

//         if (
//             !script ||
//             !clientName ||
//             !clientColor ||
//             !userId ||
//             !automaticEnrollmentPercentage ||
//             !automaticEnrollmentWaitPeriod ||
//             !automaticIncreaseCap ||
//             !automaticIncreasePercentage ||
//             !recordKeeperName ||
//             !recordKeeperPhone ||
//             !recordKeeperWebsite
//         ) {
//             return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
//         }

//         const synthesiaApiKey = process.env.NEXT_PUBLIC_SYNTHESIA_API_KEY;
//         const templateId = generateTemplateId(reqBody);

//         let payload = {
//             templateId,
//             title: `Plan Details for ${clientName}`,
//             description: 'A personalized video based on your plan selections.',
//             script,
//             branding: {
//                 primary_color: clientColor,
//             },
//             templateData: {
//                 automatic_enrollment_percentage: automaticEnrollmentPercentage,
//                 automatic_enrollment_wait_period: automaticEnrollmentWaitPeriod,
//                 automatic_increase_cap: automaticIncreaseCap,
//                 automatic_increase_percentage: automaticIncreasePercentage,
//                 record_keeper_name: recordKeeperName,
//                 record_keeper_phone: recordKeeperPhone,
//                 record_keeper_website: recordKeeperWebsite,
//             },
//         };
//         if (image) payload.branding.logo = image;

//         const synthesiaResponse = await axios.post(
//             'https://api.synthesia.io/v2/videos/fromTemplate',
//             payload,
//             {
//                 headers: {
//                     Authorization: synthesiaApiKey,
//                     'Content-Type': 'application/json',
//                 },
//             }
//         );

//         const videoData = synthesiaResponse.data;

//         const newVideo = await prisma.video.create({
//             data: {
//                 userId,
//                 title: videoData.title,
//                 data: videoData.data || [],
//                 clientColor,
//             },
//         });

//         return NextResponse.json(newVideo);
//     } catch (error: any) {
//         const errorMessage = error.response?.data?.message || 'Error creating video';
//         return NextResponse.json({ error: errorMessage }, { status: 500 });
//     }
// }

// function generateTemplateId(reqBody: { [key: string]: string }): string {
//     let identifier = `${reqBody.planType?.toLowerCase()}-all-sections`;

//     if (reqBody.entryDates === "Immediate") {
//         identifier += "-no-waiting-period";
//     } else if (reqBody.entryDates === "Custom") {
//         identifier += "-custom-waiting-period";
//     } else if (reqBody.entryDates === "Advanced") {
//         identifier += "-advanced-waiting-period";
//     } else if (reqBody.entryDates === "Full Custom") {
//         identifier += "-full-custom-waiting-period";
//     }

//     if (reqBody.automaticEnrollment) {
//         identifier += "-with-automatic-enrollment";
//     } else {
//         identifier += "-no-automatic-enrollment";
//     }

//     if (reqBody.matchPlan === "Yes") {
//         identifier += "-with-matching-contributions";
//     } else {
//         identifier += "-no-matching-contributions";
//     }

//     if (reqBody.matchSafe === "Yes") {
//         identifier += "-safe-harbor-plan";
//     }

//     if (reqBody.nonElective === "Yes") {
//         identifier += "-non-elective-contributions";
//     }

//     if (reqBody.showAdvancedDeferrals) {
//         identifier += "-advanced-deferrals";
//     }

//     if (reqBody.vestingScheduleRadio !== "default") {
//         identifier += `-${reqBody.vestingScheduleRadio}`;
//     }

//     return identifier;
// }
