import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { normalizeUserImagesToR2 } from "@/lib/branding-r2";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Auth required");
  }

  type TBody = {
    disclaimer: string;
    name: string;
    organizationType: string;
    phone: string;
    advisorName: string;
    advisorEmail: string;
    advisorPhone: string;
    advisorLogoUrl: string;
    complianceEmail: string;
    advisorLink: string;
    additionalAdvisorLink: string;
    recordkeeperContactLabel: string;
    title?: string;
    displayAdvisorInfoHeader?: boolean;
    displayAdvisorContactButton: boolean;
    advisorLogo: string;
    showAdvancedCompliance: boolean;
  };

  const body: TBody = await req.json();

  // `User` images are stored inline on the row, and `/api/profile` ships the whole row
  // with no projection — measured at 2.72 MB for one advisor, with advisorLogo and
  // advisorLogoUrl holding the SAME image twice. Move inline images to R2 before they
  // are persisted so every /api/profile reader stops paying for them.
  const userId = (session.user as { id?: string }).id ?? "";
  const normalizedBody = await normalizeUserImagesToR2(body, userId);

  const profile = await prisma.user.update({
    where: { email: session.user.email },
    data: normalizedBody,
  });

  return NextResponse.json(profile);
}
