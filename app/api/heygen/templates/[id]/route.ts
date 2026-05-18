import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { HEYGEN_API_KEY } from "@/constants/app";

/**
 * GET /api/heygen/templates/[id]
 * Returns details and variables for a specific template
 * https://docs.heygen.com/docs/generate-video-from-template-v2-1
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "HeyGen API key not configured" },
        { status: 500 },
      );
    }

    const templateId = params.id;

    const response = await axios.get(
      `https://api.heygen.com/v2/template/${templateId}`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": apiKey,
        },
      },
    );

    return NextResponse.json({
      success: true,
      data: response.data.data,
    });
  } catch (error: any) {
    console.error("Error fetching HeyGen template details:", error);
    return NextResponse.json(
      {
        error:
          error.response?.data?.message || "Failed to fetch template details",
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}
