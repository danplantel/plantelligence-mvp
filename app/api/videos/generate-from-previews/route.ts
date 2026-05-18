import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { HEYGEN_API_KEY } from "@/constants/app";
import prisma from "@/lib/prisma";
import { ObjectId } from "mongodb";
import { Prisma } from "@prisma/client";

const HEYGEN_AVATARS_ENDPOINT = "https://api.heygen.com/v2/avatars";
const HEYGEN_VOICES_ENDPOINT = "https://api.heygen.com/v2/voices";
const HEYGEN_ASSET_UPLOAD_ENDPOINT = "https://upload.heygen.com/v1/asset";
function getExtensionFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

async function uploadBackgroundAsset(
  previewImage: string,
  apiKey: string,
): Promise<string | null> {
  try {
    let fileBlob: Blob | null = null;
    let fileName = "background.png";

    if (previewImage.startsWith("data:")) {
      const match = previewImage.match(/^data:(.+);base64,(.+)$/);
      if (!match) {
        console.error("Invalid data URL for preview image");
        return null;
      }
      const mime = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");
      const uint8Array = Uint8Array.from(buffer);
      fileBlob = new Blob([uint8Array.buffer], { type: mime });
      fileName = `background.${getExtensionFromMime(mime)}`;
    } else {
      const response = await fetch(previewImage);
      if (!response.ok) {
        console.error("Failed to download background image:", previewImage);
        return null;
      }
      const contentType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      fileBlob = new Blob([arrayBuffer], { type: contentType });
      fileName = `background.${getExtensionFromMime(contentType)}`;
    }

    const formData = new FormData();
    formData.append("file", fileBlob, fileName);

    const uploadResponse = await fetch(HEYGEN_ASSET_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.error("Failed to upload background asset to HeyGen.");
      const errorData = await uploadResponse.text();
      console.error("Asset upload response:", errorData);
      return null;
    }

    const uploadData = await uploadResponse.json();
    const assetId = uploadData?.data?.asset_id;
    if (!assetId) {
      console.error("HeyGen asset upload response missing asset_id", uploadData);
      return null;
    }

    return assetId;
  } catch (error) {
    console.error("Error uploading HeyGen background asset:", error);
    return null;
  }
}

function isValidPreviewImage(image?: string | null): image is string {
  if (!image) return false;
  if (
    image.includes("via.placeholder.com") ||
    image.includes("Upload+Not+Configured")
  ) {
    return false;
  }
  return (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:")
  );
}

async function fetchFirstAvatarId(apiKey: string): Promise<string | null> {
  try {
    const response = await axios.get(HEYGEN_AVATARS_ENDPOINT, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });
    const avatars: Array<{ avatar_id: string; status?: string }> =
      response.data?.data?.avatars || [];
    
    if (avatars.length === 0) {
      console.error("No avatars returned from HeyGen API");
      return null;
    }

    // Prefer active avatars, but use any available avatar if none are marked as active
    const activeAvatar =
      avatars.find(
        (avatar) =>
          avatar?.avatar_id &&
          (!avatar.status || avatar.status.toLowerCase() === "active"),
      ) || avatars.find((avatar) => avatar?.avatar_id);
    
    const selectedId = activeAvatar?.avatar_id;
    return selectedId || null;
  } catch (error: any) {
    console.error("Failed to fetch HeyGen avatars:", error);
    console.error("Error details:", error.response?.data || error.message);
    return null;
  }
}

async function fetchFirstVoiceId(apiKey: string): Promise<string | null> {
  try {
    const response = await axios.get(HEYGEN_VOICES_ENDPOINT, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });
    const voices: Array<{ voice_id: string }> = response.data?.data?.voices || [];
    
    if (voices.length === 0) {
      console.error("No voices returned from HeyGen API");
      return null;
    }

    const selectedId = voices[0]?.voice_id;
    return selectedId || null;
  } catch (error: any) {
    console.error("Failed to fetch HeyGen voices:", error);
    console.error("Error details:", error.response?.data || error.message);
    return null;
  }
}

interface ScenePayload {
  type: "avatar" | "resources" | "disclaimer" | string;
  step: number;
  key: string;
  input_text?: string;
  preview_image?: string;
  voice_id?: string;
  metadata?: Record<string, any>;
  contacts?: Array<{
    label: string;
    name?: string;
    email?: string;
    phone?: string;
  }>;
  lines?: string[];
}

interface TemplatePayload {
  planId?: string;
  generatedAt: string;
  scenes: ScenePayload[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      template,
      avatarId,
      voiceId,
      clientName,
      clientColor,
      clientId: clientIdOverride, // ✅ Use clientId (from Client model, not Plan)
      planId: planIdOverride, // Keep for backward compatibility
    }: {
      template: TemplatePayload;
      avatarId?: string;
      voiceId?: string;
      clientName?: string;
      clientColor?: string;
      clientId?: string; // ✅ Primary: Client ID from Benefits Hub
      planId?: string; // Legacy: Plan ID (for backward compatibility)
    } = body;

    if (!template || !Array.isArray(template.scenes)) {
      return NextResponse.json(
        { error: "Template with scenes is required" },
        { status: 400 },
      );
    }

    // ✅ Priority: clientId (from UI step 1) > template.clientId > planId (legacy)
    const clientId = clientIdOverride || (template as any).clientId || null;
    const planId = planIdOverride || template.planId || null; // Legacy support

    if (!clientId && !planId) {
      return NextResponse.json(
        { error: "Client ID or Plan ID is required" },
        { status: 400 },
      );
    }

    // ✅ Validate clientId format if provided
    if (clientId && !ObjectId.isValid(clientId)) {
      console.error("❌ Invalid clientId format:", clientId);
      return NextResponse.json(
        { error: "Invalid clientId format" },
        { status: 400 },
      );
    }

    // ✅ Verify that the Client exists (if clientId is provided)
    let clientExists = null;
    if (clientId) {
      clientExists = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      });

      if (!clientExists) {
        console.error("❌ Client does not exist:", clientId);
        return NextResponse.json(
          { error: `Client with ID ${clientId} does not exist` },
          { status: 404 },
        );
      }

      
    }

    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "HeyGen API key not configured" },
        { status: 500 },
      );
    }

    // Always fetch first available avatar and voice from HeyGen API
    // This ensures we use valid IDs even if provided ones are outdated
    const [resolvedAvatarId, resolvedVoiceId] = await Promise.all([
      fetchFirstAvatarId(apiKey),
      fetchFirstVoiceId(apiKey),
    ]);

    if (!resolvedAvatarId) {
      return NextResponse.json(
        { error: "Failed to fetch a valid avatar from HeyGen API" },
        { status: 500 },
      );
    }

    if (!resolvedVoiceId) {
      return NextResponse.json(
        { error: "Failed to fetch a valid voice from HeyGen API" },
        { status: 500 },
      );
    }

    const effectiveAvatarId = resolvedAvatarId;
    const effectiveVoiceId = resolvedVoiceId;
    const effectiveClientName = clientName || "Plan Video";
    const effectiveClientColor = clientColor || "#FFFFFF";

    // Log template scenes info
    template.scenes.forEach((scene, index) => {
      
    });

    const backgroundCache = new Map<
      string,
      { type: "image"; image_asset_id: string }
    >();

    const videoInputs = (
      await Promise.all(
        template.scenes.map(async (scene) => {
          let inputText = scene.input_text || "";

          if (!inputText) {
            if (scene.type === "resources" && scene.contacts) {
              const parts = scene.contacts
                .filter(
                  (contact) =>
                    contact.name || contact.email || contact.phone,
                )
                .map((contact) => {
                  const details = [
                    contact.name,
                    contact.email,
                    contact.phone,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  return `${contact.label}: ${details}`;
                });
              inputText =
                parts.join(". ") ||
                "Please reach out to your plan contact for more information.";
            } else if (scene.type === "disclaimer" && scene.lines) {
              inputText = scene.lines.join(" ");
            }
          }

          const trimmedText = inputText.trim();
          if (!trimmedText) {
            return null;
          }

          let background:
            | { type: "image"; image_asset_id: string }
            | { type: "color"; value: string } = {
            type: "color",
            value: effectiveClientColor,
          };

          if (isValidPreviewImage(scene.preview_image)) {
            const cachedBackground = backgroundCache.get(
              scene.preview_image,
            );
            if (cachedBackground) {
              background = cachedBackground;
            } else {
              
              const assetId = await uploadBackgroundAsset(
                scene.preview_image,
                apiKey,
              );
              if (assetId) {
                background = {
                  type: "image",
                  image_asset_id: assetId,
                };
                backgroundCache.set(scene.preview_image, background);
                
              } else {
                console.warn(
                  `Scene ${scene.key}: failed to upload background, using fallback color`,
                );
              }
            }
          } else {
            console.warn(
              `Scene ${scene.key}: invalid preview image, using fallback color`,
            );
          }

          return {
            character: {
              type: "avatar",
              avatar_id: effectiveAvatarId,
              avatar_style: "normal",
            },
            voice: {
              type: "text",
              input_text: trimmedText,
              voice_id: effectiveVoiceId, // Always use the voice fetched from API
            },
            background,
          };
        }),
      )
    ).filter((input): input is NonNullable<typeof input> => input !== null);

    if (videoInputs.length === 0) {
      return NextResponse.json(
        { error: "No valid scenes were provided" },
        { status: 400 },
      );
    }

    videoInputs.forEach((input, index) => {
      if (input.background.type === "image") {
        
      } else {
        
      }
    });

    const payload = {
      video_inputs: videoInputs,
      dimension: {
        width: 1280,
        height: 720,
      },
      caption: "false",
    };

    const endpoint = "https://api.heygen.com/v2/video/generate";
    const heygenResponse = await axios.post(endpoint, payload, {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const videoData = heygenResponse.data;
    const videoId = videoData?.data?.video_id || videoData?.video_id;


    if (!videoId) {
      console.error("❌ HeyGen response missing video_id");
      return NextResponse.json(
        { error: "HeyGen response missing video_id", details: videoData },
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


    // Validate planId before using it
    if (!ObjectId.isValid(planId as string)) {
      console.error("❌ Invalid planId format:", planId);
      return NextResponse.json(
        { error: "Invalid planId format" },
        { status: 400 },
      );
    }

    const planObjectId = new ObjectId(planId as string) as any;


    const metadata: Prisma.JsonObject = {
      template: template as unknown as Prisma.JsonValue,
      heygenResponse: videoData as Prisma.JsonValue,
    };

    // Build update/create data conditionally
    const videoUpdateData: any = {
      title: `Plan Details for ${effectiveClientName}`,
      description: "Video generated from preview scenes.",
      videoProvider: "heygen",
      videoProviderId: videoId,
      videoStatus: "in_progress",
      thumbnail: null,
      image: null,
      data: metadata,
    };

    // Only include videoUrl if it exists
    if (validVideoUrl) {
      videoUpdateData.videoUrl = validVideoUrl;
    } else {
    }

    const videoCreateData: any = {
      planId: planObjectId,
      title: `Plan Details for ${effectiveClientName}`,
      description: "Video generated from preview scenes.",
      videoProvider: "heygen",
      videoProviderId: videoId,
      videoStatus: "in_progress",
      data: metadata,
    };

    // Only include videoUrl if it exists
    if (validVideoUrl) {
      videoCreateData.videoUrl = validVideoUrl;
    }

    
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

    // Always create a new video instead of upsert to allow multiple videos per plan
    const newVideo = await prisma.video.create({
      data: videoCreateData,
    });

    
    // Verify the video was saved correctly by fetching it back
    // Use findFirst since planId is no longer unique
    const verifyVideo = await prisma.video.findFirst({
      where: {
        planId: planObjectId,
        id: newVideo.id, // Find the specific video we just created
      },
    });
    
    
    // Also check the plan and get all videos for it
    // Get plan separately since Prisma Client might not be updated yet
    let verifyPlan = await prisma.plan.findUnique({
      where: {
        id: planObjectId,
      },
    });
    
    // If not found, try to find by string ID
    if (!verifyPlan && typeof planId === 'string') {
      try {
        verifyPlan = await prisma.plan.findUnique({
          where: {
            id: planId as any,
          },
        });
      } catch (e) {
        // Ignore error
      }
    }
    
    // Get all videos for this plan
    const planVideos = verifyPlan ? await prisma.video.findMany({
      where: {
        planId: planObjectId,
      },
      orderBy: {
        createdAt: "desc",
      },
    }) : [];
    
    const latestVideo = planVideos.length > 0 ? planVideos[0] : null;
    
    
    // Even if plan is not found, video is saved and will be available
    if (!verifyPlan) {
      console.warn("⚠️ Plan not found during verification, but video is saved:", {
        videoId: newVideo.id,
        videoProviderId: newVideo.videoProviderId,
        planId: planObjectId.toString(),
        message: "Video is saved and will be available when plan is created or found",
      });
    }
    

    return NextResponse.json({
      success: true,
      video: newVideo,
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
    console.error("Error generating video from previews:", error);
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Failed to generate video";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

