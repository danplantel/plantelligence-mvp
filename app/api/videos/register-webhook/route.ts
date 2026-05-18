import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { HEYGEN_API_KEY } from "@/constants/app";

export const dynamic = 'force-dynamic';

/**
 * Register webhook endpoint with HeyGen
 * Documentation: https://docs.heygen.com/reference/add-a-webhook-endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "HeyGen API key is not configured" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const webhookUrl = body.webhookUrl || process.env.NEXTAUTH_URL 
      ? `${process.env.NEXTAUTH_URL}/api/videos/heygen-webhook`
      : body.webhookUrl;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Webhook URL is required" },
        { status: 400 },
      );
    }


    // Register webhook with HeyGen
    // Subscribe to video generation events
    const response = await axios.post(
      "https://api.heygen.com/v1/webhook.add",
      {
        url: webhookUrl,
        events: [
          "avatarvideo.success",
          "avatarvideo.fail",
          "avatarvideo.processing",
        ],
      },
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      },
    );


    return NextResponse.json({
      success: true,
      data: response.data,
      webhookUrl: webhookUrl,
    });
  } catch (error: any) {
    console.error("Error registering webhook:", error);
    
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Error registering webhook";
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}

/**
 * List registered webhook endpoints
 */
export async function GET() {
  try {
    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "HeyGen API key is not configured" },
        { status: 500 },
      );
    }

    const response = await axios.get(
      "https://api.heygen.com/v1/webhook.list",
      {
        headers: {
          "X-Api-Key": apiKey,
          "Accept": "application/json",
        },
      },
    );

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error("Error listing webhooks:", error);
    
    return NextResponse.json(
      {
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}

