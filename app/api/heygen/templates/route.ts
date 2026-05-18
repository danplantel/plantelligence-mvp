import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { HEYGEN_API_KEY } from "@/constants/app";

/**
 * GET /api/heygen/templates
 * Returns list of available HeyGen templates
 * https://docs.heygen.com/docs/generate-video-from-template-v2-1
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "HeyGen API key not configured" },
        { status: 500 },
      );
    }

    const response = await axios.get("https://api.heygen.com/v2/templates", {
      headers: {
        accept: "application/json",
        "x-api-key": apiKey,
      },
    });

    const templates = response.data?.data?.templates || [];

    const normalized = templates.map((template: any) => ({
      template_id: template.template_id || "",
      name: template.name || "Untitled Template",
      thumbnail_image_url: template.thumbnail_image_url || null,
      description: template.description || "",
      created_at: template.created_at || null,
    }));

    return NextResponse.json({
      success: true,
      data: normalized,
    });
  } catch (error: any) {
    console.error("Error fetching HeyGen templates:", error);
    return NextResponse.json(
      {
        error: error.response?.data?.message || "Failed to fetch templates",
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}
