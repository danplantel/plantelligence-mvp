import { NextResponse } from "next/server";
import axios from "axios";
import { HEYGEN_API_KEY } from "@/constants/app";

export const dynamic = 'force-dynamic';

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
      "https://api.heygen.com/v2/avatars",
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
    console.error("Error fetching HeyGen avatars:", error);
    
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Error fetching avatars";
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}

