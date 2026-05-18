import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ObjectId } from "mongodb";

export const dynamic = 'force-dynamic';

/**
 * Webhook endpoint for HeyGen video status updates
 * Handles events: avatarvideo.success, avatarvideo.fail, avatarvideo.processing
 * Documentation: https://docs.heygen.com/docs/using-heygens-webhook-events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    

    const { event_type, event_data } = body;

    // Handle different event types
    if (event_type === "avatarvideo.success" || event_type === "avatarvideo.processing") {
      const videoId = event_data?.video_id;
      
      // Try multiple possible locations for video_url in webhook data
      const videoUrl = 
        event_data?.video_url || 
        event_data?.url ||
        event_data?.download_url ||
        event_data?.video ||
        event_data?.download ||
        event_data?.result?.video_url ||
        event_data?.result?.url;
      
      const status = event_type === "avatarvideo.success" ? "completed" : "in_progress";
      const progress = event_data?.progress || event_data?.progress_percent;

      if (!videoId) {
        console.error("Webhook missing video_id");
        return NextResponse.json({ error: "Missing video_id" }, { status: 400 });
      }

      

      // Find video by videoProviderId (HeyGen video_id)
      const video = await prisma.video.findFirst({
        where: {
          videoProviderId: videoId,
          videoProvider: "heygen",
        },
      });

      if (video) {
        // Update video status and URL
        const updateData: any = {
          videoStatus: status,
          data: {
            ...(video.data as any || {}),
            webhook_event: event_type,
            webhook_data: event_data,
            progress: progress,
            updated_at: new Date().toISOString(),
          },
        };
        
        // Only update videoUrl if it's provided and valid
        if (videoUrl && videoUrl !== "null" && !videoUrl.includes("null") && videoUrl.startsWith("http")) {
          updateData.videoUrl = videoUrl;
          updateData.videoStatus = "completed"; // Always set to completed if we have a URL
        }
        
        // Use video.id to update only this specific video
        await prisma.video.update({
          where: {
            id: video.id,
          },
          data: updateData,
        });

        
      } else {
        console.warn(`Video ${videoId} not found in database`);
      }

      return NextResponse.json({ success: true, message: "Webhook processed" });
    } 
    
    else if (event_type === "avatarvideo.fail") {
      const videoId = event_data?.video_id;
      const errorMessage = event_data?.msg || event_data?.message || "Video generation failed";

      if (!videoId) {
        console.error("Webhook missing video_id");
        return NextResponse.json({ error: "Missing video_id" }, { status: 400 });
      }


      // Find and update video status to failed
      const video = await prisma.video.findFirst({
        where: {
          videoProviderId: videoId,
          videoProvider: "heygen",
        },
      });

      if (video) {
        // Use video.id to update only this specific video
        await prisma.video.update({
          where: {
            id: video.id,
          },
          data: {
            videoStatus: "failed" as any,
            data: {
              ...(video.data as any || {}),
              webhook_event: event_type,
              webhook_data: event_data,
              error: errorMessage,
              updated_at: new Date().toISOString(),
            },
          },
        });

      }

      return NextResponse.json({ success: true, message: "Failure webhook processed" });
    }

    // Handle other event types (avatarvideo.processing, etc.)
    return NextResponse.json({ success: true, message: "Webhook received but not processed" });

  } catch (error: any) {
    console.error("Error processing HeyGen webhook:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}

// Handle OPTIONS request for webhook validation
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

