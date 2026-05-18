import { SYNTHESIA_API_KEY, HEYGEN_API_KEY } from "@/constants/app";
import prisma from "@/lib/prisma";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Support both 'id' and 'planId' parameters
    const id = request.nextUrl.searchParams.get("id");
    const planId = request.nextUrl.searchParams.get("planId");
    const searchId = planId || id;


    if (!searchId) {
      return NextResponse.json(
        { message: "id or planId is missing" },
        { status: 400 }
      );
    }

    // Try to find ALL videos by planId (ObjectId format)
    // Changed from findFirst to findMany to return ALL videos for the plan
    let videos: any[] = [];
    
    // Try finding by planId (ObjectId)
    if (searchId && searchId.length === 24) {
      // Looks like MongoDB ObjectId
      try {
        const { ObjectId } = await import("mongodb");
        if (ObjectId.isValid(searchId)) {
          const planObjectId = new ObjectId(searchId);
          videos = await prisma.video.findMany({
            where: {
              planId: planObjectId as any,
            },
            orderBy: {
              createdAt: "desc", // Get newest first
            },
          });
        } else {
          // Try as string if ObjectId validation fails
          videos = await prisma.video.findMany({
            where: {
              planId: searchId,
            },
            orderBy: {
              createdAt: "desc", // Get newest first
            },
          });
        }
      } catch (error) {
        // Fallback to string search
        videos = await prisma.video.findMany({
          where: {
            planId: searchId,
          },
          orderBy: {
            createdAt: "desc", // Get newest first
          },
        });
      }
      
    }
    
    // If not found, try by plan idIndex or id
    if (videos.length === 0) {
      const idQuery = /^\d+$/g.test(searchId) ? { idIndex: +searchId } : { id: searchId };
      
      // First check if plan exists
      const plan = await prisma.plan.findFirst({
        where: idQuery,
        select: { id: true },
      });
      
      if (plan) {
        // If plan exists, find videos by planId
        videos = await prisma.video.findMany({
          where: {
            planId: plan.id,
          },
          orderBy: {
            createdAt: "desc", // Get newest first
          },
        });
      }
      
      
    }

    if (videos.length === 0) {
      // Try to find all videos to see what's in the database
      const allVideos = await prisma.video.findMany({
        select: {
          id: true,
          planId: true,
          videoProviderId: true,
          videoUrl: true,
        },
        take: 10,
      });
      
      // Return a response indicating videos are not found, but don't throw error
      // This allows the frontend to handle the case when videos are still being created
      return NextResponse.json({
        success: true,
        videos: [],
        latestVideo: null,
        data: null,
        message: "Videos not found yet. They may still be creating.",
        debug: {
          searchedId: searchId,
          searchedPlanId: planId,
          searchedIdParam: id,
          sampleVideos: allVideos,
        },
      });
    }

    // Get the latest video for backward compatibility and status checking
    let latestVideo = videos[0] || null;
    const video = latestVideo; // Keep for existing code below (status checking)

    

    // Process status check for the latest video only (to avoid too many API calls)
    // All videos will be returned, but only the latest one will be checked/updated
    if (video?.videoProvider === "synthesia") {
      const synthesiaResponse = await axios.get(
        "https://api.synthesia.io/v2/videos/" + video?.videoProviderId,
        {
          headers: {
            Authorization: SYNTHESIA_API_KEY,
          },
        },
      );
      video.synthesia = synthesiaResponse.data;
    } else if (video?.videoProvider === "heygen") {
      const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;
      if (apiKey && video?.videoProviderId) {
        // Check if we should skip API call (if webhook is handling updates)
        // You can set SKIP_HEYGEN_STATUS_CHECK=true to disable this API call
        const skipStatusCheck = process.env.SKIP_HEYGEN_STATUS_CHECK === "true";
        
        if (skipStatusCheck) {
          video.heygen = {
            data: {
              status: video.videoStatus || "in_progress",
              video_id: video.videoProviderId,
            },
          };
        } else {
          try {
            // HeyGen API v2 - Use GET method to retrieve video status
            // GET https://api.heygen.com/v2/videos/{video_id}
            // Note: If webhook is configured, this check is optional as webhook will update status

            // Use HeyGen API v1 with GET method (correct way)
            let heygenResponse;
            try {
              // Correct endpoint: GET /v1/video_status.get?video_id={video_id}
              const v1Url = `https://api.heygen.com/v1/video_status.get?video_id=${video.videoProviderId}`;
              
              heygenResponse = await axios.get(v1Url, {
                headers: {
                  "X-Api-Key": apiKey,
                  "Accept": "application/json",
                },
              });
              
              
            } catch (v1Error: any) {
              // If v1 fails, try v2 API as fallback
              console.error("Error details:", {
                status: v1Error.response?.status,
                statusText: v1Error.response?.statusText,
                data: v1Error.response?.data,
                message: v1Error.message,
                url: v1Error.config?.url,
              });
              
              // Try v2 API as fallback
              try {
                heygenResponse = await axios.get(
                  `https://api.heygen.com/v2/videos/${video.videoProviderId}`,
                  {
                    headers: {
                      "X-Api-Key": apiKey,
                      "Accept": "application/json",
                    },
                  },
                );
              } catch (v2Error: any) {
                console.error("V2 Error details:", {
                  status: v2Error.response?.status,
                  statusText: v2Error.response?.statusText,
                  message: v2Error.message,
                });
                
                // Both APIs failed, use database status
                video.heygen = {
                  data: {
                    status: video.videoStatus || "in_progress",
                    video_id: video.videoProviderId,
                  },
                };
                
                // Always fetch latest data from database (might have been updated by webhook)
                const latestVideo = await prisma.video.findFirst({
                  where: {
                    planId: video.planId,
                  },
                  orderBy: {
                    createdAt: "desc", // Get the latest video
                  },
                });
                if (latestVideo) {
                  Object.assign(video, latestVideo);
                  
                  
                  // Check if videoUrl is in the data field (from webhook)
                  if (latestVideo.data && typeof latestVideo.data === 'object') {
                    const dataObj = latestVideo.data as any;
                    
                    
                    // Deep search for video_url in data object
                    const searchForVideoUrl = (obj: any, path = ""): string | null => {
                      if (!obj || typeof obj !== 'object') return null;
                      
                      for (const key in obj) {
                        const value = obj[key];
                        if (typeof value === 'string' && (
                          key.toLowerCase().includes('video') || 
                          key.toLowerCase().includes('url') ||
                          key.toLowerCase().includes('download')
                        ) && value.includes('http') && (
                          value.includes('.mp4') || 
                          value.includes('video') || 
                          value.includes('cdn') ||
                          value.includes('heygen') ||
                          value.includes('s3') ||
                          value.includes('amazonaws')
                        )) {
                          return value;
                        }
                        if (typeof value === 'object' && value !== null) {
                          const found = searchForVideoUrl(value, path ? `${path}.${key}` : key);
                          if (found) return found;
                        }
                      }
                      return null;
                    };
                    
                    const webhookVideoUrl = 
                      dataObj?.webhook_data?.video_url ||
                      dataObj?.webhook_data?.url ||
                      dataObj?.webhook_data?.download_url ||
                      dataObj?.video_url ||
                      dataObj?.url ||
                      dataObj?.download_url ||
                      searchForVideoUrl(dataObj);
                    
                    if (webhookVideoUrl && webhookVideoUrl !== "null" && !webhookVideoUrl.includes("null") && webhookVideoUrl.startsWith("http")) {
                      const currentVideoUrl = latestVideo.videoUrl;
                      const needsUpdate = !currentVideoUrl || 
                                        currentVideoUrl === "null" || 
                                        currentVideoUrl.includes("null") ||
                                        currentVideoUrl !== webhookVideoUrl;
                      
                      if (needsUpdate) {
                        // Update videoUrl in database if it's missing or different
                        // Use video.id to update only this specific video
                        await prisma.video.update({
                          where: {
                            id: video.id,
                          },
                          data: {
                            videoUrl: webhookVideoUrl,
                            videoStatus: "completed",
                          },
                        });
                        video.videoUrl = webhookVideoUrl;
                      }
                    } else {
                    }
                  }
                }
                
                // If videoUrl exists in DB, include it even if API failed
                if (video.videoUrl && video.videoUrl !== "null" && !video.videoUrl.includes("null")) {
                  video.heygen.data.video_url = video.videoUrl;
                  video.heygen.data.status = "completed";
                  video.videoStatus = "completed";
                }
                
                return NextResponse.json({
                  data: { ...video },
                });
              }
            }

          // Process successful API response

          // HeyGen API v1 response structure: { data: { video_id, status, video_url, thumbnail_url, ... } }
          // HeyGen API v2 response structure: { data: { video_id, status, video_url, ... } }
          const heygenData = heygenResponse.data?.data || heygenResponse.data;
          const heygenResponseWrapper = heygenResponse.data;
          video.heygen = heygenResponseWrapper;

          // Update video in database if status changed or videoUrl appeared
          // For v1 API: response.data.data.status
          // For v2 API: response.data.data.status or response.data.status
          const heygenStatus = 
            heygenData?.status || 
            heygenResponseWrapper?.data?.status || 
            heygenResponseWrapper?.status;
          
          // Try multiple possible locations for video_url in HeyGen API v2 response
          // Also check nested structures and alternative field names
          const heygenVideoUrl = 
            heygenData?.data?.video_url || 
            heygenData?.data?.video ||
            heygenData?.data?.download_url ||
            heygenData?.data?.download ||
            heygenData?.data?.url ||
            heygenData?.data?.file_url ||
            heygenData?.data?.mp4_url ||
            heygenData?.video_url ||
            heygenData?.video ||
            heygenData?.download_url ||
            heygenData?.download ||
            heygenData?.url ||
            heygenData?.file_url ||
            heygenData?.mp4_url ||
            heygenData?.result?.video_url ||
            heygenData?.result?.video ||
            heygenData?.result?.download_url;
          
          // Deep search in nested objects
          let deepVideoUrl = null;
          if (!heygenVideoUrl) {
            const searchInObject = (obj: any, depth = 0): string | null => {
              if (depth > 3 || !obj || typeof obj !== 'object') return null;
              
              for (const key in obj) {
                const value = obj[key];
                if (typeof value === 'string' && (
                  value.includes('http') && (
                    value.includes('.mp4') || 
                    value.includes('video') || 
                    value.includes('cdn') ||
                    value.includes('heygen')
                  )
                )) {
                  return value;
                }
                if (typeof value === 'object' && value !== null) {
                  const found = searchInObject(value, depth + 1);
                  if (found) return found;
                }
              }
              return null;
            };
            deepVideoUrl = searchInObject(heygenData);
          }
          
          const finalVideoUrl = heygenVideoUrl || deepVideoUrl;

          

          // Always update if videoUrl appeared (even if status hasn't changed)
          if (finalVideoUrl && finalVideoUrl !== "null" && !finalVideoUrl.includes("null")) {
            const needsUpdate = 
              !video.videoUrl || 
              video.videoUrl !== finalVideoUrl ||
              video.videoStatus !== "completed";

            if (needsUpdate) {
              // Use video.id to update only this specific video
              await prisma.video.update({
                where: {
                  id: video.id,
                },
                data: {
                  videoUrl: finalVideoUrl,
                  videoStatus: "completed",
                  data: heygenData,
                },
              });
            }
          } else if (heygenStatus && heygenStatus !== video.videoStatus) {
            // Update status if it changed (but no videoUrl yet)
            const newStatus = heygenStatus === "completed" || heygenStatus === "success" ? "completed" : "in_progress";
            // Use video.id to update only this specific video
            await prisma.video.update({
              where: {
                id: video.id,
              },
              data: {
                videoStatus: newStatus,
                ...(finalVideoUrl && finalVideoUrl !== "null" ? { videoUrl: finalVideoUrl } : {}),
                data: heygenData,
              },
            });
          } else if (heygenStatus === "completed" || heygenStatus === "success") {
            // If status is completed but no videoUrl in response, check if we can construct it
            // Some APIs return video_id and we need to construct the URL
            const videoId = heygenData?.data?.video_id || heygenData?.video_id || video.videoProviderId;
            if (videoId && !video.videoUrl) {
              // Try to construct video URL from video_id (HeyGen pattern)
              const constructedUrl = `https://api.heygen.com/v2/videos/${videoId}/download`;
              
              // Try to fetch the download URL
              try {
                const downloadResponse = await axios.get(
                  `https://api.heygen.com/v2/videos/${videoId}/download`,
                  {
                    headers: {
                      "X-Api-Key": apiKey,
                      "Accept": "application/json",
                    },
                  },
                );
                
                const downloadUrl = downloadResponse.data?.data?.download_url || 
                                   downloadResponse.data?.download_url ||
                                   downloadResponse.data?.url;
                
                if (downloadUrl) {
                  // Use video.id to update only this specific video
                  await prisma.video.update({
                    where: {
                      id: video.id,
                    },
                    data: {
                      videoUrl: downloadUrl,
                      videoStatus: "completed",
                      data: heygenData,
                    },
                  });
                }
              } catch (downloadError: any) {
              }
            }
          }

          // Always fetch latest data from database after potential update
          // Refresh all videos to get the latest status
          const updatedVideos = await prisma.video.findMany({
            where: {
              planId: video.planId,
            },
            orderBy: {
              createdAt: "desc", // Get newest first
            },
          });
          
          // Update the videos array with fresh data
          if (updatedVideos.length > 0) {
            // Update the latest video object
            const updatedLatestVideo = updatedVideos[0];
            Object.assign(video, updatedLatestVideo);
            // Update the videos array
            videos = updatedVideos;
            latestVideo = updatedLatestVideo;
            
            
            
            // If videoUrl exists in DB but not in API response, use DB value
            if (updatedLatestVideo.videoUrl && updatedLatestVideo.videoUrl !== "null" && !updatedLatestVideo.videoUrl.includes("null")) {
              if (!finalVideoUrl || finalVideoUrl === "null") {
                video.videoUrl = updatedLatestVideo.videoUrl;
                // Also update heygen data to include videoUrl for frontend
                if (video.heygen && typeof video.heygen === 'object') {
                  if (!video.heygen.data) {
                    video.heygen.data = {};
                  }
                  video.heygen.data.video_url = updatedLatestVideo.videoUrl;
                }
              }
            }
          }
          } catch (error: any) {
          console.error("❌ Error fetching HeyGen video status:", error);
          console.error("Error details:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
            url: error.config?.url,
            method: error.config?.method,
          });

            // Continue without HeyGen data if API call fails
            // Use the video status from database as fallback
            video.heygen = {
              data: {
                status: video.videoStatus || "in_progress",
                video_id: video.videoProviderId,
              },
            };
          }
        }
      }
    }

    

    // Return ALL videos in the format requested by the user
    return NextResponse.json({
      success: true,
      videos: videos, // ALL videos for the plan
      latestVideo: latestVideo ? { // Latest video for backward compatibility
        id: latestVideo.id,
        planId: latestVideo.planId,
        videoProviderId: latestVideo.videoProviderId,
        videoUrl: latestVideo.videoUrl,
        videoStatus: latestVideo.videoStatus,
        pagePlacement: latestVideo.pagePlacement,
        thumbnail: latestVideo.thumbnail,
        image: latestVideo.image,
        data: latestVideo.data,
        createdAt: latestVideo.createdAt,
        updatedAt: latestVideo.updatedAt,
      } : null,
      // Keep old format for backward compatibility
      data: latestVideo ? { ...latestVideo } : null,
      video: latestVideo ? {
        id: latestVideo.id,
        planId: latestVideo.planId,
        videoProviderId: latestVideo.videoProviderId,
        videoUrl: latestVideo.videoUrl,
        videoStatus: latestVideo.videoStatus,
        thumbnail: latestVideo.thumbnail,
        image: latestVideo.image,
        data: latestVideo.data,
        createdAt: latestVideo.createdAt,
        updatedAt: latestVideo.updatedAt,
      } : null,
      debug: {
        searchedId: searchId,
        searchedPlanId: planId,
        searchedIdParam: id,
        videosCount: videos.length,
        latestVideoId: latestVideo?.id,
        planId: latestVideo?.planId,
        videoProviderId: latestVideo?.videoProviderId,
        videoUrl: latestVideo?.videoUrl,
        videoStatus: latestVideo?.videoStatus,
      },
    });
  } catch (error: any) {
    console.error("Error Api", request.nextUrl.pathname, error);
    
    // Log detailed error information
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
    } else if (error.request) {
      console.error("Error request:", error.request);
    } else {
      console.error("Error message:", error.message);
    }
    
    const errorMessage = 
      error.response?.data?.message || 
      error.message || 
      "Error fetching videos";
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.response?.data 
      },
      { status: 500 },
    );
  }
}
