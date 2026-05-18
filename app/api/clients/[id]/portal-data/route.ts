import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    // For now, return demo data
    // TODO: Replace with actual database query when ready
    const portalData = {
      companyData: {
        companyName: "Demo Company",
        companyLogo: undefined,
        brandColor: "#1F3A60",
        backgroundImg: undefined,
        missionStatement: "Demo mission statement",
        disclaimers: undefined,
      },
      keyContacts: [
        {
          name: "John Smith",
          role: "Financial Advisor",
          customRole: "Senior Financial Advisor",
          bio: "Experienced financial advisor with 10+ years in retirement planning.",
          headshot: undefined,
        },
        {
          name: "Sarah Johnson",
          role: "Benefits Specialist",
          customRole: "Benefits Coordinator",
          bio: "Specializes in employee benefits and insurance planning.",
          headshot: undefined,
        },
      ],
    };

    return NextResponse.json(portalData);
  } catch (error) {
    console.error("Error fetching client portal data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
