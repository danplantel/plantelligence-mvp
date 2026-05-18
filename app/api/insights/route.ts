import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Return empty insights for now
    return NextResponse.json({
      success: true,
      data: {
        insights: []
      }
    });
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
